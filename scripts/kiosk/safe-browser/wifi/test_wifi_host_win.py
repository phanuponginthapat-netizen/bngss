import json, struct, subprocess, sys, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import wifi_host_win as w

SAMPLE = """
Interface name : Wi-Fi
SSID 1 : BNG-School
    Network type            : Infrastructure
    การรับรองความถูกต้อง     : WPA2-Personal
    BSSID 1                 : aa:bb:cc:dd:ee:ff
         สัญญาณ             : 81%
    BSSID 2                 : aa:bb:cc:dd:ee:00
         สัญญาณ             : 90%
SSID 2 : Guest
    การรับรองความถูกต้อง     : Open
    BSSID 1                 : 11:22:33:44:55:66
         Signal             : 40%
"""

class T(unittest.TestCase):
    def test_parse_localized(self):
        nets = w.parse_networks(SAMPLE, "Guest")
        self.assertEqual([n["ssid"] for n in nets], ["BNG-School", "Guest"])
        self.assertEqual(nets[0]["signal"], 90)
        self.assertEqual(nets[0]["security"], "WPA2-Personal")
        self.assertTrue(nets[1]["in_use"]); self.assertEqual(nets[1]["security"], "")

    def test_profile_escapes(self):
        x = w.profile_xml("a&b", "p<w")
        self.assertIn("a&amp;b", x); self.assertIn("p&lt;w", x); self.assertIn("<hex>612662</hex>", x)

    def test_protocol_ping(self):
        msg = json.dumps({"cmd": "ping"}).encode()
        p = subprocess.run([sys.executable, str(Path(w.__file__))], input=struct.pack("<I", len(msg)) + msg, capture_output=True)
        n = struct.unpack("<I", p.stdout[:4])[0]
        self.assertEqual(json.loads(p.stdout[4:4 + n])["pong"], True)

    def test_manifest_origin(self):
        m = json.loads((Path(__file__).parent / "com.bngss.wifi.json").read_text())
        self.assertEqual(m["allowed_origins"], ["chrome-extension://pmkbhlpecjcgmcmbfiaggbockmmfpbig/"])

if __name__ == "__main__":
    unittest.main()
