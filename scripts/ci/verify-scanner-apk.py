#!/usr/bin/env python3
"""Fail publication unless the final APK has the correct Android identity."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

def identity_from_badging(badging: str):
    package = re.search(r"^package: name='([^']+)'", badging, re.M)
    labels = re.findall(r"^application-label(?:-[^:]+)?:'([^']*)'", badging, re.M)
    launchers = re.findall(r"^launchable-activity:.*?label='([^']*)'", badging, re.M)
    if not package or package.group(1) != 'com.bngss.scanner':
        raise ValueError('Refusing publication: APK is not com.bngss.scanner')
    if not labels or any(label != 'BNG Scanner' for label in labels):
        raise ValueError('Refusing publication: APK installer label is not BNG Scanner')
    if not launchers or any(label != 'BNG Scanner' for label in launchers):
        raise ValueError('Refusing publication: APK launcher label is not BNG Scanner')
    return {'appId': package.group(1), 'appName': 'BNG Scanner', 'identityVerified': True}

if __name__ == '__main__':
    aapt, apk, output = sys.argv[1:]
    badging = subprocess.check_output([aapt, 'dump', 'badging', apk], text=True)
    identity = identity_from_badging(badging)
    identity['sha256'] = hashlib.sha256(Path(apk).read_bytes()).hexdigest()
    Path(output).write_text(json.dumps(identity))
    print('Final APK verified: BNG Scanner / com.bngss.scanner')