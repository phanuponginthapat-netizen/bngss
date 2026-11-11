import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("wifi_helper", pathlib.Path(__file__).with_name("wifi-helper.py"))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

class WifiHelperTests(unittest.TestCase):
    def test_failed_scan_is_not_success(self):
        with patch.object(helper, "run", return_value=(1, "", "denied")):
            self.assertEqual(helper.nmcli_scan(), {"ok": False, "error": "denied"})

    def test_failed_autoconnect_is_reported(self):
        with patch.object(helper, "run", side_effect=[(0, "connected", ""), (1, "", "save failed")]):
            self.assertFalse(helper.nmcli_connect("School", "")["ok"])

    def test_disconnect_failure_is_reported(self):
        with patch.object(helper, "run", side_effect=[(0, "wlan0:wifi", ""), (1, "", "denied")]):
            self.assertFalse(helper.nmcli_disconnect()["ok"])

    def test_status_failure_is_not_offline_success(self):
        with patch.object(helper, "run", return_value=(1, "", "unavailable")):
            self.assertFalse(helper.nmcli_status()["ok"])

    def test_ssid_colons_and_strongest_signal(self):
        with patch.object(helper, "run", return_value=(0, "*:School\\:WiFi:80:WPA2\n:School\\:WiFi:60:WPA2", "")):
            self.assertEqual(helper.nmcli_list()["networks"], [{"ssid": "School:WiFi", "signal": 80, "security": "WPA2", "in_use": True}])

if __name__ == "__main__":
    unittest.main()