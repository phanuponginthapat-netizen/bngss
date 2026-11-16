"""Conservative enrollment gates; not a claim of certified anti-spoofing."""
import math


def quality_error(faces, previous=()):
    if len(faces) != 1:
        return 'กรุณายืนหน้ากล้องเพียงคนเดียว'
    face = faces[0]
    box = face.get('box', {})
    if min(box.get('width', 0), box.get('height', 0)) < 100:
        return 'กรุณาขยับเข้าใกล้กล้อง'
    if face.get('score', 0) < .8 or face.get('sharpness', 0) < 60 or face.get('colorSpread', 0) < 18:
        return 'ภาพไม่ชัด กรุณาเพิ่มแสงและอยู่นิ่ง'
    vec = face.get('descriptor', [])
    if len(vec) != 512 or not all(isinstance(v, (float, int)) and math.isfinite(v) for v in vec):
        return 'อ่านข้อมูลใบหน้าไม่สำเร็จ'
    norm = math.sqrt(sum(v*v for v in vec))
    if norm < .01:
        return 'อ่านข้อมูลใบหน้าไม่สำเร็จ'
    for old in previous:
        other = old['descriptor']
        other_norm = math.sqrt(sum(v*v for v in other))
        similarity = sum(a*b for a,b in zip(vec, other)) / (norm * max(other_norm, .01))
        if similarity < .65:
            return 'ใบหน้าไม่ตรงกับภาพก่อนหน้า กรุณาเริ่มใหม่'
    return None