import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'kiosk'/'facegate-agent'))
from enrollment_quality import quality_error

def face():
    return {'box':{'width':140,'height':170},'score':.95,'sharpness':90,'colorSpread':30,'descriptor':[1.0]+[0.0]*511}

class NativeEnrollmentTests(unittest.TestCase):
    def test_rejects_multiple_people(self):
        self.assertIsNotNone(quality_error([face(),face()]))
    def test_rejects_blurred_photo(self):
        sample=face(); sample['sharpness']=10
        self.assertIsNotNone(quality_error([sample]))
    def test_rejects_changed_identity(self):
        other=face(); other['descriptor']=[0.,1.]+[0.]*510
        self.assertIsNotNone(quality_error([other],[face()]))
    def test_clear_same_person_accepted(self):
        self.assertIsNone(quality_error([face()],[face()]))
    def test_rejects_nonfinite_embedding(self):
        sample=face();sample['descriptor'][0]=float('nan')
        self.assertIsNotNone(quality_error([sample]))

class NativeTransportTests(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from native_admin import create_router
        app=FastAPI()
        app.include_router(create_router('https://example.test/functions/v1',lambda _:[],lambda _:None,lambda:None))
        self.client=TestClient(app,client=('127.0.0.1',12345))
    def test_session_required_for_capture(self):
        self.assertEqual(self.client.post('/native-admin/action',json={'action':'capture'}).status_code,401)
    def test_cross_origin_rejected(self):
        self.assertEqual(self.client.post('/native-admin/action',headers={'Origin':'https://foreign.test'},json={'action':'login'}).status_code,403)
    def test_device_key_cannot_manage(self):
        self.assertEqual(self.client.post('/native-admin/action',headers={'x-device-key':'device'},json={'action':'save'}).status_code,401)
    def test_denied_cloud_login_has_no_session(self):
        from unittest.mock import patch
        with patch('native_admin.requests.post') as post:
            post.return_value.ok=False
            result=self.client.post('/native-admin/action',json={'action':'login','email':'test','password':'test'})
        self.assertEqual(result.status_code,400)
        self.assertNotIn('session',result.json())

class DeviceEnrollmentTests(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI
        from fastapi.testclient import TestClient
        from native_admin import create_router
        from unittest.mock import patch
        self.post=patch('native_admin.requests.post').start()
        self.addCleanup(patch.stopall)
        self.post.return_value.ok=True
        self.post.return_value.json.return_value={'students':[{'id':'student','student_code':'01234','full_name':'Student','class_room':'1/1'}]}
        app=FastAPI()
        app.include_router(create_router('https://example.test/functions/v1',lambda _:[face()],lambda _:'student',lambda:None,device_key='approved-device'))
        self.client=TestClient(app,client=('127.0.0.1',12345))
        opened=self.client.post('/native-admin/action',json={'action':'open'})
        self.assertEqual(opened.status_code,200)
        self.session=opened.json()['session']
    def action(self,kind,**values):
        return self.client.post('/native-admin/action',json={'session':self.session,'action':kind,**values})
    def test_login_free_code_preserves_leading_zero(self):
        chosen=self.action('code',code='01234')
        self.assertEqual(chosen.json()['student']['student_code'],'01234')
        self.assertEqual(self.post.call_args.kwargs['headers']['x-device-key'],'approved-device')
        self.assertNotIn('Authorization',self.post.call_args.kwargs['headers'])
    def test_qr_selects_without_login(self):
        self.assertEqual(self.action('card',image='frame').json()['student']['id'],'student')
    def test_three_samples_required_and_failed_save_retains_them(self):
        self.action('code',code='01234')
        self.assertEqual(self.action('save').status_code,400)
        for count in (1,2,3):self.assertEqual(self.action('capture',image='frame').json()['count'],count)
        self.post.return_value.ok=False
        self.assertEqual(self.action('save').status_code,400)
        self.post.return_value.ok=True
        self.post.return_value.json.return_value={'success':True,'count':3}
        self.assertEqual(self.action('save').json(),{'ok':True,'count':3})
        self.assertEqual(len(self.post.call_args.kwargs['json']['descriptors']),3)

class MachineSettingsTests(unittest.TestCase):
    def test_shutdown_time_persists_and_runs_at_thai_time(self):
        import tempfile
        from datetime import datetime
        from native_settings import Settings
        from power_schedule import plan
        with tempfile.TemporaryDirectory() as folder:
            path=str(Path(folder)/'machine.json')
            Settings(path).save({'power_saving_enabled':True,'power_off_time':'16:30','power_off_action':'shutdown'}, {})
            settings=Settings(path).read({})
            self.assertEqual(settings['power_off_time'],'16:30')
            self.assertFalse(plan(settings,datetime(2026,11,16,16,29))['power_off_due'])
            self.assertTrue(plan(settings,datetime(2026,11,16,16,30))['power_off_due'])
    def test_machine_settings_cannot_change_attendance_policy(self):
        from native_settings import validate
        with self.assertRaises(ValueError):validate({'require_liveness':False})
    def test_invalid_shutdown_time_rejected(self):
        from native_settings import validate
        with self.assertRaises(ValueError):validate({'power_off_time':'25:00'})

if __name__=='__main__':unittest.main()
