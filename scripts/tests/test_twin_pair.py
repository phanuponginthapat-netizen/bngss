import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "kiosk", "facegate-agent"))
from twin_pair import twin_partner, pick_twin

P = {"a": {"full_name": "ด.ญ.สาธิมา ชมภูแก้ว", "person_type": "student"},
     "b": {"full_name": "ด.ญ.สาธิตา ชมภูแก้ว", "person_type": "student"},
     "c": {"full_name": "ด.ช.อื่น ใจดี", "person_type": "student"}}

def test_twins_detected():
    assert twin_partner("a", {"a": .7, "b": .68, "c": .3}, P, .45) == "b"

def test_different_surname_not_twins():
    assert twin_partner("a", {"a": .7, "c": .68}, P, .45) is None

def test_third_person_close_blocks():
    assert twin_partner("a", {"a": .7, "b": .68, "c": .6}, P, .45) is None

def test_first_second_third_scan():
    seen = set()
    s = lambda x: x in seen
    first = pick_twin("a", "b", s); seen.add(first); assert first == "a"
    second = pick_twin("a", "b", s); seen.add(second); assert second == "b"
    assert pick_twin("b", "a", s) == "b"  # third scan -> duplicate
