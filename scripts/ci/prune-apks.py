#!/usr/bin/env python3
"""Retain only the exact verified current APK for a product, via Storage API."""
import json, os, re, sys, urllib.request

def candidates(names, current, product):
    pattern = re.compile(r"^bngss-app-(?:v[\d.]+(?:-\d+)?|latest)\.apk$" if product == "android" else r"^bngss-scanner-(?:build-\d+|latest)\.apk$")
    if not pattern.fullmatch(current) or current not in names:
        raise ValueError("Current APK missing; no files removed")
    return [n for n in names if pattern.fullmatch(n) and n != current]

def main():
    product, current = sys.argv[1:3]
    if product not in ("android", "scanner"):
        raise ValueError("Invalid product")
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_ANON_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key, "Content-Type": "application/json"}
    def call(path, body, method="POST"):
        req = urllib.request.Request(base + path, data=json.dumps(body).encode(), headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    # Verify the current bytes are actually downloadable before listing/deleting.
    with urllib.request.urlopen(urllib.request.Request(base + "/storage/v1/object/app-downloads/" + current, headers=headers), timeout=120) as response:
        if not response.read(16):
            raise ValueError("Empty current APK; no files removed")
    names, offset = [], 0
    while True:
        page = call("/storage/v1/object/list/app-downloads", {"prefix": "", "limit": 1000, "offset": offset, "sortBy": {"column": "name", "order": "asc"}})
        if not isinstance(page, list):
            raise ValueError("Invalid listing; no files removed")
        names.extend(row["name"] for row in page if row.get("id"))
        if len(page) < 1000:
            break
        offset += 1000
    obsolete = candidates(names, current, product)
    for i in range(0, len(obsolete), 100):
        call("/storage/v1/object/app-downloads", {"prefixes": obsolete[i:i+100]}, "DELETE")
    print("Removed old APKs:", len(obsolete), "Retained:", current)

if __name__ == "__main__":
    main()