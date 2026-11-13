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
from cloud_config import cloud_api_url, MANAGED_API
from power_schedule import plan, DailyShutdown
from datetime import datetime

class VoicePowerTests(unittest.TestCase):
    def test_saved_power_plan_works_without_cloud(self):
        settings={'power_saving_enabled':True,'screen_off_time':'18:00','screen_on_time':'06:00','power_off_time':'20:00'}
        self.assertTrue(plan(settings,datetime(2026,11,13,20,0))['power_off_due'])
        self.assertTrue(plan(settings,datetime(2026,11,13,23,0))['screen_off_window'])
        self.assertFalse(plan(settings,datetime(2026,11,14,6,0))['screen_off_window'])

    def test_cancelled_countdown_is_not_rescheduled_same_day(self):
        guard=DailyShutdown()
        now=datetime(2026,11,13,20,0)
        self.assertTrue(guard.reserve(now,{'power_off_time':'20:00'}))
        self.assertFalse(guard.reserve(now,{'power_off_time':'20:00'}))
        self.assertTrue(guard.reserve(datetime(2026,11,14,20,0),{'power_off_time':'20:00'}))
    def test_installer_school_origin_uses_managed_api(self):
        for value in ['https://bngss.online','https://www.bngss.online','https://bngss.lovable.app']:
            self.assertEqual(cloud_api_url(value),MANAGED_API)

    def test_api_origin_is_not_duplicated(self):
        self.assertEqual(cloud_api_url(MANAGED_API),MANAGED_API)
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

    def test_remote_screen_off_uses_kiosk_idle_screen_not_os_lock(self):
        with patch.object(power,'IS_WINDOWS',True),patch.object(power,'_run') as run:
            self.assertTrue(power.screen_off())
            run.assert_not_called()
            self.assertTrue(power.status()['screen_off'])
            self.assertTrue(power.status()['manual_screen_off'])
        with patch.object(power,'IS_WINDOWS',False),patch.object(power,'_run',return_value=True):
            self.assertTrue(power.screen_on())
            self.assertFalse(power.status()['screen_off'])

if __name__=='__main__':unittest.main()