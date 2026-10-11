"""Runs TabPFN once, ahead of time, and writes its climb-time predictions as a table the PWA ships.

TabPFN can't run in a phone browser, but the app only ever asks about the trails it knows, at a
start hour and group size from the Plan screen's small ranges. So every question is answered up
front, here, and the answers work offline on the fort.

    python -m killedar_api.precompute data/hikes.csv   # → ../web/public/predictions.json
"""

from __future__ import annotations

from typing import Callable, Sequence

from .adapters.fort_trails import Trail
from .domain import Hike, HikeFeatures, sane_minutes
from .ports import Regressor

MIN_HIKES = 8
START_HOURS = range(4, 15)  # the Plan screen's start-hour input (views.ts)
GROUP_SIZES = range(1, 31)  # and its group-size input


class NotEnoughHikesError(ValueError):
    pass


def prediction_table(hikes: Sequence[Hike], trails: Sequence[Trail], make_regressor: Callable[[], Regressor]) -> dict:
    """{"trails": [{distanceKm, elevationGainM, minutes[hour][group]}], ...}, minutes rounded and sane."""
    if len(hikes) < MIN_HIKES:
        raise NotEnoughHikesError(f"Need at least {MIN_HIKES} past hikes, got {len(hikes)}")
    regressor = make_regressor()
    regressor.fit([h.as_row() for h in hikes], [h.duration_min for h in hikes])

    unique = list(dict.fromkeys(trails))
    grid = [
        HikeFeatures(distance_km=t.distance_km, elevation_gain_m=t.elevation_gain_m, start_hour=hour, group_size=group)
        for t in unique
        for hour in START_HOURS
        for group in GROUP_SIZES
    ]
    predicted = regressor.predict([f.as_row() for f in grid])  # one batch: TabPFN is slow per call
    minutes = [int(sane_minutes(float(p), f)) for p, f in zip(predicted, grid, strict=True)]

    groups = len(GROUP_SIZES)
    per_trail = len(START_HOURS) * groups
    return {
        "model": "tabpfn",
        "hikes": len(hikes),
        "startHours": [START_HOURS.start, START_HOURS.stop - 1],
        "groupSizes": [GROUP_SIZES.start, GROUP_SIZES.stop - 1],
        "trails": [
            {
                "distanceKm": t.distance_km,
                "elevationGainM": t.elevation_gain_m,
                "minutes": [minutes[start : start + groups] for start in range(i * per_trail, (i + 1) * per_trail, groups)],
            }
            for i, t in enumerate(unique)
        ],
    }


if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    from .adapters.csv_hikes import load_hikes
    from .adapters.fort_trails import load_trails
    from .adapters.tabpfn_model import default_regressor

    root = Path(__file__).resolve().parent.parent
    hikes_csv = Path(sys.argv[1] if len(sys.argv) > 1 else root / "data" / "hikes.csv")
    public = root.parent / "web" / "public"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else public / "predictions.json"

    table = prediction_table(load_hikes(hikes_csv), load_trails(public / "forts"), default_regressor)
    out.write_text(json.dumps(table, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"wrote {out}: {len(table['trails'])} trails from {table['hikes']} hikes")
