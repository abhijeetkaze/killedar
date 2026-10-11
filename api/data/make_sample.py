"""Generates SYNTHETIC hikes so the API runs before you add your own.

The fake hiker is ~20 % slower than Naismith, slows down in bigger groups and in midday heat.

    python data/make_sample.py           # → data/hikes.sample.csv (random distances, used by tests/CI)
    python data/make_sample.py --trails  # → data/hikes.csv (the app's real fort trails, placeholder
                                         #   until you replace it with your Strava/GPX exports)
"""

import csv
import json
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORTS = HERE.parent.parent / "web" / "public" / "forts"


def fake_minutes(rng: random.Random, distance: float, gain: int, start: int, group: int) -> int:
    naismith = distance * 12 + gain / 10
    minutes = naismith * 1.2 + 4 * (group - 1) + 6 * max(0, start - 10) + rng.gauss(0, 8)
    return round(max(minutes, 10))


def random_hikes(rng: random.Random, n: int = 30) -> list[list]:
    rows = []
    for _ in range(n):
        distance = round(rng.uniform(1.0, 8.0), 1)
        gain = rng.randrange(100, 1100, 10)
        start = rng.randint(5, 13)
        group = rng.randint(1, 8)
        rows.append([distance, gain, start, group, fake_minutes(rng, distance, gain, start, group)])
    return rows


def trail_hikes(rng: random.Random, per_trail: int = 5) -> list[list]:
    """Repeat climbs of the trails in web/public/forts, at varied start hours and group sizes."""
    trails = [
        (t["distanceKm"], t["elevationGainM"])
        for path in sorted(FORTS.glob("*.json"))
        if path.name != "index.json"
        for t in json.loads(path.read_text(encoding="utf-8"))["trails"]
    ]
    rows = []
    for distance, gain in trails:
        for _ in range(per_trail):
            start = rng.randint(5, 13)
            group = rng.randint(1, 8)
            rows.append([distance, gain, start, group, fake_minutes(rng, distance, gain, start, group)])
    return rows


def write(out: Path, rows: list[list]) -> None:
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["distance_km", "elevation_gain_m", "start_hour", "group_size", "duration_min"])
        w.writerows(rows)
    print(f"wrote {out} ({len(rows)} synthetic hikes)")


if __name__ == "__main__":
    rng = random.Random(1670)  # seeded: the output is reproducible
    if "--trails" in sys.argv:
        write(HERE / "hikes.csv", trail_hikes(rng))
    else:
        write(HERE / "hikes.sample.csv", random_hikes(rng))
