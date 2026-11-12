import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "scan_guide", Path(__file__).parents[1] / "kiosk/facegate-agent/scan_guide.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GuideTests(unittest.TestCase):
    def test_face_fully_inside_visible_frame(self):
        self.assertTrue(module.face_inside((220, 140, 400, 340), 640, 480))

    def test_outside_face_is_ignored(self):
        self.assertFalse(module.face_inside((420, 100, 610, 320), 640, 480))

    def test_center_inside_but_face_crossing_edge_is_ignored(self):
        self.assertFalse(module.face_inside((170, 140, 400, 340), 640, 480))

    def test_actual_display_boundary_is_used(self):
        guide = dict(left=.4, top=.3, right=.6, bottom=.7)
        self.assertFalse(module.face_inside((220, 140, 400, 340), 640, 480, guide))
        self.assertTrue(module.face_inside((270, 150, 370, 320), 640, 480, guide))

    def test_invalid_boundary_does_not_scan(self):
        self.assertFalse(module.face_inside((220, 140, 400, 340), 640, 480, {"left": float('nan')}))

    def test_registered_person_waits_exactly_two_seconds(self):
        self.assertEqual(module.completed_result({"result": "ok", "next_delay_seconds": 5})["next_delay_seconds"], 2)

    def test_unregistered_person_waits_exactly_two_seconds(self):
        self.assertEqual(module.completed_result({"result": "denied", "next_delay_seconds": 1})["next_delay_seconds"], 2)

    def test_duplicate_waits_two_seconds(self):
        self.assertEqual(module.completed_result({"result": "duplicate"})["next_delay_seconds"], 2)

    def test_empty_frame_does_not_pause_queue(self):
        self.assertNotIn("next_delay_seconds", module.completed_result({"result": "no_face"}))


if __name__ == "__main__":
    unittest.main()