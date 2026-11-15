import importlib.util
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location("receipt_stream", Path(__file__).parents[1]/"kiosk/facegate-agent/receipt_stream.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class Response:
    def raise_for_status(self): pass
    def iter_lines(self, chunk_size):
        if chunk_size != 1: raise AssertionError("small receipt events must not wait for a buffer")
        return iter([b"event: ready", b"data: {}", b"event: heartbeat", b"event: receipt", b"data: {}"])

class ReceiptStreamTests(unittest.TestCase):
    def test_other_kiosk_receipt_reconciles_immediately_and_reconnect_reads_back(self):
        reads=[]
        module.consume_receipts(Response(), lambda: reads.append("cloud"))
        self.assertEqual(reads,["cloud","cloud"])
    def test_authorization_failure_never_reports_receipt(self):
        class Denied(Response):
            def raise_for_status(self): raise ValueError("unauthorized")
        reads=[]
        with self.assertRaises(ValueError): module.consume_receipts(Denied(),lambda:reads.append("cloud"))
        self.assertEqual(reads,[])

if __name__ == "__main__": unittest.main()