# Backend

Welcome to the **Backend** repository! This project is focused on utilizing AI to enhance healthcare efficiency by estimating hospital wait times and providing recommendations based on real-time data.

## Overview

The backend is a Python-based API solution that processes data from hospital cameras, integrates with external APIs to calculate travel times, and provides users with estimated total times (ETA) for hospitals. The primary goal is to help patients make informed decisions by combining:

- **Drive ETA**: Estimated time to drive to the hospital.
- **Live Wait Time**: Calculated wait time based on real-time data.

---

## Features

### 1. **Hospital Wait Time Estimation**
- Uses base64-encoded images from hospital cameras to count the number of people in waiting areas.
- Calculates wait time based on the average time spent per person.

### 2. **Drive ETA Calculation**
- Integrates with the Google Distance Matrix API to calculate travel times.
- Uses traffic-aware optimal routing to ensure accurate ETAs.

### 3. **Top-N Hospital Recommendations**
- Combines drive ETA and live estimated wait-time using Computer Vision into a single total time metric.
- Sorts and ranks hospitals based on this metric to recommend the best options.

---

## Algorithms and Techniques

### Wait Time Estimation (with parallel doctors)

We treat each hospital as a single queue served by **c** doctors in parallel. When we can, we count people from **live camera frames**; otherwise we use the **MySQL cache** or a bounded **RNG** fallback.

**Steps**

1. **Capture & count (primary hospital only when stale/missing)**

   * Grab fresh JPEGs from `PRIMARY_CAMERA_URLS` and Base64 them.
   * Count people with OpenAI Vision and parse `{"people": <int>}`.
   * Persist to MySQL with `wait_last_updated` (so RNG never overwrites it while fresh).

   ```python
   img_b64 = base64.b64encode(jpeg_bytes).decode("ascii")
   people  = _count_people_from_image_b64(img_b64, require_openai=True)  # strict, JSON result
   ```

2. **Doctors working (capacity)**

   * NOTE: This is just a mockup, due to time constraints, we are unable to implement value of doctors extraction from clock in system.
   * Reuse `doctors_working` from MySQL if present, else RNG **1–20** for the day.
   * This models parallel service (multiple patients at once).

3. **Per‑patient minutes**

   * For camera: `PER_PERSON_FOR_CAMERA` (env, e.g. 10).
   * For RNG fallback: bounded RNG **8–15** minutes.

4. **Queue time (parallel)**
   We approximate the rounds of service using **ceiling**:

   ```python
   from math import ceil
   wait_minutes = int(ceil(people / max(1, doctors_working)) * per_person_minutes)
   ```

   Examples

   * `people=26, doctors=5, per_person=12 → ceil(26/5)=6 → 6*12 = 72 min`
   * `people=8, doctors=2, per_person=10 → ceil(8/2)=4 → 4*10 = 40 min`

5. **Cache freshness (5‑minute TTL)**

   * If `wait_last_updated` ≤ `CACHE_TTL_SECONDS` (default 300s), we **reuse** the row (no camera call).
   * RNG is used **only** when no fresh wait exists; it never overwrites fresh camera data.

---

### Drive ETA Calculation (Google Routes)

We compute time and distance with Google’s **Distance Matrix** (traffic‑aware):

```python
url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
# ...
dur_s   = parse_duration(row["duration"])     # e.g., "542s" → 542.0
eta_min = round(dur_s / 60.0, 1)
dist_km = round(row["distanceMeters"] / 1000.0, 2)
```

Only rows with `condition == "ROUTE_EXISTS"` are used; others are ignored.

---

### Total Estimated Time

For ranking the best choice:

```python
total_time_minutes = eta_minutes + wait_minutes
```

* If either term is missing, we leave `total_time_minutes` undefined and don’t rank by it.
* `/smart-nearby` sorts by this total; `/nearby-hospitals` returns ETA and Wait so the UI can show a total.

---

### Fallback & Guardrails

* **OpenAI unavailable?** Camera endpoint returns an error; list view uses RNG **only** for hospitals without a fresh wait.
* **RNG bounds** (when needed):
  `people: 20–40`, `per_person_minutes: 21–30`, `doctors_working: 1–20`, then the **same parallel formula** above.
  References: https://www.researchgate.net/publication/317068006_An_assessment_of_patient_waiting_and_consultation_time_in_a_primary_healthcare_clinic#:~:text=Studies%20from%20abroad%20have%20shown,ORIGINAL%20ARTICLE
  <br>
  <img width="373" height="369" alt="image" src="https://github.com/user-attachments/assets/495c3f15-f2f9-48b7-ae62-28c99d1e636c" />
* **Zero/edge cases:**
  `doctors_working` is clamped with `max(1, doctors_working)`; `people=0 → wait=0`.

---

## Technical Details

### APIs Used
- **Google Distance Matrix API**: For calculating real-time drive ETAs.
- **Custom API Endpoints**: Built with FastAPI for:
  - Uploading images and computing wait times.
  - Fetching nearby hospitals with caching logic (5-minute TTL).

### Data Models
- **WaitTimeIn**: Input model for uploading images.
- **WaitTimeOut**: Output model for computed wait times.
- **SmartQuery**: Query model for hospital recommendations.

### Randomization for Demo Scenarios
Fallback values are used for randomization in demo scenarios:
- Number of people: `random.randint(20, 80)`
- Doctors available: `random.randint(1, 20)`
- Wait time per person: `random.randint(8, 15)`

---

## Folder Structure
- **apis/**:
  - `wait_time.py`: Handles image upload and wait time computation.
  - `recommend.py`: Manages hospital recommendation logic.
  - `nearby.py`: Provides nearby hospital data with caching.

---

## How to Run

1. Clone the repository:
   ```bash
   git clone https://github.com/terryong31/ai-tinkerers-hackathon.git
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

---

## Future Enhancements
- Integration with advanced AI models for more accurate person detection.
- Real-time updates with WebSocket support.
- Improved caching mechanisms for API responses.

---

## Acknowledgements
Special thanks to the AI Tinkerers community for their efforts and contributions to this project.
