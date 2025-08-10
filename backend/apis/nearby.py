import os, requests, random, base64, math
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv
load_dotenv()

from .mysql_client import upsert_hospitals, fetch_hospitals_in_bbox, fetch_hospital_by_id, now_iso
from .wait_time import _count_people_from_image_b64, is_openai_ready

router = APIRouter(prefix="/nearby-hospitals", tags=["nearby-hospitals"])

# Config
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
if not API_KEY:
    raise RuntimeError("Set GOOGLE_MAPS_API_KEY in .env")

CACHE_TTL = int(os.getenv("CACHE_TTL_SECONDS", "300"))  # 5 min
RADIUS_M_DEFAULT = 10_000

# Camera config for FIRST hospital
PRIMARY_CAMERA_ID = os.getenv("PRIMARY_CAMERA_ID", "").strip()
PRIMARY_CAMERA_URLS = [u.strip() for u in os.getenv("PRIMARY_CAMERA_URLS", "").split(";") if u.strip()]
PER_PERSON_FOR_CAMERA = int(os.getenv("PER_PERSON_FOR_CAMERA", "10"))

# RNG fallback (others)
RNG_MIN_PEOPLE = 20
RNG_MAX_PEOPLE = 80
RNG_PER_PERSON_MIN = 8
RNG_PER_PERSON_MAX = 15
RNG_DOCTORS_MIN = 1
RNG_DOCTORS_MAX = 20

class Query(BaseModel):
    lat: float
    lng: float
    max_results: int = Field(20, ge=1, le=20)
    radius_m: int = Field(RADIUS_M_DEFAULT, ge=1000, le=20000)

def _deg_box(lat: float, radius_m: float) -> Tuple[float, float, float, float]:
    dlat = radius_m / 111_000.0
    dlng = radius_m / (111_000.0 * max(0.1, math.cos(math.radians(lat))))
    return lat - dlat, lat + dlat, ( -180.0 ), ( 180.0 )  # lng limits handled separately

def _is_fresh_wait(row, now_utc, ttl_sec: int) -> bool:
    ts = row.get("wait_last_updated")
    if not ts:
        return False
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return False
    delta = (now_utc - ts) if getattr(ts, "tzinfo", None) else (datetime.utcnow() - ts)
    return delta.total_seconds() <= ttl_sec

def _places_nearby_hospitals(lat: float, lng: float, *, max_results: int, radius_m: int) -> List[Dict[str, Any]]:
    url = "https://places.googleapis.com/v1/places:searchNearby"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.googleMapsUri,places.name"
    }
    body = {
        "includedTypes": ["hospital"],
        "maxResultCount": max_results,
        "locationRestriction": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": float(radius_m)}}
    }
    r = requests.post(url, headers=headers, json=body, timeout=12)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    out = []
    for p in r.json().get("places", []):
        loc = p.get("location", {})
        name = (p.get("displayName") or {}).get("text")
        pid = p.get("id") or (p.get("name") or "").split("/", 1)[-1]
        maps = p.get("googleMapsUri")
        if not name or "latitude" not in loc or "longitude" not in loc:
            continue
        out.append({"hospital_id": pid, "name": name, "lat": loc["latitude"], "lng": loc["longitude"], "maps_url": maps})
    return out

def _route_matrix(origin_lat: float, origin_lng: float, dests: List[Dict[str, Any]]):
    if not dests: return []
    url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration"
    }
    body = {
        "origins": [{"waypoint": {"location": {"latLng": {"latitude": origin_lat, "longitude": origin_lng}}}}],
        "destinations": [{"waypoint": {"location": {"latLng": {"latitude": d['lat'], "longitude": d['lng']}}}} for d in dests],
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE_OPTIMAL"
    }
    r = requests.post(url, headers=headers, json=body, timeout=12)
    if not r.ok:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    return r.json()

def _parse_duration_seconds(val: str) -> Optional[float]:
    if isinstance(val, str) and val.endswith("s"):
        try: return float(val[:-1])
        except: return None
    return None

def _fetch_camera_bytes(url: str, timeout: float = 6.0) -> Optional[bytes]:
    try:
        rr = requests.get(url, timeout=timeout)
        if not rr.ok: return None
        data = rr.content or b""
        return data if len(data) >= 100 else None
    except Exception:
        return None

def _capture_and_count(camera_urls: List[str]) -> Tuple[int, List[Dict[str, Any]]]:
    if not camera_urls or not is_openai_ready():
        return 0, []
    people, cams = 0, []
    for i, u in enumerate(camera_urls):
        img = _fetch_camera_bytes(u)
        if not img:
            cams.append({"camera_id": f"cam-{i+1}", "people": 0, "status": "no_image"})
            continue
        b64 = base64.b64encode(img).decode("ascii")
        n = _count_people_from_image_b64(b64, require_openai=True)
        people += n
        cams.append({"camera_id": f"cam-{i+1}", "people": n, "status": "ok", "engine": "openai"})
    return people, cams

@router.post("", summary="Nearby hospitals with MySQL cache (5-min TTL).")
def nearby(q: Query):
    ttl = CACHE_TTL
    now_utc = datetime.now(timezone.utc)

    # 1) Get candidates from Places
    places = _places_nearby_hospitals(q.lat, q.lng, max_results=q.max_results, radius_m=q.radius_m)

    # Always upsert static info (id/name/lat/lng/maps)
    upsert_hospitals([{
        "hospital_id": p["hospital_id"], "name": p["name"], "lat": p["lat"], "lng": p["lng"],
        "maps_url": p.get("maps_url"), "updated_at": datetime.utcnow()
    } for p in places])

    # 2) Compute ETA/distance so we can decide the *first* hospital by ETA
    matrix = _route_matrix(q.lat, q.lng, places)
    stats: Dict[int, Tuple[Optional[float], Optional[float]]] = {}
    for row in matrix:
        if row.get("status", {}).get("code"):
            continue
        if row.get("condition") != "ROUTE_EXISTS":
            continue
        di = row["destinationIndex"]
        dist_km = round(row.get("distanceMeters", 0) / 1000.0, 2) if "distanceMeters" in row else None
        dur_s = _parse_duration_seconds(row.get("duration"))
        eta_min = round(dur_s / 60.0, 1) if dur_s else None
        stats[di] = (dist_km, eta_min)

    items_base = []
    for i, p in enumerate(places):
        dist_km, eta_min = stats.get(i, (None, None))
        items_base.append({
            "hospital_id": p["hospital_id"],
            "hospital_name": p["name"],
            "google_maps_location_link": p.get("maps_url"),
            "distance_km": dist_km,
            "eta_minutes": eta_min,
        })
    # sort by ETA then distance (this defines "first hospital")
    items_base.sort(key=lambda x: (x["eta_minutes"] is None, x["eta_minutes"], x["distance_km"]))

    # Helper: fresh wait?
    def _is_fresh_wait(row) -> bool:
        ts = row.get("wait_last_updated")
        if not ts:
            return False
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except Exception:
                return False
        delta = (now_utc - ts) if getattr(ts, "tzinfo", None) else (datetime.utcnow() - ts)
        return delta.total_seconds() <= ttl

    # 3) Decide target hospital (PRIMARY_CAMERA_ID > first by ETA)
    target_id = None
    if PRIMARY_CAMERA_ID:
        target_id = PRIMARY_CAMERA_ID
    elif items_base:
        target_id = items_base[0]["hospital_id"]

    # 4) If target has NO fresh wait, capture once and upsert (so RNG never overwrites it)
    if target_id and PRIMARY_CAMERA_URLS:
        row = fetch_hospital_by_id(target_id) or {}
        if not _is_fresh_wait(row):
            try:
                ppl, _cams = _capture_and_count(PRIMARY_CAMERA_URLS)
                existing = fetch_hospital_by_id(target_id) or {}
                doctors = (existing.get("doctors_working")
                        or random.randint(RNG_DOCTORS_MIN, RNG_DOCTORS_MAX))
                est = int(math.ceil(ppl / max(1, doctors)) * PER_PERSON_FOR_CAMERA)
                upsert_hospitals([{
                    "hospital_id": target_id,
                    "name": existing.get("name") or row.get("name") if (row:=existing) else None,
                    "lat": existing.get("lat"),
                    "lng": existing.get("lng"),
                    "maps_url": existing.get("maps_url"),
                    "last_people": ppl,
                    "per_person_minutes": PER_PERSON_FOR_CAMERA,
                    "doctors_working": doctors,
                    "estimated_wait_minutes": est,
                    "wait_last_updated": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }])
            except Exception:
                # swallow camera errors; RNG will fill later if needed
                pass

    # 5) Re-read current rows (after any camera upsert)
    #    RNG-fill ONLY rows that still lack a fresh wait
    #    (This was the bug before; RNG was stomping the camera row.)
    # Build a quick lookup
    # NOTE: bbox not strictly required here; we have exact ids, but bbox is fine
    # and cheaper than hitting by id in a loop.
    min_lat = min(p["lat"] for p in places) if places else q.lat
    max_lat = max(p["lat"] for p in places) if places else q.lat
    min_lng = min(p["lng"] for p in places) if places else q.lng
    max_lng = max(p["lng"] for p in places) if places else q.lng
    existing = fetch_hospitals_in_bbox(min_lat, max_lat, min_lng, max_lng)
    existing_map = {r["hospital_id"]: r for r in existing}

    rng_rows = []
    for p in places:
        r = existing_map.get(p["hospital_id"]) or {}
        if _is_fresh_wait(r):
            continue  # already has fresh wait (camera or previous)
        rng_people   = random.randint(RNG_MIN_PEOPLE, RNG_MAX_PEOPLE)
        per_person   = random.randint(RNG_PER_PERSON_MIN, RNG_PER_PERSON_MAX)
        rng_doctors  = random.randint(RNG_DOCTORS_MIN, RNG_DOCTORS_MAX)
        rng_wait     = int(math.ceil(rng_people / max(1, rng_doctors)) * per_person)

        rng_rows.append({
        "hospital_id": p["hospital_id"],
        "name": p["name"],
        "lat": p["lat"], "lng": p["lng"],
        "maps_url": p.get("maps_url"),
        "last_people": rng_people,
        "per_person_minutes": per_person,
        "doctors_working": rng_doctors,
        "estimated_wait_minutes": rng_wait,
        "wait_last_updated": datetime.utcnow(),
        "updated_at": datetime.utcnow()
        })
    if rng_rows:
        upsert_hospitals(rng_rows)

    # 6) Build the final response by reading DB values (so you see camera counts)
    items = []
    for it in items_base:
        row_db = fetch_hospital_by_id(it["hospital_id"]) or {}
        items.append({
        **it,
        "current_people": row_db.get("last_people"),
        "current_estimated_wait_minutes": row_db.get("estimated_wait_minutes"),
        "wait_last_updated": row_db.get("wait_last_updated"),
        "active_doctors": row_db.get("doctors_working"),
        "_cache": {"source": "mysql", "updated_at": row_db.get("updated_at")}
        })
    return {"count": len(items), "hospitals": items}