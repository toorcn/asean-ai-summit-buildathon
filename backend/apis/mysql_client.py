# apis/mysql_client.py
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, RowMapping
from dotenv import load_dotenv

load_dotenv()

_engine: Optional[Engine] = None

def _dsn_from_env() -> str:
    host = os.getenv("MYSQL_HOST", "127.0.0.1")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    pw = os.getenv("MYSQL_PASSWORD", "")
    db = os.getenv("MYSQL_DB", "hackathon")
    return f"mysql+pymysql://{user}:{pw}@{host}:{port}/{db}?charset=utf8mb4"

def db() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(_dsn_from_env(), pool_pre_ping=True, pool_recycle=1800, future=True)
    return _engine

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def upsert_hospitals(rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    # Normalize keys and ensure all columns exist
    norm = []
    for r in rows:
        norm.append({
            "hospital_id": r.get("hospital_id"),
            "name": r.get("name"),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
            "maps_url": r.get("maps_url"),
            "last_people": r.get("last_people"),
            "per_person_minutes": r.get("per_person_minutes"),
            "estimated_wait_minutes": r.get("estimated_wait_minutes"),
            "wait_last_updated": r.get("wait_last_updated"),
            "updated_at": r.get("updated_at") or datetime.utcnow(),
            "doctors_working": r.get("doctors_working"),
        })
    sql = text("""
        INSERT INTO hospitals
        (hospital_id, name, lat, lng, maps_url,
        last_people, per_person_minutes, doctors_working, estimated_wait_minutes,
        wait_last_updated, updated_at)
        VALUES
        (:hospital_id, :name, :lat, :lng, :maps_url,
        :last_people, :per_person_minutes, :doctors_working, :estimated_wait_minutes,
        :wait_last_updated, :updated_at)
        ON DUPLICATE KEY UPDATE
        name=VALUES(name),
        lat=VALUES(lat),
        lng=VALUES(lng),
        maps_url=VALUES(maps_url),
        last_people=VALUES(last_people),
        per_person_minutes=VALUES(per_person_minutes),
        doctors_working=VALUES(doctors_working),
        estimated_wait_minutes=VALUES(estimated_wait_minutes),
        wait_last_updated=VALUES(wait_last_updated),
        updated_at=VALUES(updated_at)
    """)
    with db().begin() as conn:
        conn.execute(sql, norm)

def fetch_hospitals_in_bbox(min_lat: float, max_lat: float, min_lng: float, max_lng: float) -> List[Dict[str, Any]]:
    sql = text("""
        SELECT hospital_id, name, lat, lng, maps_url,
               last_people, per_person_minutes, estimated_wait_minutes, wait_last_updated, updated_at, doctors_working
        FROM hospitals
        WHERE lat BETWEEN :min_lat AND :max_lat
          AND lng BETWEEN :min_lng AND :max_lng
    """)
    with db().begin() as conn:
        rows = conn.execute(sql, {"min_lat": min_lat, "max_lat": max_lat, "min_lng": min_lng, "max_lng": max_lng}).mappings().all()
    return [dict(r) for r in rows]

def fetch_hospital_by_id(hospital_id: str) -> Optional[Dict[str, Any]]:
    sql = text("""
        SELECT hospital_id, name, lat, lng, maps_url,
               last_people, per_person_minutes, estimated_wait_minutes, wait_last_updated, updated_at, doctors_working
        FROM hospitals WHERE hospital_id=:hospital_id
        LIMIT 1
    """)
    with db().begin() as conn:
        row = conn.execute(sql, {"hospital_id": hospital_id}).mappings().first()
    return dict(row) if row else None
