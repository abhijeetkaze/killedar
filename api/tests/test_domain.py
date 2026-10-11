import math
import unittest

from pydantic import ValidationError

from killedar_api.domain import FEATURES, naismith_minutes, sane_minutes

from .helpers import features


class NaismithTest(unittest.TestCase):
    def test_rule(self):
        self.assertEqual(naismith_minutes(5, 0), 60)
        self.assertEqual(naismith_minutes(0, 600), 60)
        self.assertEqual(naismith_minutes(3, 600), 96)

    def test_rejects_negative(self):
        with self.assertRaises(ValueError):
            naismith_minutes(-1, 0)


class HikeFeaturesTest(unittest.TestCase):
    def test_row_follows_feature_order(self):
        self.assertEqual(FEATURES, ("distance_km", "elevation_gain_m", "start_hour", "group_size"))
        self.assertEqual(features().as_row(), [3.0, 600.0, 7.0, 2.0])

    def test_validation(self):
        for bad in ({"distance_km": 0}, {"elevation_gain_m": -1}, {"start_hour": 24}, {"group_size": 0}):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                features(**bad)

    def test_rejects_unknown_fields(self):
        with self.assertRaises(ValidationError):
            features(heart_rate=150)


class SaneMinutesTest(unittest.TestCase):
    def test_passes_reasonable_predictions_rounded(self):
        self.assertEqual(sane_minutes(112.4, features()), 112)

    def test_falls_back_to_baseline_for_nonsense(self):
        for bad in (-5.0, 0.0, math.nan, 10_000.0):
            with self.subTest(bad=bad):
                self.assertEqual(sane_minutes(bad, features()), 96)


if __name__ == "__main__":
    unittest.main()
