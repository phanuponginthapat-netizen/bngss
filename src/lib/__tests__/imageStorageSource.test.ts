import { describe, expect, it } from 'vitest';
import { imageStorageSource } from '../imageStorageSource';
describe('image storage source', () => {
  it('recovers private paths from old public and expired signed origins', () => {
    for (const access of ['public','sign','authenticated']) expect(imageStorageSource(`https://old.example/storage/v1/object/${access}/face-photos/requests/a%20b.jpg?token=old`)).toEqual({ bucket:'face-photos',path:'requests/a b.jpg' });
  });
  it('accepts saved face and homework paths in their own bucket', () => {
    expect(imageStorageSource('requests/student/photo.jpg','face-photos')).toEqual({bucket:'face-photos',path:'requests/student/photo.jpg'});
    expect(imageStorageSource('homework-files/student/photo.jpg','homework-files')).toEqual({bucket:'homework-files',path:'student/photo.jpg'});
  });
  it('never rewrites ordinary images or local previews', () => {
    for (const value of ['https://images.example/photo.jpg','data:image/jpeg;base64,abc','blob:local','/assets/logo.png']) expect(imageStorageSource(value)).toBeNull();
  });
});