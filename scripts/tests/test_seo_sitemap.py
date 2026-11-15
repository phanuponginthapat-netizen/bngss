import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class SitemapPrivacyTests(unittest.TestCase):
    def test_public_routes_exclude_school_record_and_auth_urls(self):
        tree = ET.parse(ROOT / 'public/sitemap.xml')
        urls = [node.text for node in tree.findall('{*}url/{*}loc')]
        self.assertIn('https://bngss.online/news', urls)
        for url in urls:
            self.assertTrue(url.startswith('https://bngss.online/'))
            self.assertFalse(any(path in url for path in ['/dashboard', '/login', '/signup', '/sdq-assess/', '/p/']))

    def test_no_generated_modification_dates(self):
        tree = ET.parse(ROOT / 'public/sitemap.xml')
        self.assertEqual(tree.findall('{*}url/{*}lastmod'), [])

if __name__ == '__main__':
    unittest.main()