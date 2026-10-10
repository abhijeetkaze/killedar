"""TabPFN (Prior Labs' tabular foundation model) fitted on the hiker's own past hikes.

TabPFN is pre-trained, so "fitting" on 20-50 rows is in-context learning — no training loop,
which is exactly why it suits a personal dataset this small.
"""

from __future__ import annotations

from typing import Callable, Sequence

from ..domain import Hike, HikeFeatures, ModelName
from ..ports import Regressor

MIN_HIKES = 8


class NotEnoughHikesError(ValueError):
    pass


def default_regressor() -> Regressor:
    # Imported lazily: tabpfn pulls in torch and downloads weights on first use.
    from tabpfn import TabPFNRegressor  # type: ignore[import-not-found]

    return TabPFNRegressor(device="cpu")


class TabPFNModel:
    name: ModelName = "tabpfn"

    def __init__(self, hikes: Sequence[Hike], make_regressor: Callable[[], Regressor] = default_regressor) -> None:
        if len(hikes) < MIN_HIKES:
            raise NotEnoughHikesError(f"Need at least {MIN_HIKES} past hikes, got {len(hikes)}")
        self._regressor = make_regressor()
        self._regressor.fit([h.as_row() for h in hikes], [h.duration_min for h in hikes])

    def predict(self, features: HikeFeatures) -> float:
        return float(self._regressor.predict([features.as_row()])[0])
