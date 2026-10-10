"""Ports: what the application needs from the outside world."""

from __future__ import annotations

from typing import Protocol, Sequence

from .domain import HikeFeatures, ModelName


class ClimbTimeModel(Protocol):
    """Predicts ascent minutes for one hiker."""

    name: ModelName

    def predict(self, features: HikeFeatures) -> float: ...


class Regressor(Protocol):
    """The sklearn-style surface TabPFN exposes. Lets tests swap in any regressor."""

    def fit(self, X: Sequence[Sequence[float]], y: Sequence[float]) -> object: ...

    def predict(self, X: Sequence[Sequence[float]]) -> Sequence[float]: ...
