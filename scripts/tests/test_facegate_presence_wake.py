"""Presence wakes the kiosk without touch or changing attendance acceptance."""
import ast
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

ROOT = Path(__file__).parents[1] / 'kiosk' / 'facegate-agent'
sys.path.insert(0, str(ROOT))
import power


class PresenceWakeTests(unittest.TestCase):
    def setUp(self):
        self.saved = dict(power._state)
        self.presence = power._presence_at
        power._presence_at = None

    def tearDown(self):
        power._state.clear()
        power._state.update(self.saved)
        power._presence_at = self.presence

    def test_detected_face_leaves_manual_saver_without_touch(self):
        power.screen_off(manual=True)
        with patch.object(power, '_run', return_value=True):
            power.note_presence()
        self.assertFalse(power.status()['screen_off'])
        self.assertFalse(power.status()['manual_screen_off'])
        self.assertTrue(power.presence_active())

    def test_detected_face_leaves_automatic_saver_without_touch(self):
        power.screen_off(manual=False)
        with patch.object(power, '_run', return_value=True):
            power.note_presence()
        self.assertFalse(power.status()['screen_off'])

    def test_empty_camera_does_not_wake(self):
        power.screen_off()
        self.assertFalse(power.presence_active())
        self.assertTrue(power.status()['screen_off'])

    def test_presence_grace_expires_and_refreshes(self):
        with patch.object(power.time, 'monotonic', return_value=100):
            power.note_presence()
        with patch.object(power.time, 'monotonic', return_value=114.99):
            self.assertTrue(power.presence_active())
        with patch.object(power.time, 'monotonic', return_value=115):
            self.assertFalse(power.presence_active())
            power.note_presence()
            self.assertTrue(power.presence_active())

    def test_scheduled_saver_does_not_cover_recent_face(self):
        # Run the actual plan function without loading camera/model dependencies.
        tree = ast.parse((ROOT / 'agent.py').read_text())
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                        and n.name == 'enforce_power_plan')
        import threading, time
        namespace = {'lock': threading.Lock(), 'state': {'last_activity': time.time(), 'settings': {}},
                     'time': time, 'power': power}
        exec(compile(ast.Module(body=[function], type_ignores=[]), 'agent.py', 'exec'), namespace)
        with patch.object(power, '_run', return_value=True):
            power.note_presence()
        power.screen_on()
        namespace['enforce_power_plan']({'power_saving_enabled': True, 'screen_off_window': True})
        self.assertFalse(power.status()['screen_off'])
        power._presence_at = None
        namespace['enforce_power_plan']({'power_saving_enabled': True, 'screen_off_window': True})
        self.assertTrue(power.status()['screen_off'])


if __name__ == '__main__':
    unittest.main()