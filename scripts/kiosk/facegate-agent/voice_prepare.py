"""Cloud roster speech preparation; no standalone database dependency."""
import threading


def sentences(people, settings):
    result = [settings.get('voice_denied_text') or 'ไม่พบข้อมูลในทะเบียน กรุณาติดต่อเจ้าหน้าที่',
              settings.get('voice_duplicate_text') or 'บันทึกเวลาไปแล้ว',
              'ทดสอบเสียง สแกนสำเร็จ ยินดีต้อนรับ', 'บันทึกผู้มาติดต่อแล้ว']
    for person in people:
        if person.get('is_active') is False or person.get('person_type') == 'visitor':
            continue
        name = str(person.get('full_name') or '').strip()
        if name:
            result.extend([f"{settings.get('voice_welcome_text') or 'ยินดีต้อนรับ'} {name}", f'เดินทางปลอดภัย {name}'])
    return list(dict.fromkeys(result))


class VoicePreparation:
    def __init__(self):
        self.lock = threading.Lock()
        self.progress = {'running': False, 'total': 0, 'ready': 0, 'failed': 0}

    def status(self):
        with self.lock:
            return dict(self.progress)

    def start(self, people, settings, synthesize):
        with self.lock:
            if self.progress['running']:
                return False
            items = sentences(people, settings)
            self.progress = {'running': True, 'total': len(items), 'ready': 0, 'failed': 0}

        def run():
            try:
                for text in items:
                    try:
                        ok = bool(synthesize(text))
                    except Exception:
                        ok = False
                    with self.lock:
                        self.progress['ready' if ok else 'failed'] += 1
            finally:
                with self.lock:
                    self.progress['running'] = False
        threading.Thread(target=run, daemon=True).start()
        return True