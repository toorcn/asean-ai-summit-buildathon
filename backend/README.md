# AI Tinkerers Hackathon

Welcome to the **AI Tinkerers Hackathon** repository! This project is focused on utilizing AI to enhance healthcare efficiency by estimating hospital wait times and providing recommendations based on real-time data.

## Overview

The repository is a Python-based solution that processes data from hospital cameras, integrates with external APIs to calculate travel times, and provides users with estimated total times (ETA) for hospitals. The primary goal is to help patients make informed decisions by combining:

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
- Combines drive ETA and live wait-time into a single total time metric.
- Sorts and ranks hospitals based on this metric to recommend the best options.

---

## Algorithms and Techniques

### Wait Time Estimation
The wait time estimation is calculated using the following logic:
1. Decode base64 images to count the number of people in the waiting area.
   ```python
   n = _count_people_from_image_b64(cam.image_b64)
   ```
2. Use a random fallback or predefined values if real-time data is unavailable:
   ```python
   per_person = payload.per_person_minutes or random.randint(11, 20)
   ```
3. Total estimated wait time:
   ```python
   est_wait = int(total_people * per_person)
   ```

### Drive ETA Calculation
1. Uses the Google Distance Matrix API for travel time estimates:
   ```python
   url = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
   ```
2. Parses and converts the returned duration (in seconds) from the API to minutes:
   ```python
   eta_min = round(float(dur.rstrip("s")) / 60.0, 1)
   ```

### Total ETA Calculation
Combines both wait time and drive ETA:
```python
h.total_time_minutes = float(h.eta_minutes) + float(wait)
```

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
