"""TabPFN (Prior Labs' tabular foundation model), fitted on the hiker's own past hikes.

TabPFN is pre-trained, so "fitting" on 20-50 rows is in-context learning — no training loop,
which is exactly why it suits a personal dataset this small.
"""

from __future__ import annotations

from ..ports import Regressor


def default_regressor() -> Regressor:
    # Imported lazily: tabpfn pulls in torch and downloads weights on first use.
    from tabpfn import TabPFNRegressor  # type: ignore[import-not-found]
    from tabpfn.constants import ModelVersion  # type: ignore[import-not-found]

    # tabpfn >= 2.5 defaults to gated weights that need a TABPFN_TOKEN and a license click-through.
    # v2 is the one version with an open direct download, so it works in CI unattended.
    return TabPFNRegressor.create_default_for_version(ModelVersion.V2, device="cpu")
