import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]/'kiosk'/'facegate-agent'))
from face_memory import learn, prune, enrollment_anchors, identity_clear

def vec(x=1., y=0.):
    return [x, y]+[0.]*510

class FaceMemoryTests(unittest.TestCase):
    def test_high_confidence_lookalike_requires_card(self):
        self.assertFalse(identity_clear('a', {'a': .96, 'b': .87}))
    def test_clear_identity_can_scan(self):
        self.assertTrue(identity_clear('a', {'a': .90, 'b': .65}))
    def test_adaptive_winner_cannot_override_original_rival(self):
        self.assertFalse(identity_clear('a', {'a': .80, 'b': .91}))
    def test_invalid_anchor_fails_closed(self):
        self.assertFalse(identity_clear('a', {'a': .9, 'b': float('nan')}))
    def setUp(self):
        self.anchors={'student':{'vectors':[vec()], 'version':'a'},
                      'other':{'vectors':[vec(0,1)], 'version':'b'}}
    def test_clear_scan_learns_without_raw_photo(self):
        memory={}
        self.assertTrue(learn(memory,self.anchors,'student',vec(.9,.1),90,.95,100))
        self.assertEqual(set(memory['student'][0]),{'embedding','at','version'})
    def test_twins_do_not_train(self):
        self.anchors['other']['vectors']=[vec(.999,.001)]
        memory={}
        self.assertFalse(learn(memory,self.anchors,'student',vec(),90,.95,100))
        self.assertEqual(memory,{})
    def test_blurred_scan_does_not_train(self):
        self.assertFalse(learn({},self.anchors,'student',vec(),10,.95,100))
    def test_old_and_replaced_faces_are_pruned(self):
        sample={'embedding':vec(),'at':0,'version':'a'}
        self.assertEqual(prune({'student':[sample]},self.anchors,30*86400)['student'],[])
        self.assertEqual(prune({'student':[{**sample,'version':'old'}]},self.anchors,100)['student'],[])
        self.assertEqual(prune({'removed':[sample]},self.anchors,100),{})
    def test_six_samples_maximum(self):
        samples=[{'embedding':vec(),'at':i,'version':'a'} for i in range(10)]
        kept=prune({'student':samples},self.anchors,20)['student']
        self.assertEqual(len(kept),6)
        self.assertEqual(kept[0]['at'],4)
    def test_repeated_frames_do_not_write(self):
        memory={}
        self.assertTrue(learn(memory,self.anchors,'student',vec(),90,.95,100))
        self.assertFalse(learn(memory,self.anchors,'student',vec(),90,.95,101))
        self.assertEqual(len(memory['student']),1)
    def test_enrollment_changes_reset_anchor(self):
        old=enrollment_anchors({'photo':{'student_id':'s','embedding':vec(),'version':'1'}})
        new=enrollment_anchors({'photo':{'student_id':'s','embedding':vec(),'version':'2'}})
        self.assertNotEqual(old['s']['version'],new['s']['version'])

if __name__=='__main__':unittest.main()