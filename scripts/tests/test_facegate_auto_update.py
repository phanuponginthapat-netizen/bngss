import hashlib
import io
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime
import zipfile
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).parents[1] / 'kiosk/facegate-agent'))
import auto_update as updater

class UpdateTests(unittest.TestCase):
    def archive(self):
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w') as z:
            for name in ('agent.py', 'auto_update.py', 'requirements.txt', '../config.env', 'config.env', 'outbox.jsonl'):
                z.writestr('facegate-agent/' + name, 'new')
        return stream.getvalue()

    def test_only_updates_at_three_am(self):
        self.assertTrue(updater.update_window(datetime(2026, 11, 14, 3, 0)))
        for hour in (2, 4, 6, 8, 15):
            self.assertFalse(updater.update_window(datetime(2026, 11, 14, hour, 0)))

    def test_checksum_rejects_modified_download(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                updater.unpack_verified(self.archive(), '0' * 64, Path(tmp))

    def test_never_extracts_config_or_outbox_or_traversal(self):
        body = self.archive()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            updater.unpack_verified(body, hashlib.sha256(body).hexdigest(), root)
            self.assertEqual(sorted(p.name for p in root.iterdir()), ['agent.py', 'auto_update.py', 'requirements.txt'])

    def test_failed_start_restores_program_dependencies_and_preserves_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            stage = root / '.update-stage'
            stage.mkdir()
            for directory in (root / '.venv', stage / '.venv'):
                directory.mkdir()
            (root / '.venv/identity').write_text('old dependencies')
            (root / 'agent.py').write_text('old program')
            (stage / 'agent.py').write_text('new program')
            (root / 'config.env').write_text('settings')
            (root / 'outbox.jsonl').write_text('pending attendance')
            failed = Mock()
            failed.poll.return_value = 1
            restored = Mock()
            with patch.object(updater, 'stop'), patch.object(updater, 'start', side_effect=[failed, restored]):
                self.assertIs(updater.install(root, stage, Mock(), '1.13.0'), restored)
            self.assertEqual((root / 'agent.py').read_text(), 'old program')
            self.assertEqual((root / '.venv/identity').read_text(), 'old dependencies')
            self.assertEqual((root / 'config.env').read_text(), 'settings')
            self.assertEqual((root / 'outbox.jsonl').read_text(), 'pending attendance')

if __name__ == '__main__':
    unittest.main()