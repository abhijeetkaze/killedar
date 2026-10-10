from __future__ import annotations

import csv
from pathlib import Path

from pydantic import ValidationError

from ..domain import FEATURES, Hike

COLUMNS = (*FEATURES, "duration_min")


class HikeFileError(ValueError):
    pass


def load_hikes(path: Path) -> list[Hike]:
    """Reads a hikes CSV, reporting bad rows by line number so they're easy to fix by hand."""
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
        if missing:
            raise HikeFileError(f"{path.name}: missing column(s) {', '.join(missing)}")
        hikes: list[Hike] = []
        problems: list[str] = []
        for line, row in enumerate(reader, start=2):
            try:
                hikes.append(Hike(**{c: row[c] for c in COLUMNS}))
            except ValidationError as e:
                fields = ", ".join(str(err["loc"][0]) for err in e.errors())
                problems.append(f"line {line}: bad {fields}")
    if problems:
        raise HikeFileError(f"{path.name}: " + "; ".join(problems))
    return hikes
