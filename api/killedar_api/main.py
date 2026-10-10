"""Composition root. `uvicorn killedar_api.main:app`

Env:
  HIKES_CSV                 path to your hikes (default: data/hikes.sample.csv, synthetic)
  KILLEDAR_ALLOWED_ORIGINS  comma-separated web origins allowed to call the API
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from .adapters.csv_hikes import HikeFileError, load_hikes
from .adapters.naismith_model import NaismithModel
from .adapters.tabpfn_model import NotEnoughHikesError, TabPFNModel
from .app import create_app
from .ports import ClimbTimeModel

log = logging.getLogger("killedar")
ROOT = Path(__file__).resolve().parent.parent


def build_model(hikes_csv: Path) -> ClimbTimeModel:
    try:
        model = TabPFNModel(load_hikes(hikes_csv))
        log.info("Using TabPFN fitted on %s", hikes_csv.name)
        return model
    except ImportError:
        log.warning("tabpfn not installed; using Naismith's rule")
    except FileNotFoundError:
        log.warning("%s not found; using Naismith's rule", hikes_csv)
    except (HikeFileError, NotEnoughHikesError) as e:
        log.warning("%s; using Naismith's rule", e)
    return NaismithModel()


def origins_from_env(value: str | None) -> list[str]:
    return [o.strip().rstrip("/") for o in (value or "").split(",") if o.strip()]


app = create_app(
    build_model(Path(os.environ.get("HIKES_CSV", ROOT / "data" / "hikes.sample.csv"))),
    origins_from_env(os.environ.get("KILLEDAR_ALLOWED_ORIGINS")),
)
