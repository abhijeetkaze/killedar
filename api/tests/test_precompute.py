import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from killedar_api.adapters.fort_trails import Trail, load_trails
from killedar_api.precompute import GROUP_SIZES, MIN_HIKES, START_HOURS, NotEnoughHikesError, prediction_table

from .helpers import ConstantRegressor, hikes

HAS_TABPFN = importlib.util.find_spec("tabpfn") is not None
SINHAGAD = Trail(2.7, 600)


class RowEcho:
    """Fake regressor that 'predicts' distance × 100 + start hour + group size / 100, so cells are traceable."""

    def fit(self, X, y):
        return self

    def predict(self, X):
        return [d * 100 + hour + group / 100 for d, _, hour, group in X]


class PredictionTableTest(unittest.TestCase):
    def test_fits_on_feature_rows_and_durations(self):
        reg = ConstantRegressor(123.0)
        data = hikes(MIN_HIKES)
        prediction_table(data, [SINHAGAD], lambda: reg)
        X, y = reg.fitted_on
        self.assertEqual(X[0], data[0].as_row())
        self.assertEqual(y, [h.duration_min for h in data])

    def test_grid_is_indexed_by_start_hour_then_group_size(self):
        table = prediction_table(hikes(MIN_HIKES), [Trail(1, 180), SINHAGAD], RowEcho)
        self.assertEqual(table["startHours"], [4, 14])
        self.assertEqual(table["groupSizes"], [1, 30])
        self.assertEqual(table["hikes"], MIN_HIKES)
        sinhagad = table["trails"][1]
        self.assertEqual((sinhagad["distanceKm"], sinhagad["elevationGainM"]), (2.7, 600))
        self.assertEqual(len(sinhagad["minutes"]), len(START_HOURS))
        self.assertEqual(len(sinhagad["minutes"][0]), len(GROUP_SIZES))
        # 7 am (row 3), group of 5 (column 4): 2.7 × 100 + 7 + 0.05, rounded
        self.assertEqual(sinhagad["minutes"][7 - 4][5 - 1], 277)
        self.assertEqual(table["trails"][0]["minutes"][0][0], 104)  # 1 km trail, 4 am, solo

    def test_duplicate_trails_appear_once(self):
        table = prediction_table(hikes(MIN_HIKES), [SINHAGAD, SINHAGAD], RowEcho)
        self.assertEqual(len(table["trails"]), 1)

    def test_nonsense_predictions_fall_back_to_naismith(self):
        table = prediction_table(hikes(MIN_HIKES), [SINHAGAD], lambda: ConstantRegressor(-5))
        self.assertEqual(table["trails"][0]["minutes"][0][0], 92)

    def test_needs_enough_hikes(self):
        with self.assertRaises(NotEnoughHikesError):
            prediction_table(hikes(MIN_HIKES - 1), [SINHAGAD], lambda: ConstantRegressor(1))

    def test_is_plain_json(self):
        json.dumps(prediction_table(hikes(MIN_HIKES), [SINHAGAD], RowEcho))

    @unittest.skipUnless(HAS_TABPFN, "tabpfn not installed (pip install -r requirements.txt)")
    def test_real_tabpfn_learns_a_slow_hiker(self):
        from killedar_api.adapters.tabpfn_model import default_regressor

        table = prediction_table(hikes(30, slow_factor=1.3), [Trail(3.0, 600)], default_regressor)
        self.assertAlmostEqual(table["trails"][0]["minutes"][7 - 4][2 - 1], 96 * 1.3, delta=20)


class LoadTrailsTest(unittest.TestCase):
    def test_reads_every_fort_but_the_index(self):
        with tempfile.TemporaryDirectory() as d:
            forts = Path(d)
            (forts / "index.json").write_text("[]")
            (forts / "a.json").write_text(json.dumps({"trails": [{"distanceKm": 2.7, "elevationGainM": 600}]}))
            (forts / "b.json").write_text(json.dumps({"trails": [{"distanceKm": 6, "elevationGainM": 450}]}))
            self.assertEqual(load_trails(forts), [SINHAGAD, Trail(6, 450)])

    def test_reads_the_apps_real_forts(self):
        forts = Path(__file__).resolve().parents[2] / "web" / "public" / "forts"
        self.assertIn(SINHAGAD, load_trails(forts))


if __name__ == "__main__":
    unittest.main()
