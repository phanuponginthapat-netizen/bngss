// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ saved: 'current-test-only', env: 'retired-test-only' }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.49.1', () => ({
  createClient: () => ({ rpc: async () => ({ data: state.saved, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
}));
import { getSecret, invalidateSecretCache } from '../../../supabase/functions/_shared/getSecret';

describe('workspace secret precedence', () => {
  beforeEach(() => {
    invalidateSecretCache();
    state.saved = 'current-test-only';
    vi.stubGlobal('Deno', { env: { get: (key: string) => key === 'SUPABASE_URL' ? 'https://example.test' : key === 'SUPABASE_SERVICE_ROLE_KEY' ? 'service-test-only' : state.env } });
  });
  it('uses saved Cloud credentials instead of stale workspace credentials', async () => {
    expect(await getSecret('LINE_VAULT_CHANNEL_ACCESS_TOKEN')).toBe('current-test-only');
  });
  it('uses environment credentials only when none were saved', async () => {
    state.saved = '';
    expect(await getSecret('LINE_VAULT_CHANNEL_ACCESS_TOKEN')).toBe('retired-test-only');
  });
});