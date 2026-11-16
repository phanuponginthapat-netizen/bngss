// @vitest-environment node
import { expect, it, vi } from 'vitest';
const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/lib/profileImageUrl', () => ({ resolveProfileImageUrl: resolve }));
import { loadFaceSyncImage } from '../faceSyncImage';

it('loads a private saved portrait through a fresh authenticated URL', async () => {
  resolve.mockResolvedValue('https://current.example/signed/fresh');
  const image = {} as HTMLImageElement;
  const load = vi.fn().mockResolvedValue(image);
  expect(await loadFaceSyncImage('https://old.example/public/avatar.webp', load)).toBe(image);
  expect(resolve).toHaveBeenCalledWith('https://old.example/public/avatar.webp', true);
  expect(load).toHaveBeenCalledWith('https://current.example/signed/fresh');
});

it('does not disguise an unreadable portrait as a detection failure', async () => {
  resolve.mockResolvedValue('https://current.example/signed/fresh');
  await expect(loadFaceSyncImage('portrait', vi.fn().mockRejectedValue(new Error('404'))))
    .rejects.toThrow('อ่านไฟล์รูปไม่ได้');
});