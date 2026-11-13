import subprocess
import unittest
from pathlib import Path


class ScanVoiceTests(unittest.TestCase):
    def test_voice_finishes_and_same_person_is_silent_for_ten_seconds(self):
        source = (Path(__file__).parents[1] / 'kiosk/facegate-agent/local_ui.py').read_text()
        policy = source[source.index('let voiceBusy ='):source.index('function unlockAudio')]
        speaker = source[source.index('async function speak(text)'):source.index('function drawRotated')]
        script = """
const assert = require('node:assert/strict');
let now = 20000;
Date.now = () => now;
const display = {voice_enabled:true};
const browserVoiceOk = true, thaiVoice = {};
const calls = [];
global.SpeechSynthesisUtterance = class { constructor(text) { this.text=text; } };
global.speechSynthesis = { speak(u) { calls.push(u); }, cancel() { throw Error('must not cut off a name'); } };
const chime = () => {};
const speakOnDevice = async () => true;
""" + policy + speaker + """
(async () => {
  speakScan({student_id:'1',name:'สมชาย',speak:'บันทึกไปแล้ว'});
  assert.equal(calls[0].text,'บันทึกไปแล้ว สมชาย');
  now += 2000;
  speakScan({student_id:'1',name:'สมชาย',speak:'บันทึกไปแล้ว'});
  assert.equal(calls.length,1);
  speakScan({student_id:'2',name:'สมหญิง',speak:'ยินดีต้อนรับ สมหญิง'});
  assert.equal(calls.length,1);
  calls[0].onend(); await new Promise(r=>setImmediate(r));
  assert.equal(calls.length,2);
  assert.equal(calls[1].text,'ยินดีต้อนรับ สมหญิง');
  calls[1].onend(); await new Promise(r=>setImmediate(r));
  now = 30000;
  speakScan({student_id:'1',name:'สมชาย',speak:'บันทึกไปแล้ว'});
  assert.equal(calls.length,3);
  calls[2].onend();
})();
"""
        result = subprocess.run(['node', '-e', script], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()