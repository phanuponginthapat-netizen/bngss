"""หน้าจอพัก FaceGate ต้องสรุปการมาโรงเรียนแยกระดับชั้นเหมือนหน้าแรกโรงเรียน"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "kiosk", "facegate-agent"))

from saver_stats import _class_sort_key, group_classes_by_room  # noqa: E402


def person(pid, room, ptype="student"):
    return {"id": pid, "class_room": room, "person_type": ptype}


class ClassSortOrderTest(unittest.TestCase):
    def test_kindergarten_primary_secondary_order(self):
        names = ["ม.2", "ป.1", "อ.2", "ม.1", "ป.6", "อ.1"]
        ordered = [cell["name"] for cell in sorted(
            ({"name": n} for n in names), key=lambda c: _class_sort_key(c["name"]))]
        self.assertEqual(ordered, ["อ.1", "อ.2", "ป.1", "ป.6", "ม.1", "ม.2"])

    def test_unknown_names_sort_last(self):
        self.assertLess(_class_sort_key("ป.1"), _class_sort_key("ยังไม่จัดชั้น"))


class GroupClassesTest(unittest.TestCase):
    def test_present_late_absent_per_class(self):
        people = [
            person("s1", "ป.1"), person("s2", "ป.1"), person("s3", "ป.1"),
            person("s4", "ม.1"), person("s5", "ม.1"),
            person("t1", None, "staff"),
        ]
        first_in = {"s1": "2026-11-13T00:10:00", "s3": "2026-11-13T01:40:00", "s4": "2026-11-13T00:05:00"}
        late_ids = {"s3"}
        cells = {c["name"]: c for c in group_classes_by_room(people, first_in, late_ids, True)}
        self.assertNotIn("ทีมครู", cells)
        p1 = cells["ป.1"]
        self.assertEqual((p1["total"], p1["present"], p1["late"], p1["absent"], p1["unrecorded"]), (3, 1, 1, 1, 0))
        m1 = cells["ม.1"]
        self.assertEqual((m1["total"], m1["present"], m1["late"], m1["absent"]), (2, 1, 0, 1))
        self.assertTrue(p1["evidence"])

    def test_no_scans_means_unrecorded_not_absent(self):
        people = [person("s1", "ป.1"), person("s2", "ป.1")]
        cells = group_classes_by_room(people, {}, set(), True)
        self.assertEqual(cells[0]["absent"], 0)
        self.assertEqual(cells[0]["unrecorded"], 2)
        self.assertFalse(cells[0]["evidence"])

    def test_holiday_never_marks_absent(self):
        people = [person("s1", "ป.1")]
        first_in = {"s1": "2026-11-13T00:10:00"}
        cells = group_classes_by_room(people, first_in, set(), False)
        self.assertEqual(cells[0]["absent"], 0)
        self.assertEqual(cells[0]["unrecorded"], 0)

    def test_empty_room_falls_back_to_unassigned(self):
        people = [person("s1", ""), person("s2", None)]
        cells = group_classes_by_room(people, {"s1": "2026-11-13T00:10:00"}, set(), True)
        self.assertEqual(len(cells), 1)
        self.assertEqual(cells[0]["name"], "ยังไม่จัดชั้น")
        self.assertEqual(cells[0]["total"], 2)


class SaverMarkupTest(unittest.TestCase):
    def test_saver_renders_class_table_and_hides_totals(self):
        html = open(os.path.join(os.path.dirname(__file__), "..", "kiosk", "facegate-agent", "local_ui.py"), encoding="utf-8").read()
        self.assertIn('id="saverClasses"', html)
        self.assertIn('id="studentGroup"', html)
        self.assertIn('id="staffGroup"', html)
        self.assertIn("Array.isArray(s.classes)", html)
        # ร้อยละคำนวณจากมา+สาย เหมือนหน้าแรก
        self.assertIn("Number(c.present) || 0) + (Number(c.late)", html)


if __name__ == "__main__":
    unittest.main()
