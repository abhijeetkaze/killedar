import importlib.util
import unittest

from killedar_api.adapters.naismith_model import NaismithModel
from killedar_api.adapters.tabpfn_model import MIN_HIKES, NotEnoughHikesError, TabPFNModel
from killedar_api.evaluation import leave_one_out

from .helpers import ConstantRegressor, features, hikes

HAS_TABPFN = importlib.util.find_spec("tabpfn") is not None
HAS_SKLEARN = importlib.util.find_spec("sklearn") is not None


class NaismithModelTest(unittest.TestCase):
    def test_predicts_rule(self):
        self.assertEqual(NaismithModel().predict(features()), 96)
        self.assertEqual(NaismithModel.name, "naismith")


class TabPFNModelTest(unittest.TestCase):
    def test_fits_on_feature_rows_and_durations(self):
        reg = ConstantRegressor(123.0)
        data = hikes(MIN_HIKES)
        model = TabPFNModel(data, make_regressor=lambda: reg)
        self.assertEqual(model.predict(features()), 123.0)
        X, y = reg.fitted_on
        self.assertEqual(X[0], data[0].as_row())
        self.assertEqual(y, [h.duration_min for h in data])

    def test_needs_enough_hikes(self):
        with self.assertRaises(NotEnoughHikesError):
            TabPFNModel(hikes(MIN_HIKES - 1), make_regressor=lambda: ConstantRegressor(1))

    @unittest.skipUnless(HAS_TABPFN, "tabpfn not installed (pip install -r requirements.txt)")
    def test_real_tabpfn_learns_a_slow_hiker(self):
        model = TabPFNModel(hikes(30, slow_factor=1.3))
        predicted = model.predict(features())
        self.assertAlmostEqual(predicted, 96 * 1.3, delta=20)


class EvaluationTest(unittest.TestCase):
    @unittest.skipUnless(HAS_SKLEARN, "scikit-learn not installed")
    def test_a_learned_model_beats_naismith_for_a_consistently_slow_hiker(self):
        from sklearn.linear_model import LinearRegression

        result = leave_one_out(hikes(20, slow_factor=1.3), LinearRegression)
        self.assertLess(result.model_mae_min, result.naismith_mae_min)
        self.assertGreater(result.improvement_pct, 50)

    def test_each_hike_is_held_out(self):
        regs: list[ConstantRegressor] = []

        def make():
            regs.append(ConstantRegressor(0))
            return regs[-1]

        leave_one_out(hikes(5), make)
        self.assertEqual(len(regs), 5)
        self.assertTrue(all(len(r.fitted_on[0]) == 4 for r in regs))

    def test_needs_three_hikes(self):
        with self.assertRaises(ValueError):
            leave_one_out(hikes(2), lambda: ConstantRegressor(0))


if __name__ == "__main__":
    unittest.main()
