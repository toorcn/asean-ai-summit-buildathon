#!/usr/bin/env python3
import argparse, json, requests, sys

def main():
    p = argparse.ArgumentParser(description="Call /smart-nearby and print top hospitals by (drive ETA + wait).")
    p.add_argument("--url", default="http://localhost:1234/smart-nearby", help="Endpoint URL")
    p.add_argument("--lat", type=float, default=3.1390)
    p.add_argument("--lng", type=float, default=101.6869)
    p.add_argument("--limit", type=int, default=5)
    p.add_argument("--maxc", type=int, default=12, help="max candidates to consider")
    p.add_argument("--cams", type=str, default="", help="Path to JSON mapping hospital_id -> [camera_url, ...]")
    args = p.parse_args()

    cams = None
    if args.cams:
        with open(args.cams, "r", encoding="utf-8") as f:
            cams = json.load(f)

    body = {
        "lat": args.lat,
        "lng": args.lng,
        "limit": args.limit,
        "max_candidates": args.maxc,
    }
    if cams:
        body["cameras_by_hospital"] = cams

    try:
        r = requests.post(args.url, json=body, timeout=60)
        r.raise_for_status()
        print(json.dumps(r.json(), indent=2))
    except Exception as e:
        sys.stderr.write(f"[error] {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
