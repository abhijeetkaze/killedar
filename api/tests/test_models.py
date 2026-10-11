import importlib.util
import unittest

from killedar_api.evaluation import leave_one_out

from .helpers import ConstantRegressor, hikes

HAS_SKLEARN = importlib.util.find_spec("sklearn") is not None


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
