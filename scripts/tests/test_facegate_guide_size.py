"""The frame shown on the kiosk screen is the frame the agent scans inside.

A person standing close to the kiosk must be accepted: the displayed guide has
to be large enough that a face filling most of the picture still counts as
inside it.  These tests read the real CSS numbers out of local_ui.py and replay
the browser's own mapping (visibleGuide) so the boundary cannot silently shrink.
"""

import importlib.util
import re
import unittest
from pathlib import Path

AGENT_DIR = Path(__file__).parents[1] / "kiosk/facegate-agent"
spec = importlib.util.spec_from_file_location(
    "scan_guide", AGENT_DIR / "scan_guide.py")
guide_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guide_module)

CSS = (AGENT_DIR / "local_ui.py").read_text(encoding="utf-8")


def guide_rule(selector_marker: str) -> tuple[float, float]:
    """(vh share, stage-width share) of one .guide width:min(<A>vh,<B>%) rule."""
    match = re.search(
        selector_marker + r".*?width:min\((\d+(?:\.\d+)?)vh,\s*(\d+(?:\.\d+)?)%\)",
        CSS, re.S)
    assert match, f"no .guide width:min(vh,%) rule found for {selector_marker!r}"
    return float(match.group(1)) / 100.0, float(match.group(2)) / 100.0


def displayed_guide(viewport_w: int, viewport_h: int, stage_w: int, stage_h: int,
                    cam_w: int, cam_h: int, vh_share: float, width_share: float):
    """Replay local_ui.py visibleGuide(): CSS box -> upright picture fraction."""
    box = min(vh_share * viewport_h, width_share * stage_w)
    centre_x, centre_y = stage_w / 2.0, 0.47 * stage_h
    left, right = centre_x - box / 2.0, centre_x + box / 2.0
    top, bottom = centre_y - box / 2.0, centre_y + box / 2.0
    # video { object-fit:cover } crops the upright picture around its centre.
    scale = max(stage_w / cam_w, stage_h / cam_h)
    drawn_w, drawn_h = cam_w * scale, cam_h * scale
    off_x, off_y = (stage_w - drawn_w) / 2.0, (stage_h - drawn_h) / 2.0
    return {
        "left": (left - off_x) / drawn_w,
        "top": (top - off_y) / drawn_h,
        "right": (right - off_x) / drawn_w,
        "bottom": (bottom - off_y) / drawn_h,
    }


class GuideIsBigEnough(unittest.TestCase):
    # Desktop kiosk: 1280x720 viewport, .app = 100vh - 82px, columns 3fr 2fr.
    DESKTOP = dict(viewport_w=1280, viewport_h=720, stage_w=768, stage_h=638,
                   cam_w=640, cam_h=480)
    # Portrait tablet: 600x900 viewport, .app = 100vh - 122px, stage row 54%.
    PORTRAIT = dict(viewport_w=600, viewport_h=900, stage_w=600, stage_h=420,
                    cam_w=640, cam_h=480)

    def test_desktop_guide_accepts_a_face_filling_the_picture(self):
        vh_share, width_share = guide_rule(r"\.guide \{")
        guide = displayed_guide(**self.DESKTOP, vh_share=vh_share,
                                width_share=width_share)
        # The uploaded photo: the head runs from the top of the frame to the
        # chin, i.e. it covers ~80% of the picture height.
        box = (192, 48, 448, 432)
        self.assertTrue(
            guide_module.face_inside(box, 640, 480, guide),
            f"a close-up face is rejected by the displayed guide {guide}")

    def test_desktop_guide_still_rejects_faces_outside_the_frame(self):
        vh_share, width_share = guide_rule(r"\.guide \{")
        guide = displayed_guide(**self.DESKTOP, vh_share=vh_share,
                                width_share=width_share)
        # Someone walking past at the right-hand edge of the room.
        self.assertFalse(
            guide_module.face_inside((544, 120, 638, 360), 640, 480, guide))

    def test_desktop_guide_covers_most_of_the_picture_height(self):
        vh_share, width_share = guide_rule(r"\.guide \{")
        guide = displayed_guide(**self.DESKTOP, vh_share=vh_share,
                                width_share=width_share)
        self.assertGreaterEqual(
            guide["bottom"] - guide["top"], 0.60,
            f"displayed frame only covers {guide['bottom'] - guide['top']:.2f} "
            "of the picture height")

    def test_portrait_guide_covers_most_of_the_picture_height(self):
        vh_share, width_share = guide_rule(r"\.stage\{min-height:0\}\.guide\{")
        guide = displayed_guide(**self.PORTRAIT, vh_share=vh_share,
                                width_share=width_share)
        self.assertGreaterEqual(
            guide["bottom"] - guide["top"], 0.75,
            f"portrait frame only covers {guide['bottom'] - guide['top']:.2f} "
            "of the picture height")


if __name__ == "__main__":
    unittest.main()
