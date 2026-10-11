from __future__ import annotations

from typing import Sequence

from killedar_api.domain import Hike, HikeFeatures


def features(**overrides: float) -> HikeFeatures:
    base = {"distance_km": 3.0, "elevation_gain_m": 600.0, "start_hour": 7, "group_size": 2}
    return HikeFeatures(**{**base, **overrides})


def hikes(n: int, slow_factor: float = 1.25) -> list[Hike]:
    """Deterministic hiker who is `slow_factor` × Naismith."""
    out = []
    for i in range(n):
        d = 1.0 + (i % 7)
        g = 100.0 + 90 * (i % 11)
        out.append(Hike(distance_km=d, elevation_gain_m=g, start_hour=6 + i % 6, group_size=1 + i % 4,
                        duration_min=round((d * 12 + g / 10) * slow_factor, 1)))
    return out


class ConstantRegressor:
    """Fake regressor: remembers what it was fitted on, always predicts `value`."""

    def __init__(self, value: float) -> None:
        self.value = value
        self.fitted_on: tuple[list, list] | None = None

    def fit(self, X: Sequence[Sequence[float]], y: Sequence[float]) -> "ConstantRegressor":
        self.fitted_on = (list(X), list(y))
        return self

    def predict(self, X: Sequence[Sequence[float]]) -> list[float]:
        return [self.value for _ in X]

