"""Generates data/hikes.sample.csv — SYNTHETIC hikes so the API runs before you add your own.

The fake hiker is ~20 % slower than Naismith, slows down in bigger groups and in midday heat.
Replace the file (or set HIKES_CSV) with your real hikes from Strava/GPX exports.

    python data/make_sample.py
"""

import csv
import random
from pathlib import Path

rng = random.Random(1670)  # seeded: the sample is reproducible
rows = []
for _ in range(30):
    distance = round(rng.uniform(1.0, 8.0), 1)
    gain = rng.randrange(100, 1100, 10)
    start = rng.randint(5, 13)
    group = rng.randint(1, 8)
    naismith = distance * 12 + gain / 10
    minutes = naismith * 1.2 + 4 * (group - 1) + 6 * max(0, start - 10) + rng.gauss(0, 8)
    rows.append([distance, gain, start, group, round(max(minutes, 10))])

out = Path(__file__).with_name("hikes.sample.csv")
with out.open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["distance_km", "elevation_gain_m", "start_hour", "group_size", "duration_min"])
    w.writerows(rows)
print(f"wrote {out} ({len(rows)} synthetic hikes)")
