import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("prune_apks", Path(__file__).parents[1] / "ci/prune-apks.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RetentionTests(unittest.TestCase):
    def test_only_current_android(self):
        self.assertEqual(module.candidates(["bngss-app-v1.0.116-116.apk", "bngss-app-latest.apk", "bngss-app-v1.0.115-115.apk", "bngss-scanner-build-8.apk", "version.json"], "bngss-app-v1.0.116-116.apk", "android"), ["bngss-app-latest.apk", "bngss-app-v1.0.115-115.apk"])
    def test_only_current_scanner(self):
        self.assertEqual(module.candidates(["bngss-scanner-build-8.apk", "bngss-scanner-build-7.apk"], "bngss-scanner-build-8.apk", "scanner"), ["bngss-scanner-build-7.apk"])
    def test_only_current_facegate_keeps_latest_and_manifest(self):
        self.assertEqual(module.candidates(["facegate-agent-v1.12.0-5.zip", "facegate-agent-v1.11.0-4.zip", "facegate-agent-latest.zip", "facegate-version.json"], "facegate-agent-v1.12.0-5.zip", "facegate"), ["facegate-agent-v1.11.0-4.zip"])
    def test_missing_current_stops_deletion(self):
        with self.assertRaises(ValueError):
            module.candidates(["bngss-scanner-build-7.apk"], "bngss-scanner-build-8.apk", "scanner")

if __name__ == "__main__":
    unittest.main()