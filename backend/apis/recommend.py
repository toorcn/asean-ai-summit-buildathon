import os, json, base64, asyncio, random, time
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import httpx

from .wait_time import set_wait_for_hospital, get_wait_for_hospital
import math

RNG_DOCTORS_MIN = 1
RNG_DOCTORS_MAX = 20
RNG_MIN_PEOPLE = 20
RNG_MAX_PEOPLE = 80
RNG_PER_PERSON_MIN = 8
RNG_PER_PERSON_MAX = 15
ENABLE_MOCK_RNG = os.getenv("MOCK_RNG_FOR_UNCOVERED", "1") != "0"

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not API_KEY:
    raise RuntimeError("Set GOOGLE_MAPS_API_KEY in .env")

OPENAI_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-4o-mini")
_openai = None
try:
    from openai import OpenAI
    if os.getenv("OPENAI_API_KEY"):
        _openai = OpenAI()
except Exception:
    _openai = None

router = APIRouter(prefix="/smart-nearby", tags=["smart-nearby"])

class SmartQuery(BaseModel):
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    limit: int = Field(5, ge=1, le=20, description="How many hospitals to return")
    max_candidates: int = Field(12, ge=1, le=40, description="How many nearby hospitals to consider")
    cameras_by_hospital: Optional[Dict[str, List[str]]] = None  # map hospital_id -> [image_url, ...]

class SmartHospital(BaseModel):
    active_doctors: Optional[int] = None
    hospital_id: str
    hospital_name: str
    google_maps_location_link: str
    distance_km: Optional[float] = None
    eta_minutes: Optional[float] = None
    current_people: Optional[int] = None
    per_person_minutes: Optional[int] = None
    estimated_wait_minutes: Optional[int] = None
    total_time_minutes: Optional[float] = None
    wait_last_updated: Optional[str] = None

class SmartResponse(BaseModel):
    count: int
    origin: Dict[str, float]
    hospitals: List[SmartHospital]

PLACES_FIELDS = ",".join([
    "places.id",
    "places.displayName",
    "places.location",
    "places.googleMapsUri",
    "places.name",
])

async def places_nearby_hospitals(lat: float, lng: float, *, client: httpx.AsyncClient, max_results: int = 12) -> List[Dict[str, Any]]:
    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": PLACES_FIELDS,
    }
    body = {
        "includedTypes": ["hospital"],
        "maxResultCount": max_results,
        "locationRestriction": {
            "circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 10_000.0}
        }
    }
    r = await client.post(url, headers=headers, json=body, timeout=12)
    r.raise_for_status()
    data = r.json()
    out = []
    for p in data.get("places", []):
        loc = p.get("location", {})
        out.append({
            "id": p.get("id") or (p.get("name") or "").split("/", 1)[-1],
            "name": p.get("displayName", {}).get("text", "Unnamed Hospital"),
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
            "maps_url": p.get("googleMapsUri"),
        })
    return out

async def routes_matrix(origin_lat: float, origin_lng: float, dests: List[Dict[str, Any]], *, client: httpx.AsyncClient) -> Dict[int, Tuple[Optional[float], Optional[float]]]:
    url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration"
    }
    body = {
        "origins": [{"waypoint": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}}}],
        "destinations": [{"waypoint": {"location": {"latLng": {"latitude": d["lat"], "longitude": d["lng"]}}}} for d in dests],
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
    }
    r = await client.post(url, headers=headers, json=body, timeout=12)
    r.raise_for_status()
    matrix = r.json()
    stats: Dict[int, Tuple[Optional[float], Optional[float]]] = {}
    for row in matrix:
        if row.get("status", {}).get("code"):
            continue
        if row.get("condition") != "ROUTE_EXISTS":
            continue
        di = row["destinationIndex"]
        dist_km = round(row.get("distanceMeters", 0) / 1000.0, 2) if "distanceMeters" in row else None
        dur = row.get("duration")
        eta_min = None
        if isinstance(dur, str) and dur.endswith("s"):
            try:
                eta_min = round(float(dur.rstrip("s")) / 60.0, 1)
            except Exception:
                eta_min = None
        stats[di] = (dist_km, eta_min)
    return stats

async def fetch_image_bytes(url: str, *, client: httpx.AsyncClient, timeout: float = 3.5) -> Optional[bytes]:
    try:
        r = await client.get(url, timeout=timeout)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if not ct.startswith("image/"): return None
        return r.content
    except Exception:
        return None

async def count_people_in_bytes(img: bytes) -> int:
    if _openai is None:
        return max(0, (sum(img[:256]) % 7) + 1)
    b64 = base64.b64encode(img).decode("ascii")
    msgs = [{"role": "user", "content": [
        {"type": "text", "text": "Count the number of people. Return JSON {\"people\": <int>}"},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}]}]
    def _call():
        try:
            resp = _openai.chat.completions.create(
                model=OPENAI_MODEL, messages=msgs, response_format={"type": "json_object"})
            data = json.loads(resp.choices[0].message.content)
            return int(data.get("people", 0))
        except Exception:
            return 0
    return await asyncio.to_thread(_call)

async def count_people_from_cameras(camera_urls: List[str], *, client: httpx.AsyncClient, max_parallel: int = 4) -> int:
    sem = asyncio.Semaphore(max_parallel)
    async def worker(url: str) -> int:
        async with sem:
            img = await fetch_image_bytes(url, client=client)
            if not img: return 0
            return await count_people_in_bytes(img)
    results = await asyncio.gather(*(worker(u) for u in camera_urls))
    return sum(results)

@router.post("", response_model=SmartResponse, summary="Top-N hospitals by drive ETA + live wait-time")
async def smart_nearby(q: SmartQuery):
    async with httpx.AsyncClient() as client:
        places = await places_nearby_hospitals(q.lat, q.lng, client=client, max_results=q.max_candidates)
        if not places:
            return SmartResponse(count=0, origin={"lat": q.lat, "lng": q.lng}, hospitals=[])
        stats = await routes_matrix(q.lat, q.lng, places, client=client)

        hospitals: List[SmartHospital] = []
        for i, p in enumerate(places):
            dist, eta = stats.get(i, (None, None))
            hospitals.append(SmartHospital(
                hospital_id=p["id"], hospital_name=p["name"],
                google_maps_location_link=p["maps_url"], distance_km=dist, eta_minutes=eta))

        cameras_map = (q.cameras_by_hospital or {})

        async def enrich_wait(h: SmartHospital):
            camera_urls = cameras_map.get(h.hospital_id, [])
            if not camera_urls:
                last = get_wait_for_hospital(h.hospital_id)
                if last:
                    h.current_people = int(last.get("people", 0))
                    h.per_person_minutes = int(last.get("per_person_minutes", 10))
                    h.estimated_wait_minutes = int(last.get("estimated_wait_minutes", 0))
                    h.wait_last_updated = str(last.get("ts"))
                    return
                # >>> DEMO RNG fallback when no cache & no cameras
                if ENABLE_MOCK_RNG:
                    rng_people = random.randint(RNG_MIN_PEOPLE, RNG_MAX_PEOPLE)
                    per_person = random.randint(RNG_PER_PERSON_MIN, RNG_PER_PERSON_MAX)
                    doctors    = random.randint(RNG_DOCTORS_MIN, RNG_DOCTORS_MAX)
                    est        = int(math.ceil(rng_people / max(1, doctors)) * per_person)

                    set_wait_for_hospital(h.hospital_id, {
                    "hospital_id": h.hospital_id,
                    "people": rng_people,
                    "per_person_minutes": per_person,
                    "doctors_working": doctors,
                    "estimated_wait_minutes": est,
                    "cameras": [{"camera_id": "rng", "people": rng_people}],
                    })
                    h.current_people = rng_people
                    h.per_person_minutes = per_person
                    h.active_doctors = doctors
                    h.estimated_wait_minutes = est
                    return
                # <<< DEMO RNG
            # If we do have camera URLs, count as before
            people = await count_people_from_cameras(camera_urls, client=client)
            per_person = 10 if people == 0 else random.randint(8, 15)
            prev = get_wait_for_hospital(h.hospital_id) or {}
            doctors = prev.get("doctors_working") or random.randint(RNG_DOCTORS_MIN, RNG_DOCTORS_MAX)
            est = int(math.ceil(people / max(1, doctors)) * per_person)
            set_wait_for_hospital(h.hospital_id, {
            "hospital_id": h.hospital_id,
            "people": people,
            "per_person_minutes": per_person,
            "doctors_working": doctors,
            "estimated_wait_minutes": est,
            "cameras": [{"camera_id": url, "people": None} for url in camera_urls],
            })
            h.current_people = people
            h.per_person_minutes = per_person
            h.active_doctors = doctors
            h.estimated_wait_minutes = est
            
        sem = asyncio.Semaphore(6)
        async def guarded_enrich(h: SmartHospital):
            async with sem:
                await enrich_wait(h)

        await asyncio.gather(*(guarded_enrich(h) for h in hospitals))

        for h in hospitals:
            if h.eta_minutes is None:
                h.total_time_minutes = None
            else:
                wait = h.estimated_wait_minutes or 0
                h.total_time_minutes = float(h.eta_minutes) + float(wait)

        sortable = [h for h in hospitals if h.total_time_minutes is not None]
        sortable.sort(key=lambda x: x.total_time_minutes)
        top = sortable[:q.limit]
        if len(top) < q.limit:
            remaining = [h for h in hospitals if h not in top]
            remaining.sort(key=lambda x: (x.eta_minutes is None, x.eta_minutes))
            top += remaining[: (q.limit - len(top))]
        return SmartResponse(count=len(top), origin={"lat": q.lat, "lng": q.lng}, hospitals=top)
