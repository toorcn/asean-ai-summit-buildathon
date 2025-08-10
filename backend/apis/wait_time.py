import os, base64, json, random
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# ---------------- In-memory store (hackathon simple) ----------------
_WAIT: Dict[str, Dict[str, Any]] = {}

def set_wait_for_hospital(hospital_id: str, record: Dict[str, Any]) -> None:
    record = dict(record)
    record["ts"] = datetime.now(timezone.utc).isoformat()
    _WAIT[hospital_id] = record

def get_wait_for_hospital(hospital_id: str) -> Optional[Dict[str, Any]]:
    return _WAIT.get(hospital_id)

# ---------------- People counting (OpenAI optional) -----------------
from dotenv import load_dotenv
load_dotenv()  # ensure .env is loaded even if main.py didn't run first

OPENAI_MODEL = os.getenv("OPENAI_VISION_MODEL", "gpt-5-nano")  # fixed default
_OPENAI_CLIENT = None
try:
    from openai import OpenAI
    if os.getenv("OPENAI_API_KEY"):
        _OPENAI_CLIENT = OpenAI()
except Exception:
    _OPENAI_CLIENT = None

def is_openai_ready() -> bool:
    return _OPENAI_CLIENT is not None

def _count_people_from_image_b64(img_b64: str, *, require_openai: bool = False) -> int:
    """
    If require_openai=True and the OpenAI client isn't ready,
    raise an error instead of using the heuristic fallback.
    """
    if _OPENAI_CLIENT is None:
        if require_openai:
            raise RuntimeError("OpenAI vision is not configured or unavailable")
        # ---- fallback heuristic (demo only) ----
        try:
            import hashlib, random
            h = int(hashlib.sha256(img_b64[:1024].encode("utf-8")).hexdigest(), 16)
            random.seed(h)
            return random.randint(1, 8)
        except Exception:
            return 0

    import json
    prompt = (
        "Count the number of distinct people visible in the photo. "
        "Return JSON like {\"people\": <integer>} with no extra text."
    )
    resp = _OPENAI_CLIENT.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}},
            ],
        }],
        response_format={"type": "json_object"},
    )
    data = json.loads(resp.choices[0].message.content)
    return max(0, int(data.get("people", 0)))

# ---------------- FastAPI models + routes ---------------------------
class CameraImage(BaseModel):
    image_b64: str = Field(..., description="Raw base64 of the image (no data: prefix)")
    camera_id: Optional[str] = Field(None, description="Optional camera identifier")

class WaitTimeIn(BaseModel):
    hospital_id: str
    cameras: List[CameraImage] = Field(default_factory=list)
    per_person_minutes: Optional[int] = Field(None, ge=1, le=60)

class WaitTimeOut(BaseModel):
    hospital_id: str
    people: int
    per_person_minutes: int
    estimated_wait_minutes: int
    cameras: List[Dict[str, Any]]
    ts: str

router = APIRouter(prefix="/wait-time", tags=["wait-time"])

@router.post("", response_model=WaitTimeOut, summary="Upload base64 images and compute wait time")
def upload_wait_time(payload: WaitTimeIn):
    if not payload.hospital_id:
        raise HTTPException(400, "hospital_id required")

    per_person = payload.per_person_minutes or random.randint(11,20)
    people_counts = []
    cam_records: List[Dict[str, Any]] = []
    for i, cam in enumerate(payload.cameras or []):
        n = _count_people_from_image_b64(cam.image_b64)
        people_counts.append(n)
        cam_records.append({"camera_id": cam.camera_id or f"cam-{i+1}", "people": n})

    total_people = sum(people_counts)
    est_wait = int(total_people * per_person)

    record = {
        "hospital_id": payload.hospital_id,
        "people": total_people,
        "per_person_minutes": per_person,
        "estimated_wait_minutes": est_wait,
        "cameras": cam_records,
    }
    set_wait_for_hospital(payload.hospital_id, record)
    out = get_wait_for_hospital(payload.hospital_id)
    if not out:
        raise HTTPException(500, "Failed to store wait-time")
    return WaitTimeOut(**out)  # type: ignore

@router.get("/{hospital_id}", response_model=WaitTimeOut, summary="Get the latest wait-time for a hospital")
def get_current_wait(hospital_id: str):
    rec = get_wait_for_hospital(hospital_id)
    if not rec:
        raise HTTPException(404, "No wait-time for this hospital yet")
    return WaitTimeOut(**rec)  # type: ignore
