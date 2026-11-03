"""FaceGate must keep up with one student at a time on a Celeron J1900.

The rules that matter: a low-power CPU is recognised as such, an empty lobby
costs almost nothing, a person walking up is never waited out, and the extra
detector passes only run when there is a sign of a face.
"""

import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "power_profile",
    Path(__file__).parents[1] / "kiosk/facegate-agent/power_profile.py",
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ModeTests(unittest.TestCase):
    def test_j1900_is_eco(self):
        self.assertEqual(
            module.mode("", "Intel(R) Celeron(R) CPU J1900 @ 1.99GHz", 4), "eco")

    def test_modern_cpu_is_full(self):
        self.assertEqual(
            module.mode("", "13th Gen Intel(R) Core(TM) i7-13700", 16), "full")

    def test_saved_choice_wins_over_cpu(self):
        self.assertEqual(module.mode("full", "Intel(R) Celeron(R) J1900", 4), "full")
        self.assertEqual(module.mode("eco", "AMD Ryzen 9 7950X", 32), "eco")


class SceneGateTests(unittest.TestCase):
    def test_flickering_empty_camera_learns_to_rest(self):
        """A camera whose auto-exposure jitters must not scan every frame."""
        gate = module.SceneGate(force_check_s=1.2)
        now = 100.0
        checked = 0
        for _ in range(40):
            if not gate.is_static(2.4, now):  # empty lobby, constant flicker
                checked += 1
            now += 0.9
        self.assertLess(checked, 40)
        self.assertGreater(gate.baseline, 1.0)

    def test_person_walking_up_is_never_missed(self):
        gate = module.SceneGate(force_check_s=1.2)
        now = 100.0
        for _ in range(20):  # let the floor settle on a quiet camera
            gate.is_static(0.3, now)
            now += 0.9
        self.assertFalse(gate.is_static(22.0, now))

    def test_still_person_is_rechecked(self):
        """Nobody may be waited out just because they are not moving."""
        gate = module.SceneGate(force_check_s=1.2)
        now = 100.0
        for _ in range(12):  # warm-up: the floor is still unknown, so keep scanning
            gate.is_static(0.1, now)
            now += 0.9
        self.assertTrue(gate.is_static(0.1, now))   # quiet -> rest
        now += 1.3
        self.assertFalse(gate.is_static(0.1, now))  # but never longer than 1.2s

    def test_one_person_passing_does_not_hide_the_next(self):
        """The floor is a low percentile, so a walk-through cannot lift it."""
        gate = module.SceneGate(force_check_s=1.2)
        now = 100.0
        for _ in range(18):
            gate.is_static(0.3, now)
            now += 0.9
        for _ in range(6):  # somebody walks past
            gate.is_static(20.0, now)
            now += 0.9
        self.assertLess(gate.threshold(), 5.0)
        self.assertFalse(gate.is_static(22.0, now))


class PassPlanTests(unittest.TestCase):
    def test_eco_empty_frame_spends_one_pass(self):
        light, big = module.pass_plan("eco", 0.02, False, 100.0, 0.0)
        self.assertFalse(light)
        self.assertFalse(big)

    def test_eco_weak_face_gets_the_bigger_detector(self):
        light, big = module.pass_plan("eco", 0.25, False, 100.0, 90.0)
        self.assertTrue(light)
        self.assertTrue(big)

    def test_eco_big_pass_is_rate_limited(self):
        light, big = module.pass_plan("eco", 0.30, False, 100.0, 99.5)
        self.assertFalse(big)

    def test_eco_dark_frame_always_gets_the_light_pass(self):
        light, _ = module.pass_plan("eco", 0.01, True, 100.0, 0.0)
        self.assertTrue(light)

    def test_full_keeps_trying_every_pass(self):
        light, big = module.pass_plan("full", 0.0, False, 100.0, 99.9)
        self.assertTrue(light)
        self.assertTrue(big)


class TimerTests(unittest.TestCase):
    def test_measured_times_are_reported(self):
        timer = module.Timer()
        timer.note(420)
        timer.note(180)
        timer.note_skipped()
        status = timer.status()
        self.assertEqual(status["scans"], 2)
        self.assertEqual(status["skipped"], 1)
        self.assertEqual(status["last_ms"], 180.0)
        self.assertEqual(status["max_ms"], 420.0)


if __name__ == "__main__":
    unittest.main()
