"""Reads the trails out of the PWA's fort data (web/public/forts/*.json)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Trail:
    distance_km: float
    elevation_gain_m: float


def load_trails(forts_dir: Path) -> list[Trail]:
    trails: list[Trail] = []
    for path in sorted(forts_dir.glob("*.json")):
        if path.name == "index.json":
            continue
        fort = json.loads(path.read_text(encoding="utf-8"))
        trails += [Trail(t["distanceKm"], t["elevationGainM"]) for t in fort["trails"]]
    return trails
