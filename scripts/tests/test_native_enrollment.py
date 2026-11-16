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
