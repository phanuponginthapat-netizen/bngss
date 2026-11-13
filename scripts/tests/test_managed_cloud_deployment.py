"""Prevent retired backend deploy jobs from blocking or mutating Cloud releases."""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

class ManagedCloudDeploymentTests(unittest.TestCase):
    def test_function_entrypoint_never_deploys_to_external_backend(self):
        source = (ROOT / '.github/workflows/deploy-edge-functions.yml').read_text()
        self.assertNotIn('supabase functions deploy', source)
        self.assertNotIn('PROJECT_REF:', source)
        self.assertNotIn('secrets.SUPABASE_ACCESS_TOKEN', source)

    def test_database_entrypoint_never_pushes_or_repairs_history(self):
        source = (ROOT / '.github/workflows/supabase-db-push.yml').read_text()
        self.assertNotIn('supabase db push', source)
        self.assertNotIn('supabase migration repair', source)
        self.assertNotIn('supabase link', source)

    def test_web_release_has_no_external_backend_dependency(self):
        source = (ROOT / '.github/workflows/auto-deploy.yml').read_text()
        self.assertIn('uses: ./.github/workflows/deploy-vercel.yml', source)
        self.assertIn('needs: changes', source)
        self.assertNotIn('needs.database', source)
        self.assertNotIn('needs.functions', source)
        self.assertNotIn('uses: ./.github/workflows/deploy-edge-functions.yml', source)
        self.assertNotIn('uses: ./.github/workflows/supabase-db-push.yml', source)

if __name__ == '__main__':
    unittest.main()
