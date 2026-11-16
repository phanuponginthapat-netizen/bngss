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

if __name__=='__main__':unittest.main()

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
