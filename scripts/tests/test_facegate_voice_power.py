import importlib.util
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parents[1] / 'kiosk' / 'facegate-agent'
sys.path.insert(0, str(ROOT))
from voice_prepare import sentences, VoicePreparation
import power

class VoicePowerTests(unittest.TestCase):
    def test_cloud_roster_names_and_both_directions(self):
        values = sentences([{'full_name':'สมชาย','person_type':'staff','is_active':True}], {'voice_welcome_text':'สวัสดี'})
        self.assertIn('สวัสดี สมชาย', values)
        self.assertIn('เดินทางปลอดภัย สมชาย', values)

    def test_no_inactive_or_temporary_visitor_names(self):
        values=sentences([{'full_name':'ไม่ใช้งาน','is_active':False},{'full_name':'ผู้เยี่ยม','person_type':'visitor'}],{})
        self.assertFalse(any('ไม่ใช้งาน' in v or 'ผู้เยี่ยม' in v for v in values))

    def test_preparation_reports_each_failure_not_success(self):
        worker=VoicePreparation()
        completed=threading.Event()
        expected=sentences([], {})
        calls=[]
        def synth(text):
            calls.append(text)
            if len(calls)==len(expected):completed.set()
            return None
        self.assertTrue(worker.start([],{},synth))
        self.assertTrue(completed.wait(3))
        self.assertEqual(worker.status()['ready'],0)
        self.assertEqual(worker.status()['failed'],len(expected))

    def test_failed_operating_system_command_is_not_success(self):
        with patch.object(power.subprocess,'run') as run:
            run.return_value.returncode=1
            self.assertFalse(power._run(['xset']))

    def test_failed_screen_off_keeps_previous_state(self):
        power._state['screen_off']=False
        with patch.object(power,'IS_WINDOWS',False),patch.object(power,'_run',return_value=False):
            self.assertFalse(power.screen_off())
            self.assertFalse(power.status()['screen_off'])

if __name__=='__main__':unittest.main()