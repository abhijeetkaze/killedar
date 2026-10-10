import unittest
from unittest import mock

from starlette.testclient import TestClient

from killedar_api import main
from killedar_api.adapters.naismith_model import NaismithModel
from killedar_api.app import create_app

from .helpers import FixedModel

BODY = {"distance_km": 3, "elevation_gain_m": 600, "start_hour": 7, "group_size": 2}
ORIGIN = "https://killedar.onrender.com"


class PredictEndpointTest(unittest.TestCase):
    def client(self, model=None):
        return TestClient(create_app(model or FixedModel(112.4), [ORIGIN]))

    def test_health_reports_model(self):
        self.assertEqual(self.client().get("/health").json(), {"status": "ok", "model": "tabpfn"})

    def test_predicts_with_baseline(self):
        res = self.client().post("/predict", json=BODY)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"minutes": 112, "baseline_minutes": 96, "model": "tabpfn"})

    def test_naismith_model(self):
        res = self.client(NaismithModel()).post("/predict", json=BODY)
        self.assertEqual(res.json(), {"minutes": 96, "baseline_minutes": 96, "model": "naismith"})

    def test_guards_against_a_misbehaving_model(self):
        self.assertEqual(self.client(FixedModel(-3)).post("/predict", json=BODY).json()["minutes"], 96)

    def test_invalid_fields_are_named(self):
        res = self.client().post("/predict", json={**BODY, "start_hour": 30, "extra": 1})
        self.assertEqual(res.status_code, 422)
        self.assertEqual(res.json()["fields"], ["extra", "start_hour"])

    def test_bad_json_and_oversized_bodies(self):
        c = self.client()
        self.assertEqual(c.post("/predict", content=b"{nope", headers={"content-type": "application/json"}).status_code, 400)
        self.assertEqual(c.post("/predict", content=b"x" * 5000).status_code, 413)
        self.assertEqual(c.post("/predict", content=b"").status_code, 422)

    def test_cors_only_for_allowed_origin(self):
        c = self.client()
        ok = c.post("/predict", json=BODY, headers={"origin": ORIGIN})
        self.assertEqual(ok.headers.get("access-control-allow-origin"), ORIGIN)
        other = c.post("/predict", json=BODY, headers={"origin": "https://evil.example"})
        self.assertIsNone(other.headers.get("access-control-allow-origin"))

    def test_only_post_predict(self):
        self.assertEqual(self.client().get("/predict").status_code, 405)


class CompositionTest(unittest.TestCase):
    def test_falls_back_to_naismith_without_tabpfn(self):
        with mock.patch.object(main, "TabPFNModel", side_effect=ImportError("no tabpfn")):
            self.assertIsInstance(main.build_model(main.ROOT / "data" / "hikes.sample.csv"), NaismithModel)

    def test_falls_back_to_naismith_with_too_few_hikes(self):
        from killedar_api.adapters.tabpfn_model import NotEnoughHikesError

        with mock.patch.object(main, "TabPFNModel", side_effect=NotEnoughHikesError("few")):
            self.assertIsInstance(main.build_model(main.ROOT / "data" / "hikes.sample.csv"), NaismithModel)

    def test_falls_back_to_naismith_when_hikes_file_is_missing(self):
        self.assertIsInstance(main.build_model(main.ROOT / "data" / "does-not-exist.csv"), NaismithModel)

    def test_origins_from_env(self):
        self.assertEqual(main.origins_from_env(" https://a.com/, https://b.com ,"), ["https://a.com", "https://b.com"])
        self.assertEqual(main.origins_from_env(None), [])


if __name__ == "__main__":
    unittest.main()
