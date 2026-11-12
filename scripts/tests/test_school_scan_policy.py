import importlib.util
from pathlib import Path
from datetime import datetime, timezone, timedelta
import unittest

spec = importlib.util.spec_from_file_location("school_scan_policy", Path(__file__).resolve().parents[1] / "kiosk/facegate-agent/school_scan_policy.py")
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

class SchoolScanPolicyTests(unittest.TestCase):
    settings = {"face_scan_entry_window": "06:00-11:00", "face_scan_exit_window": "", "face_scan_mode_cutoff": "13:00"}
    def at(self, hour, minute, direction=None):
        return policy.evaluate_school_scan(self.settings, direction, datetime(2026, 11, 12, hour, minute, tzinfo=timezone(timedelta(hours=7))))
    def test_entry_opens_at_six(self):
        self.assertTrue(self.at(6, 0, "in")["allowed"])
    def test_entry_blocked_before_six(self):
        self.assertFalse(self.at(5, 59, "in")["allowed"])
    def test_entry_allowed_before_eleven(self):
        self.assertTrue(self.at(10, 59, "in")["allowed"])
    def test_entry_closes_at_eleven(self):
        self.assertFalse(self.at(11, 0, "in")["allowed"])
    def test_auto_switches_at_thirteen(self):
        self.assertEqual(self.at(13, 0)["direction"], "out")
    def test_exit_unrestricted_when_empty(self):
        self.assertTrue(self.at(23, 0, "out")["allowed"])
    def test_invalid_window_denied(self):
        with self.assertRaises(ValueError):
            policy.evaluate_school_scan({"face_scan_entry_window": "25:00-26:00"}, "in")

if __name__ == "__main__":
    unittest.main()