"""Look-alike twins: two siblings who match each other may both pass once per day.

The first scan of the day goes to the better match, the second scan to the
sibling who has not been recorded yet, and any further scan is a duplicate.
Only applies when the top two people share a surname and every other person
is clearly further away, so strangers are never swapped in.
"""
from face_memory import IDENTITY_MARGIN


def surname(person):
    parts = (person.get("full_name") or "").split()
    return parts[-1] if len(parts) >= 2 else ""


def twin_partner(best, scores, people, threshold):
    """Return the sibling id when best/second form an identifiable twin pair."""
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    if len(ranked) < 2 or ranked[0][0] != best:
        return None
    other, other_score = ranked[1]
    a, b = people.get(best) or {}, people.get(other) or {}
    if a.get("person_type") != "student" or b.get("person_type") != "student":
        return None
    name = surname(a)
    if not name or name != surname(b) or other_score < threshold or ranked[0][1] < threshold:
        return None
    third = ranked[2][1] if len(ranked) > 2 else -1.0
    if other_score - third < IDENTITY_MARGIN:
        return None
    return other


def pick_twin(best, partner, scanned):
    """Unscanned best first, then unscanned partner; both scanned -> best (duplicate)."""
    if not scanned(best):
        return best
    if not scanned(partner):
        return partner
    return best
