from __future__ import annotations

from ..domain import HikeFeatures, ModelName, naismith_minutes


class NaismithModel:
    """Rule-of-thumb fallback when TabPFN isn't installed or there isn't enough hike data."""

    name: ModelName = "naismith"

    def predict(self, features: HikeFeatures) -> float:
        return naismith_minutes(features.distance_km, features.elevation_gain_m)
