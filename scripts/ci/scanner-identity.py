#!/usr/bin/env python3
"""Set scanner identity after Capacitor sync, in the scanner CI checkout only."""
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

def configure(root: Path):
    gradle = root / 'android/app/build.gradle'
    content = gradle.read_text()
    content, count = re.subn(r'applicationId\s+"com\.bngss\.(?:app|scanner)"',
                             'applicationId "com.bngss.scanner"', content)
    if count != 1:
        raise ValueError('Expected exactly one Android applicationId')
    gradle.write_text(content)
    values = {'app_name': 'BNG Scanner', 'title_activity_main': 'BNG Scanner',
              'package_name': 'com.bngss.scanner', 'custom_url_scheme': 'com.bngss.scanner'}
    for path in (root / 'android/app/src').glob('**/res/values*/strings.xml'):
        tree = ET.parse(path)
        for node in tree.getroot().findall('string'):
            if node.get('name') in values:
                node.text = values[node.get('name')]
        tree.write(path, encoding='utf-8', xml_declaration=True)
    # Literal labels also protect against translated or generated resource overrides.
    android = '{http://schemas.android.com/apk/res/android}'
    ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
    for path in (root / 'android/app/src').glob('*/AndroidManifest.xml'):
        tree = ET.parse(path)
        for node in tree.getroot().iter():
            if node.tag == 'application' or (node.tag in ('activity', 'activity-alias') and android + 'label' in node.attrib):
                node.set(android + 'label', 'BNG Scanner')
        tree.write(path, encoding='utf-8', xml_declaration=True)
    print('Scanner checkout configured: BNG Scanner / com.bngss.scanner')

if __name__ == '__main__':
    configure(Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.'))