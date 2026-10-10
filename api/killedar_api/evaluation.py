"""Leave-one-out comparison of TabPFN against Naismith's rule — the numbers for the write-up."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Sequence

from .domain import Hike, naismith_minutes
from .ports import Regressor


@dataclass(frozen=True)
class Evaluation:
    hikes: int
    model_mae_min: float
    naismith_mae_min: float

    @property
    def improvement_pct(self) -> float:
        if self.naismith_mae_min == 0:
            return 0.0
        return round(100 * (1 - self.model_mae_min / self.naismith_mae_min), 1)


def leave_one_out(hikes: Sequence[Hike], make_regressor: Callable[[], Regressor]) -> Evaluation:
    """Each hike is predicted by a model that never saw it."""
    if len(hikes) < 3:
        raise ValueError("Need at least 3 hikes to evaluate")
    model_err = naismith_err = 0.0
    for i, held_out in enumerate(hikes):
        train = [h for j, h in enumerate(hikes) if j != i]
        reg = make_regressor()
        reg.fit([h.as_row() for h in train], [h.duration_min for h in train])
        predicted = float(reg.predict([held_out.as_row()])[0])
        model_err += abs(predicted - held_out.duration_min)
        naismith_err += abs(naismith_minutes(held_out.distance_km, held_out.elevation_gain_m) - held_out.duration_min)
    n = len(hikes)
    return Evaluation(hikes=n, model_mae_min=round(model_err / n, 1), naismith_mae_min=round(naismith_err / n, 1))


if __name__ == "__main__":  # python -m killedar_api.evaluation data/hikes.csv
    import sys
    from pathlib import Path

    from .adapters.csv_hikes import load_hikes
    from .adapters.tabpfn_model import default_regressor

    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/hikes.sample.csv")
    result = leave_one_out(load_hikes(path), default_regressor)
    print(f"{result.hikes} hikes, leave-one-out mean absolute error:")
    print(f"  TabPFN    {result.model_mae_min:6.1f} min")
    print(f"  Naismith  {result.naismith_mae_min:6.1f} min")
    print(f"  TabPFN is {result.improvement_pct}% more accurate")
