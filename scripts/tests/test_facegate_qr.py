import importlib.util
import pathlib
import unittest

import cv2
import numpy as np

PATH = pathlib.Path(__file__).resolve().parents[1] / "kiosk" / "facegate-agent" / "qr_reader.py"
spec = importlib.util.spec_from_file_location("qr_reader", PATH)
qr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qr)

PEOPLE = {"id-1": {"student_code": "2853"}, "id-2": {"student_code": " 3001 "}, "id-3": {"student_code": ""}}


def qr_frame(text: str) -> np.ndarray:
    enc = cv2.QRCodeEncoder.create()
    code = enc.encode(text)
    code = cv2.resize(code, (code.shape[1] * 8, code.shape[0] * 8), interpolation=cv2.INTER_NEAREST)
    frame = np.full((480, 640), 255, np.uint8)
    h, w = code.shape
    frame[100:100 + h, 200:200 + w] = code
    return cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)


class CardMatch(unittest.TestCase):
    def setUp(self):
        self.index = qr.build_code_index(PEOPLE)

    def test_known_code_matches(self):
        self.assertEqual(qr.match_card("2853", self.index), "id-1")
        self.assertEqual(qr.match_card("3001\n", self.index), "id-2")

    def test_line_link_and_unknown_are_ignored(self):
        self.assertIsNone(qr.match_card("https://line.me/R/oaMessage/x/?เชื่อม 2853 25550101", self.index))
        self.assertIsNone(qr.match_card("เชื่อม 2853", self.index))
        self.assertIsNone(qr.match_card("9999", self.index))
        self.assertIsNone(qr.match_card("", self.index))

    def test_reads_card_from_camera_frame(self):
        self.assertEqual(qr.read_qr(qr_frame("2853")), "2853")
        self.assertIsNone(qr.read_qr(np.full((480, 640, 3), 128, np.uint8)))

    def test_same_card_not_posted_every_frame(self):
        guard = qr.RepeatGuard(hold_s=6)
        self.assertTrue(guard.allow("id-1", 0))
        self.assertFalse(guard.allow("id-1", 3))
        self.assertTrue(guard.allow("id-2", 3))
        self.assertTrue(guard.allow("id-1", 7))


if __name__ == "__main__":
    unittest.main()
