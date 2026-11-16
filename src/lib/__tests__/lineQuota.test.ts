// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readLineQuota } from '../../../supabase/functions/_shared/lineQuota';

describe('LINE complete quota reads', () => {
  it('preserves measured usage', async () => {
    const request = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).endsWith('/consumption') ? { totalUsage: 79 } : { type: 'limited', value: 300 })));
    expect(await readLineQuota('test-only', request as typeof fetch)).toEqual({ quota: { type: 'limited', value: 300 }, consumption: { totalUsage: 79 } });
  });
  it('does not publish success when consumption fails', async () => {
    const request = vi.fn(async (url: string | URL | Request) => String(url).endsWith('/consumption') ? new Response('unavailable', { status: 503 }) : new Response('{"type":"limited","value":300}'));
    await expect(readLineQuota('test-only', request as typeof fetch)).rejects.toThrow('[503]: unavailable');
  });
  it('rejects missing usage rather than inventing zero', async () => {
    const request = vi.fn(async (url: string | URL | Request) => new Response(String(url).endsWith('/consumption') ? '{}' : '{"type":"limited","value":300}'));
    await expect(readLineQuota('test-only', request as typeof fetch)).rejects.toThrow('incomplete');
  });
});