"""Bounded local exemplars, always anchored to Cloud enrollment, never self-trained."""
import math
import time

MAX_SAMPLES = 6
MAX_AGE = 30 * 86400
IDENTITY_MARGIN = .12


def identity_clear(sid, scores):
    """Closest original sample per distinct person; never geometry/adaptation."""
    own = scores.get(sid)
    if own is None or not math.isfinite(own):
        return False
    return all(math.isfinite(score) and
               (owner == sid or own - score >= IDENTITY_MARGIN)
               for owner, score in scores.items())


def cosine(a, b):
    if len(a) != 512 or len(b) != 512:
        return -1.0
    if not all(math.isfinite(v) for v in (*a, *b)):
        return -1.0
    norms = math.sqrt(sum(v*v for v in a) * sum(v*v for v in b))
    return sum(x*y for x, y in zip(a, b)) / norms if norms > .001 else -1.0


def prune(memory, anchors, now=None):
    now = time.time() if now is None else now
    return {sid: [s for s in samples if 0 <= now-s['at'] < MAX_AGE
                  and s.get('version') == anchors[sid]['version']][-MAX_SAMPLES:]
            for sid, samples in memory.items() if sid in anchors}


def learn(memory, anchors, sid, query, sharpness, detection, now=None):
    """Recheck original enrollment against ALL other identities before adapting."""
    now = time.time() if now is None else now
    if sid not in anchors or sharpness < 60 or detection < .8:
        return False
    scores = {owner: max((cosine(query, v) for v in a['vectors']), default=-1.)
              for owner, a in anchors.items()}
    own = scores[sid]
    rival = max((v for owner, v in scores.items() if owner != sid), default=-1.)
    if own < .8 or not identity_clear(sid, scores):
        return False
    samples = memory.setdefault(sid, [])
    # Repeated frames are inspected but not retained, reducing writes and drift.
    if samples and (now-samples[-1]['at'] < 60 or
                    max(cosine(query, s['embedding']) for s in samples) > .98):
        return False
    samples.append({'embedding':list(query), 'at':now, 'version':anchors[sid]['version']})
    del samples[:-MAX_SAMPLES]
    return True


def enrollment_anchors(faces):
    anchors = {}
    for fid, face in sorted(faces.items()):
        sid = face['student_id']
        a = anchors.setdefault(sid, {'vectors':[], 'version':''})
        a['vectors'].append(face['embedding'])
        a['version'] += fid + ':' + str(face.get('version', '')) + '|'
    return anchors