import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("scan_outbox", Path(__file__).parents[1] / "kiosk/facegate-agent/scan_outbox.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ScanOutboxTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = str(Path(self.temp.name) / "outbox.jsonl")
        self.queue = module.ScanOutbox(self.path)
        self.scan = {"student_id": "student-1", "direction": "in", "scanned_at": "2026-11-14T01:00:00Z"}

    def test_survives_restart_before_upload(self):
        self.queue.append(self.scan)
        self.assertEqual(module.ScanOutbox(self.path).count(), 1)

    def test_failed_upload_retains_original_time(self):
        self.queue.append(self.scan)
        self.queue.flush(lambda payload: {"result": "denied"})
        sent = []
        self.queue.flush(lambda payload: sent.append(payload) or {"result": "ok"})
        self.assertEqual(sent[0]["scanned_at"], "2026-11-14T01:00:00Z")
        self.assertEqual(self.queue.count(), 0)

    def test_new_scan_while_uploading_is_not_lost(self):
        self.queue.append(self.scan)
        def send(payload):
            self.queue.append({**self.scan, "student_id": "student-2"})
            return {"result": "ok"}
        self.queue.flush(send)
        self.assertEqual(self.queue.count(), 1)

    def test_duplicate_confirmation_removes_only_confirmed(self):
        self.queue.append(self.scan)
        self.queue.flush(lambda payload: {"result": "duplicate"})
        self.assertEqual(self.queue.count(), 0)

    def test_unavailable_server_stops_batch_without_discarding(self):
        self.queue.append(self.scan)
        self.queue.append({**self.scan, "student_id": "student-2"})
        calls = []
        def send(payload):
            calls.append(payload)
            raise ConnectionError("offline")
        self.queue.flush(send)
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.queue.count(), 2)

    def test_disk_failure_is_not_acknowledged(self):
        Path(self.path).mkdir()
        with self.assertRaises(OSError):
            self.queue.append(self.scan)

    def test_legacy_unknown_time_is_not_uploaded_as_today(self):
        self.queue.append({"student_id": "student-1", "direction": "in"})
        sent = []
        self.queue.flush(lambda payload: sent.append(payload) or {"result": "ok"})
        self.assertEqual(sent, [])
        self.assertEqual(self.queue.count(), 1)

    def test_unknown_old_scan_does_not_block_new_valid_scan(self):
        self.queue.append({"student_id":"old","direction":"in"})
        self.queue.append(self.scan)
        sent=[]
        self.queue.flush(lambda payload:sent.append(payload) or {"result":"ok"})
        self.assertEqual(sent,[self.scan])
        self.assertEqual(self.queue.count(),1)
        self.assertIn("manual review",self.queue.last_error)


if __name__ == "__main__":
    unittest.main()