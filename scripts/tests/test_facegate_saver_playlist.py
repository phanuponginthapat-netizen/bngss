"""Exercise the real kiosk playlist functions in Chromium without school writes."""
import os
import sys
import unittest

from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'kiosk', 'facegate-agent'))
from local_ui import KIOSK_HTML


class PlaylistTest(unittest.TestCase):
    def setUp(self):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(headless=True)
        self.page = self.browser.new_page(viewport={"width": 1280, "height": 1800})
        # Isolate the actual playlist from camera/network/startup side effects.
        script = KIOSK_HTML.split('<script>')[1].split('</script>')[0]
        script = script[:script.index('setInterval(loadPower,1000);')]
        self.page.set_content('<div id="saver" class="saver show"><div id="saverMedia"></div></div>')
        self.page.add_script_tag(content=script)
        self.page.route('https://example.invalid/**', lambda route: route.abort())
        self.page.evaluate("""() => {
          window.playCalls = [];
          HTMLMediaElement.prototype.play = function() { playCalls.push(this.src); return Promise.resolve(); };
          HTMLMediaElement.prototype.pause = function() { this.dataset.paused = 'yes'; };
          HTMLMediaElement.prototype.load = function() {};
          broadcastMedia = [
            {id:'a',media_type:'video',url:'https://example.invalid/a.mp4'},
            {id:'b',media_type:'image',url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',duration_seconds:3},
            {id:'c',media_type:'video',url:'https://example.invalid/c.mp4'}
          ];
          showBroadcast();
        }""")

    def tearDown(self):
        self.browser.close()
        self.pw.stop()

    def test_video_plays_without_sound(self):
        self.assertEqual(self.page.locator('video').evaluate('(v)=>[v.muted,v.volume]'), [True, 1])

    def test_order_loops_after_complete_video_and_timed_image(self):
        self.page.evaluate("document.querySelector('video').dispatchEvent(new Event('ended'))")
        self.assertEqual(self.page.locator('img').count(), 1)
        self.page.wait_for_timeout(3100)
        self.assertTrue(self.page.locator('video').get_attribute('src').endswith('/c.mp4'))
        self.page.evaluate("document.querySelector('video').dispatchEvent(new Event('ended'))")
        self.assertTrue(self.page.locator('video').get_attribute('src').endswith('/a.mp4'))

    def test_wake_stops_sound_and_clears_timer(self):
        self.page.evaluate("window.oldVideo=document.querySelector('video'); statsMode=false; applySaver();")
        self.assertEqual(self.page.evaluate("[oldVideo.dataset.paused,oldVideo.hasAttribute('src'),broadcastTimer]"), ['yes', False, None])
        self.assertEqual(self.page.locator('video').count(), 0)

    def test_refresh_preserves_video_and_updates_next_signed_url(self):
        self.page.evaluate("window.oldVideo=document.querySelector('video'); updateBroadcast(broadcastMedia.map(i=>({...i,url:i.url+'?fresh=1'})))")
        self.assertTrue(self.page.evaluate("oldVideo===document.querySelector('video')"))
        self.page.evaluate('nextBroadcast(); nextBroadcast();')
        self.assertTrue(self.page.locator('video').get_attribute('src').endswith('?fresh=1'))

    def test_removed_video_stops_immediately(self):
        self.page.evaluate("window.oldVideo=document.querySelector('video'); updateBroadcast(broadcastMedia.slice(1));")
        self.assertEqual(self.page.evaluate('oldVideo.dataset.paused'), 'yes')
        self.assertEqual(self.page.locator('img').count(), 1)

    def test_blocked_play_never_asks_for_sound(self):
        self.page.evaluate("""() => {
          stopBroadcast(); document.getElementById('saverMedia').replaceChildren();
          HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked','NotAllowedError'));
          showBroadcast();
        }""")
        self.page.wait_for_timeout(400)
        self.assertEqual(self.page.get_by_role('button').count(), 0)
        self.assertEqual(self.page.evaluate('broadcastTimer === null'), False)
        self.assertTrue(self.page.locator('#saver').evaluate("e=>e.classList.contains('show')"))


if __name__ == '__main__':
    unittest.main()