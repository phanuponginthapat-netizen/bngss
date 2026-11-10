import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { storage: { from: vi.fn() } } }));
import { storageMediaPath, validSocialLink } from '../socialMedia';
describe('social media durability and safe links', () => {
 it('preserves durable upload paths', () => expect(storageMediaPath('owner/work.pdf', 'portfolio')).toBe('owner/work.pdf'));
 it('does not treat foreign signed links as school storage', () => expect(storageMediaPath('https://example.com/storage/v1/object/sign/portfolio/work.pdf', 'portfolio')).toBeNull());
 it('renews legacy signed URLs from the active backend', () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://school.example');
  expect(storageMediaPath('https://school.example/storage/v1/object/sign/portfolio/owner/work.pdf?token=expired', 'portfolio')).toBe('owner/work.pdf');
  vi.unstubAllEnvs();
 });
 it('rejects executable links', () => expect(validSocialLink('javascript:alert(1)')).toBe(false));
 it('accepts school web links', () => expect(validSocialLink('https://bngss.lovable.app')).toBe(true));
});
