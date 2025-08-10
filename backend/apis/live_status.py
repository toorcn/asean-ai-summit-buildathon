# apis/live_status.py
import base64, asyncio
from typing import List, Dict, Any, Optional, Tuple
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .wait_time import _count_people_from_image_b64, is_openai_ready  # reuse strict counter

router = APIRouter(prefix="/live-status", tags=["live-status"])

class LiveQuery(BaseModel):
    hospital_id: str = Field(..., description="Target hospital for display purposes")
    camera_urls: List[str] = Field(..., description="List of http(s) URLs that return a fresh JPEG (e.g., /capture.jpg)")
    per_person_minutes: Optional[int] = Field(None, ge=1, le=60)

class LiveResult(BaseModel):
    hospital_id: str
    people: int
    per_person_minutes: int
    estimated_wait_minutes: int
    cameras: List[Dict[str, Any]]
    stored: bool = False  # privacy: nothing persisted

async def _fetch_image(url: str, client: httpx.AsyncClient) -> Tuple[Optional[bytes], Optional[str]]:
    try:
        r = await client.get(url, timeout=8)
        r.raise_for_status()
        data = r.content or b""
        if len(data) < 100:  # tiny responses are likely errors
            return None, f"tiny_response len={len(data)} ct={r.headers.get('content-type','n/a')}"
        return data, None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"

@router.post("", response_model=LiveResult, summary="On-demand webcam capture and headcount (no persistence)")
async def live_status(q: LiveQuery):
    if not q.camera_urls:
        raise HTTPException(400, "camera_urls required")
    if not is_openai_ready():
        raise HTTPException(500, "OpenAI vision is not configured. Set OPENAI_API_KEY (and OPENAI_VISION_MODEL).")

    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(_fetch_image(u, client) for u in q.camera_urls))

    cam_records, total_people = [], 0
    for i, (img, err) in enumerate(results):
        cam_id = f"cam-{i+1}"
        if not img:
            cam_records.append({"camera_id": cam_id, "people": 0, "status": "no_image", "error": err})
            continue
        b64 = base64.b64encode(img).decode("ascii")
        try:
            n = _count_people_from_image_b64(b64, require_openai=True)  # << force OpenAI
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Vision error ({cam_id}): {e}")
        total_people += n
        cam_records.append({"camera_id": cam_id, "people": n, "status": "ok", "engine": "openai"})

    per_person = q.per_person_minutes or 10
    est = int(total_people * per_person)
    return LiveResult(
        hospital_id=q.hospital_id,
        people=total_people,
        per_person_minutes=per_person,
        estimated_wait_minutes=est,
        cameras=cam_records,
        stored=False,
    )

@router.get("/health")
def health():
    return {"openai_ready": is_openai_ready()}
