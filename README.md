# CARe — Fastest Hospital Finder (monorepo)

Find the fastest hospital by total time (travel + wait), complete a short AI intake on the way, and share a clean PDF at reception.

## Layout
- backend/ — FastAPI service: nearby hospitals (Google Places/Routes), live wait estimation (cameras/OpenAI Vision), optional MySQL cache.
- frontend/ — Next.js 14 app: UI, chat intake (Groq), PDF generation, and sharing.

## Project description
CARe helps patients get seen faster by choosing the hospital with the lowest total time: the sum of driving ETA and expected waiting time. The app also collects a short, AI‑guided intake on the way and produces a clean PDF summary that can be shown to doctors or shared with clinicians (QR/link).

What it does
- Ranks nearby hospitals by total time (drive ETA from Google Routes + wait estimate).
- Estimates wait time using a simple headcount×minutes heuristic.
  - Headcount can come from camera snapshots (OpenAI Vision) or demo fallbacks.
  - A MySQL table optionally caches recent wait data for the area to avoid recomputation.
- Guides the user through a concise, empathetic chat intake (Groq) and generates a clinic‑friendly PDF.

How it works (high level)
1) Browser requests recommendations with current location.
2) Frontend API either proxies to the backend (`/nearby-hospitals`) or serves mock data if no backend is configured.
3) Backend queries Google Places to find hospitals and Google Routes to compute drive ETAs.
4) For one or more hospitals, the service derives a wait estimate (camera headcount when available; otherwise a demo fallback), and can persist recent values in MySQL.
5) Total minutes = ETA + wait. Results are sorted and returned to the UI.
6) User completes a short AI intake; the server renders a polished PDF and a shareable link/QR.

Modes
- Mock mode (frontend only): quick demo using static hospitals.
- Nearby mode (backend + Google APIs + MySQL): live list ranked by ETA + cached wait.
- Smart/camera mode (optional Vision): counts people in snapshots to refine wait.

Non‑goals and notes
- This is a demo and not a medical device; wait estimates are heuristics for routing, not clinical triage.
- Vision and MySQL are optional but unlock the best experience; Google APIs are required for live ETA.

## Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- Google Cloud API key with Places API + Routes API enabled (backend)
- Groq API key (frontend chat/summary/TTS)
- Optional: MySQL 8+ (backend cache) and OpenAI API key (Vision headcount)

## Quick start (UI only, uses mock data)
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

## Full local setup
### 1) Backend (FastAPI)
Create `backend/.env`:
- Required: `GOOGLE_MAPS_API_KEY`, `OPENAI_API_KEY`, `OPENAI_VISION_MODEL`
- Optional: `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB` (default: hackathon)
- Optional (Vision/cameras): `PRIMARY_CAMERA_ID`, `PRIMARY_CAMERA_URLS` (semicolon-separated), `PER_PERSON_FOR_CAMERA`

Run:
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Optional MySQL schema (for `/nearby-hospitals` caching):
```sql
CREATE DATABASE IF NOT EXISTS hackathon CHARACTER SET utf8mb4;
USE hackathon;
CREATE TABLE IF NOT EXISTS hospitals (
  hospital_id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255),
  lat DOUBLE,
  lng DOUBLE,
  maps_url TEXT,
  last_people INT,
  per_person_minutes INT,
  doctors_working INT,
  estimated_wait_minutes INT,
  wait_last_updated DATETIME,
  updated_at DATETIME
) CHARACTER SET utf8mb4;
```

Key endpoints
- `POST /nearby-hospitals` — Places + Routes + (optional) MySQL cache
- `POST /wait-time` and `GET /wait-time/{id}` — compute/read wait time (in‑memory)
- `POST /smart-nearby` — top‑N by ETA + wait (uses camera URLs or in‑memory fallback)

### 2) Frontend (Next.js)
Create `frontend/.env.local`:
- Required: `GROQ_API_KEY`
- Optional: `BACKEND_HOSPITALS_URL` (e.g. `http://localhost:8000`) to enable live data, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` for map, `GROQ_MODEL`, `GROQ_TTS_*`

Run:
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```
Notes
- Without `BACKEND_HOSPITALS_URL`, the app serves mock hospitals.
- With the backend running and `BACKEND_HOSPITALS_URL` set, the UI ranks hospitals by (travel ETA + wait).

## Troubleshooting
- Google API errors: ensure Places + Routes are enabled and the key isn’t overly restricted.
- MySQL errors: create the `hospitals` table (schema above) or run without calling `/nearby-hospitals`.
