"""Durable scan queue, compatible with existing outbox.jsonl files."""
import json
import os
import threading
from collections import Counter


class ScanOutbox:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.flush_lock = threading.Lock()
        self.last_error = None
        self.last_uploaded_at = None

    def _lines(self):
        try:
            with open(self.path, encoding="utf-8") as stream:
                return [line for line in stream if line.strip()]
        except FileNotFoundError:
            return []

    def count(self):
        with self.lock:
            return len(self._lines())

    def append(self, payload):
        line = json.dumps(payload, ensure_ascii=False) + "\n"
        with self.lock:
            os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
            with open(self.path, "a", encoding="utf-8") as stream:
                stream.write(line)
                stream.flush()
                os.fsync(stream.fileno())

    def flush(self, send):
        if not self.flush_lock.acquire(blocking=False):
            return
        try:
            with self.lock:
                lines = self._lines()
            confirmed = Counter()
            review_error = None
            for line in lines:
                try:
                    payload = json.loads(line)
                    if not payload.get("scanned_at"):
                        review_error = "Pending scan has no original timestamp; manual review required"
                        continue  # Retain unresolved evidence, but do not block later valid scans.
                    reply = send(payload)
                    if reply.get("result") not in ("ok", "duplicate"):
                        raise RuntimeError(reply.get("message") or "Cloud did not confirm attendance")
                    confirmed[line] += 1
                    self.last_error = None
                    import time
                    self.last_uploaded_at = time.time()
                except Exception as exc:
                    self.last_error = str(exc)
                    # Keep ordering and avoid hammering an unavailable server.
                    break
            if confirmed:
                with self.lock:
                    remaining = []
                    for line in self._lines():
                        if confirmed[line]:
                            confirmed[line] -= 1
                        else:
                            remaining.append(line)
                    with open(self.path + ".tmp", "w", encoding="utf-8") as stream:
                        stream.writelines(remaining)
                        stream.flush()
                        os.fsync(stream.fileno())
                    os.replace(self.path + ".tmp", self.path)
            if review_error:
                self.last_error = review_error
        finally:
            self.flush_lock.release()