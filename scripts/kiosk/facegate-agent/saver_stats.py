"""สรุปการมาโรงเรียนแยกระดับชั้นสำหรับหน้าจอพัก FaceGate (โหมดออฟไลน์)

แยกจาก local_api.py เพื่อให้ทดสอบได้โดยไม่ต้องติดตั้ง fastapi
"""

from __future__ import annotations

import re


def _class_sort_key(name: str) -> tuple:
    """เรียงระดับชั้นเหมือนหน้าแรกโรงเรียน: อ.N → ป.N → ม.N แล้วตามตัวอักษร"""
    match = re.match(r"^(อ|ป|ม)\.(\d+)", name)
    if match:
        return ({"อ": 0, "ป": 10, "ม": 20}.get(match.group(1), 100) + int(match.group(2)), name)
    return (100, name)


def group_classes_by_room(people: list[dict], first_in: dict[str, str],
                          late_ids: set[str], is_workday: bool) -> list[dict]:
    """สรุปการมาโรงเรียนแยกตามห้อง/ระดับชั้นจากข้อมูลในเครื่อง (โหมดออฟไลน์)"""
    groups: dict[str, dict] = {}
    for person in people:
        if person.get("person_type") == "staff":
            continue
        name = (person.get("class_room") or "").strip() or "ยังไม่จัดชั้น"
        cell = groups.setdefault(name, {"name": name, "total": 0, "present": 0, "late": 0,
                                        "leave": 0, "absent": 0, "unrecorded": 0,
                                        "evidence": bool(first_in)})
        cell["total"] += 1
        gender = person.get("gender")
        if gender in ("male", "female"):
            sex = cell.setdefault(gender, {"total": 0, "present": 0, "late": 0, "leave": 0, "absent": 0, "unrecorded": 0})
            sex["total"] += 1
            if person["id"] in first_in:
                sex["late" if person["id"] in late_ids else "present"] += 1
        if person["id"] in first_in:
            if person["id"] in late_ids:
                cell["late"] += 1
            else:
                cell["present"] += 1
    for cell in groups.values():
        missing = cell["total"] - cell["present"] - cell["late"]
        cell["absent"] = missing if (is_workday and cell["evidence"]) else 0
        cell["unrecorded"] = missing - cell["absent"]
    for cell in groups.values():
        for gender in ("male", "female"):
            sex = cell.setdefault(gender, {"total": 0, "present": 0, "late": 0, "leave": 0, "absent": 0, "unrecorded": 0})
            missing = sex["total"] - sex["present"] - sex["late"]
            sex["absent"] = missing if (is_workday and cell["evidence"]) else 0
            sex["unrecorded"] = missing - sex["absent"]
        cell["rosterMale"] = cell["male"]["total"]
        cell["rosterFemale"] = cell["female"]["total"]
    return sorted(groups.values(), key=lambda cell: _class_sort_key(cell["name"]))
