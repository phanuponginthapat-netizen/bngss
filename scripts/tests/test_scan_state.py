import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location("scan_state",Path(__file__).parents[1]/"kiosk/facegate-agent/scan_state.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class CrossDeviceTests(unittest.TestCase):
    def test_other_kiosk_receipts_reach_this_kiosk(self):
        self.assertEqual(module.confirmed_scan_keys({"scan_date":"2026-11-15","scans":[{"student_id":"s1","direction":"in"}]},"2026-11-15"),{("s1","in")})
    def test_yesterday_does_not_block_today(self):
        self.assertEqual(module.confirmed_scan_keys({"scan_date":"2026-11-14","scans":[{"student_id":"s1","direction":"in"}]},"2026-11-15"),set())
    def test_exit_does_not_become_entry(self):
        self.assertEqual(module.confirmed_scan_keys({"scan_date":"2026-11-15","scans":[{"student_id":"s1","direction":"out"}]},"2026-11-15"),{("s1","out")})
if __name__ == "__main__": unittest.main()