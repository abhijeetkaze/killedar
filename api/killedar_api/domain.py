"""Domain model. Pure: no I/O, no ML library imports."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FEATURES: tuple[str, ...] = ("distance_km", "elevation_gain_m", "start_hour", "group_size")

ModelName = Literal["tabpfn", "naismith"]


class HikeFeatures(BaseModel):
    """What we know about a climb before starting it."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    distance_km: float = Field(gt=0, le=50)
    elevation_gain_m: float = Field(ge=0, le=3000)
    start_hour: int = Field(ge=0, le=23)
    group_size: int = Field(ge=1, le=50)

    def as_row(self) -> list[float]:
        return [float(getattr(self, f)) for f in FEATURES]


class Hike(HikeFeatures):
    """A past climb with how long it actually took (trailhead to summit)."""

    duration_min: float = Field(gt=0, le=24 * 60)


class Prediction(BaseModel):
    minutes: float
    baseline_minutes: float
    model: ModelName


def naismith_minutes(distance_km: float, elevation_gain_m: float) -> float:
    """Naismith's rule: 1 h per 5 km + 1 h per 600 m of ascent. The baseline to beat."""
    if distance_km < 0 or elevation_gain_m < 0:
        raise ValueError("distance and gain must be >= 0")
    return float(round(distance_km * 12 + elevation_gain_m / 10))


def sane_minutes(predicted: float, features: HikeFeatures) -> float:
    """Never return a non-positive or absurd time; fall back to the baseline if the model misbehaves."""
    baseline = naismith_minutes(features.distance_km, features.elevation_gain_m)
    if not (predicted == predicted) or predicted <= 0 or predicted > 10 * max(baseline, 30):  # NaN check first
        return baseline
    return float(round(predicted))
