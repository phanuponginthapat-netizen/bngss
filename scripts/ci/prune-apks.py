#!/usr/bin/env python3
"""Retain only the exact verified current APK for a product, via the ci-storage function."""
import json, os, re, sys, urllib.request

def candidates(names, current, product):
    pattern = re.compile({
        "android": r"^bngss-app-(?:v[\d.]+(?:-\d+)?|latest)\.apk$",
        "scanner": r"^bngss-scanner-(?:build-\d+|latest)\.apk$",
        # FaceGate: only versioned ZIPs; facegate-agent-latest.zip and the manifest are never touched.
        "facegate": r"^facegate-agent-v[\d.]+(?:-\d+)?\.zip$",
    }[product])
    if not pattern.fullmatch(current) or current not in names:
        raise ValueError("Current APK missing; no files removed")
    return [n for n in names if pattern.fullmatch(n) and n != current]

def main():
    product, current = sys.argv[1:3]
    if product not in ("android", "scanner", "facegate"):
        raise ValueError("Invalid product")
    base = os.environ.get("SUPABASE_URL", "https://dlkyxvhnnffblerwedjz.supabase.co").rstrip("/")
    token = os.environ["CI_UPLOAD_TOKEN"]
    def call(body):
        req = urllib.request.Request(base + "/functions/v1/ci-storage", data=json.dumps(body).encode(),
                                     headers={"x-ci-token": token, "Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=180) as response:
            return json.load(response)
    # Verify the current file actually exists with bytes before listing/deleting.
    if not call({"action": "head", "path": current}).get("size"):
        raise ValueError("Empty current APK; no files removed")
    names, offset = [], 0
    while True:
        page = call({"action": "list", "prefix": "", "limit": 1000, "offset": offset})
        if not isinstance(page, list):
            raise ValueError("Invalid listing; no files removed")
        names.extend(row["name"] for row in page if row.get("id"))
        if len(page) < 1000:
            break
        offset += 1000
    obsolete = candidates(names, current, product)
    for i in range(0, len(obsolete), 100):
        call({"action": "delete", "paths": obsolete[i:i+100]})
    print("Removed old files:", len(obsolete), "Retained:", current)

if __name__ == "__main__":
    main()
