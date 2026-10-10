import tempfile
import unittest
from pathlib import Path

from killedar_api.adapters.csv_hikes import HikeFileError, load_hikes
from killedar_api.adapters.tabpfn_model import MIN_HIKES

SAMPLE = Path(__file__).resolve().parent.parent / "data" / "hikes.sample.csv"
HEADER = "distance_km,elevation_gain_m,start_hour,group_size,duration_min\n"


class LoadHikesTest(unittest.TestCase):
    def write(self, text: str) -> Path:
        d = tempfile.mkdtemp()
        p = Path(d) / "hikes.csv"
        p.write_text(text, encoding="utf-8")
        return p

    def test_reads_valid_rows(self):
        hikes = load_hikes(self.write(HEADER + "3.0,600,7,2,110\n2.5,450,6,1,95\n"))
        self.assertEqual(len(hikes), 2)
        self.assertEqual(hikes[0].duration_min, 110)

    def test_reports_bad_rows_by_line(self):
        with self.assertRaises(HikeFileError) as ctx:
            load_hikes(self.write(HEADER + "3.0,600,7,2,110\n-1,600,7,2,110\n3.0,600,99,2,abc\n"))
        msg = str(ctx.exception)
        self.assertIn("line 3: bad distance_km", msg)
        self.assertIn("line 4: bad start_hour, duration_min", msg)

    def test_reports_missing_columns(self):
        with self.assertRaisesRegex(HikeFileError, "missing column.*duration_min"):
            load_hikes(self.write("distance_km,elevation_gain_m,start_hour,group_size\n3,600,7,2\n"))

    def test_bundled_sample_is_valid_and_big_enough(self):
        self.assertGreaterEqual(len(load_hikes(SAMPLE)), MIN_HIKES)


if __name__ == "__main__":
    unittest.main()
