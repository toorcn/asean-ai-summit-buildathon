#!/usr/bin/env python3
import argparse
import sys
import requests
from typing import Any, Dict, List

def fetch_hospitals(url: str, lat: float, lng: float, timeout: int = 30) -> Dict[str, Any]:
    """POST to the FastAPI endpoint and return the parsed JSON."""
    try:
        resp = requests.post(url, json={"lat": lat, "lng": lng}, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        sys.stderr.write(f"[error] Request failed: {e}\n")
        sys.exit(2)
    except ValueError:
        sys.stderr.write("[error] Response was not valid JSON.\n")
        sys.exit(3)

def format_minutes(v: Any) -> str:
    if v is None:
        return "-"
    try:
        return f"{int(round(float(v)))} min"
    except Exception:
        return str(v)

def format_km(v: Any) -> str:
    if v is None:
        return "-"
    try:
        return f"{float(v):.1f} km"
    except Exception:
        return str(v)

def print_hospitals(data: Dict[str, Any]) -> None:
    items: List[Dict[str, Any]] = data.get("hospitals", [])
    count = data.get("count", len(items))
    if not items:
        print("No hospitals returned.")
        return

    # Column headers
    headers = ["#", "Hospital", "ETA", "Distance", "Maps Link"]
    rows: List[List[str]] = []
    for i, h in enumerate(items, start=1):
        name = h.get("hospital_name") or h.get("name") or "Unnamed"
        eta = format_minutes(h.get("eta_minutes"))
        dist = format_km(h.get("distance_km"))
        link = h.get("google_maps_location_link") or h.get("maps_url") or ""
        rows.append([str(i), name, eta, dist, link])

    # Compute column widths (cap hospital name for readability)
    max_name_len = 60
    rows = [[r[0], (r[1][:max_name_len] + "…") if len(r[1]) > max_name_len else r[1], r[2], r[3], r[4]] for r in rows]

    col_widths = [max(len(h), *(len(r[c]) for r in rows)) for c, h in enumerate(headers)]
    line = "  ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    sep = "-" * len(line)

    print(f"Total hospitals: {count}\n")
    print(line)
    print(sep)
    for r in rows:
        print("  ".join(r[i].ljust(col_widths[i]) for i in range(len(headers))))

def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch nearby hospitals from local FastAPI and print to terminal.")
    parser.add_argument("--url", default="http://localhost:1234/nearby-hospitals",
                        help="Endpoint URL (POST). Default: %(default)s")
    parser.add_argument("--lat", type=float, default=3.1390, help="Latitude. Default: Kuala Lumpur (3.1390)")
    parser.add_argument("--lng", type=float, default=101.6869, help="Longitude. Default: Kuala Lumpur (101.6869)")
    args = parser.parse_args()

    data = fetch_hospitals(args.url, args.lat, args.lng)
    print_hospitals(data)

if __name__ == "__main__":
    main()
