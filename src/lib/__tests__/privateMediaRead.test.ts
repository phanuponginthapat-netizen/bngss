// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ resolve: vi.fn(), open: vi.fn() }));
vi.mock('../storageUrl', () => ({ resolveStorageUrl: mocks.resolve }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/uploadFallback', () => ({ sanitizeStorageKey: (value: string) => value }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue('https://school.example/fresh');
  vi.stubGlobal('window', { open: mocks.open });
});

it('renews saved asset photo tokens rather than trusting the expired URL', async () => {
  const { resolveAssetPhotoUrl } = await import('../assetPhotoUrl');
  expect(await resolveAssetPhotoUrl('https://school.example/storage/v1/object/sign/asset-photos/ict/photo.jpg?token=expired')).toBe('https://school.example/fresh');
  expect(mocks.resolve).toHaveBeenCalledWith('asset-photos', 'ict/photo.jpg');
});

it('routes missing AR media through exact archive validation and surfaces failure', async () => {
  mocks.resolve.mockRejectedValue(new Error('Object not found'));
  const { resolveArUrl } = await import('../arMedia');
  await expect(resolveArUrl('storage:missing.mind')).rejects.toThrow('Object not found');
  expect(mocks.resolve).toHaveBeenCalledWith('ar-media', 'missing.mind');
});

it('renews legacy leave attachment URLs before opening them', async () => {
  const { openLeaveAttachment } = await import('../leaveAttachment');
  const old = 'https://school.example/storage/v1/object/sign/leave-attachments/owner/file.pdf?token=expired';
  await openLeaveAttachment(old);
  expect(mocks.resolve).toHaveBeenCalledWith('leave-attachments', old);
  expect(mocks.open).toHaveBeenCalledWith('https://school.example/fresh', '_blank', 'noopener,noreferrer');
});

it('resolves portfolio paths through verified Cloud or archive reads', async () => {
  const { resolveSocialMedia } = await import('../socialMedia');
  expect(await resolveSocialMedia('owner/file.jpg', 'portfolio')).toBe('https://school.example/fresh');
  expect(mocks.resolve).toHaveBeenCalledWith('portfolio', 'owner/file.jpg');
});