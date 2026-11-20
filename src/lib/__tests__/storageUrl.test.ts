// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ sign: vi.fn(), registry: vi.fn(), eq: vi.fn(), cold: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'staff' } } } }) },
  storage: { from: () => ({ createSignedUrl: mocks.sign }) },
  from: () => ({ select: () => ({ eq: mocks.eq }) }),
} }));
vi.mock('@/lib/runtimeConfig', () => ({ getBackendConfig: () => ({ url: 'https://backend.example', anonKey: 'public' }) }));
vi.mock('../coldStorage', () => ({ getPrivateColdStorageUrl: mocks.cold, getColdStorageFetchUrl: vi.fn() }));

beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.registry });
  mocks.registry.mockResolvedValue({ data: null, error: null });
  mocks.sign.mockResolvedValue({ data: null, error: new Error('Object not found') });
  mocks.cold.mockResolvedValue('blob:verified-drive-file');
});

it('never fetches an unregistered missing homework file from Drive', async () => {
  const { resolveStorageUrl } = await import('../storageUrl');
  await expect(resolveStorageUrl('homework-files', 'submissions/missing.jpg')).rejects.toThrow('Object not found');
  expect(mocks.eq).toHaveBeenCalledWith('bucket_name', 'homework-files');
  expect(mocks.eq).toHaveBeenCalledWith('file_path', 'submissions/missing.jpg');
  expect(mocks.cold).not.toHaveBeenCalled();
});

it('opens a registered Drive copy instead of signing a deleted Cloud object', async () => {
  mocks.registry.mockResolvedValue({ data: { drive_file_id: 'verified-copy' }, error: null });
  const { resolveStorageUrl } = await import('../storageUrl');
  expect(await resolveStorageUrl('homework-files', 'submissions/archived.jpg')).toBe('blob:verified-drive-file');
  expect(mocks.cold).toHaveBeenCalledWith('homework-files', 'submissions/archived.jpg');
  expect(mocks.sign).not.toHaveBeenCalled();
});

it('propagates registry outages without treating them as absent archives', async () => {
  mocks.registry.mockResolvedValue({ data: null, error: new Error('Registry unavailable') });
  const { resolveStorageUrl } = await import('../storageUrl');
  await expect(resolveStorageUrl('homework-files', 'submissions/photo.jpg')).rejects.toThrow('Registry unavailable');
  expect(mocks.cold).not.toHaveBeenCalled();
});

it('still signs existing private Cloud files', async () => {
  mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://backend.example/fresh' }, error: null });
  const { resolveStorageUrl } = await import('../storageUrl');
  expect(await resolveStorageUrl('homework-files', 'submissions/present.jpg')).toBe('https://backend.example/fresh');
  expect(mocks.cold).not.toHaveBeenCalled();
});

it('explicit media retry renews only the failed object token', async () => {
  mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://backend.example/first' }, error: null });
  const { resolveStorageUrl, invalidateStorageSignedUrl } = await import('../storageUrl');
  await resolveStorageUrl('wall-media', 'owner/photo.jpg');
  await resolveStorageUrl('wall-media', 'owner/other.jpg');
  await invalidateStorageSignedUrl('wall-media', 'owner/photo.jpg');
  mocks.sign.mockResolvedValue({ data: { signedUrl: 'https://backend.example/renewed' }, error: null });
  expect(await resolveStorageUrl('wall-media', 'owner/photo.jpg')).toBe('https://backend.example/renewed');
  expect(await resolveStorageUrl('wall-media', 'owner/other.jpg')).toBe('https://backend.example/first');
  expect(mocks.sign).toHaveBeenCalledTimes(3);
});