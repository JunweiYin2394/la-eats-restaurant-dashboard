#!/usr/bin/env python3
"""
Pre-compute road-network routes from each census tract centroid to its
nearest qualifying restaurant, using the OSRM public API.

Outputs: public/data/routes_walking.geojson
         public/data/routes_cycling.geojson
         public/data/routes_driving.geojson

Run: python3 build_routes.py
"""

import json, csv, math, time
from pathlib import Path
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor, as_completed

DATA_DIR   = Path("public/data")
MIN_SCORE  = 90
MAX_DIST   = 15       # km — skip tracts too far from any restaurant
WORKERS    = 50       # parallel HTTP workers
SAVE_EVERY = 200      # checkpoint every N completed tracts

OSRM_BASE = "https://router.project-osrm.org/route/v1"
PROFILES  = {"walking": "foot", "cycling": "bike", "driving": "car"}


def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat, dlon = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(min(a, 1.0)))


def osrm_route(profile, olon, olat, dlon, dlat):
    url = f"{OSRM_BASE}/{profile}/{olon:.6f},{olat:.6f};{dlon:.6f},{dlat:.6f}?overview=full&geometries=geojson"
    for wait in (0, 2, 5):
        try:
            if wait:
                time.sleep(wait)
            with urlopen(url, timeout=20) as r:
                data = json.loads(r.read())
            if data.get("code") == "Ok" and data.get("routes"):
                rt = data["routes"][0]
                return rt["geometry"]["coordinates"], round(rt["duration"]/60, 1)
            return None, None
        except Exception:
            pass
    return None, None


def process_tract(args):
    feat, restaurants = args
    p = feat["properties"]
    clat, clon = p["lat"], p["lon"]

    # find nearest qualifying restaurant
    best, best_d = None, float("inf")
    for r in restaurants:
        d = haversine(clat, clon, r["lat"], r["lon"])
        if d < best_d:
            best_d = d; best = r
    if best_d > MAX_DIST:
        return feat, {}

    results = {}
    for mode, profile in PROFILES.items():
        coords, dur = osrm_route(profile, clon, clat, best["lon"], best["lat"])
        if coords:
            results[mode] = {
                "type": "Feature",
                "properties": {
                    "GEOID": p.get("GEOID"),
                    "durationMin": dur,
                    "distKm": round(best_d, 2),
                    "targetScore": best["score"],
                    "walkMin":  p.get("walkMin"),
                    "bikeMin":  p.get("bikeMin"),
                    "driveMin": p.get("driveMin"),
                },
                "geometry": {"type": "LineString", "coordinates": coords},
            }
    return feat, results


def save(features_by_mode):
    for mode, feats in features_by_mode.items():
        with open(DATA_DIR / f"routes_{mode}.geojson", "w") as f:
            json.dump({"type": "FeatureCollection", "features": feats}, f)


def main():
    print("Loading restaurants...")
    rests = []
    with open(DATA_DIR / "restaurants_with_coords.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                s = int(row.get("SCORE") or 0)
                la = float(row.get("latitude") or "")
                lo = float(row.get("longitude") or "")
                if s >= MIN_SCORE and abs(la) <= 90 and abs(lo) <= 180:
                    rests.append({"lat": la, "lon": lo, "score": s})
            except (ValueError, TypeError):
                pass
    print(f"  {len(rests)} restaurants (score >= {MIN_SCORE})")

    print("Loading tracts...")
    with open(DATA_DIR / "la_tracts_merged.geojson", encoding="utf-8") as f:
        tracts = json.load(f)["features"]
    print(f"  {len(tracts)} tracts\n")

    routes = {"walking": [], "cycling": [], "driving": []}
    done, skipped = 0, 0
    t0 = time.time()

    jobs = [(feat, rests) for feat in tracts]

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futures = {ex.submit(process_tract, job): job for job in jobs}
        for future in as_completed(futures):
            _, result = future.result()
            done += 1
            if not result:
                skipped += 1
            else:
                for mode, feat in result.items():
                    routes[mode].append(feat)

            if done % SAVE_EVERY == 0:
                save(routes)
                elapsed = time.time() - t0
                rate = done / elapsed
                eta = (len(tracts) - done) / rate / 60
                print(f"  [{done}/{len(tracts)}]  walk={len(routes['walking'])}  "
                      f"bike={len(routes['cycling'])}  drive={len(routes['driving'])}  "
                      f"ETA ~{eta:.0f} min")

    save(routes)
    elapsed = (time.time() - t0) / 60
    print(f"\nDone in {elapsed:.1f} min  |  skipped {skipped} tracts (> {MAX_DIST} km)")
    for mode in routes:
        p = DATA_DIR / f"routes_{mode}.geojson"
        print(f"  {p.name}: {len(routes[mode])} routes, {p.stat().st_size//1024} KB")


if __name__ == "__main__":
    main()
