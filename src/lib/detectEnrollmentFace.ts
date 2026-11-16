import * as faceapi from '@vladmandic/face-api';
import { detectorOptionsHQ, detectFaceWithLandmarks } from './faceApi';

export async function detectEnrollmentFace(source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement) {
  const faces = await faceapi.detectAllFaces(source, detectorOptionsHQ(416, .5));
  if (faces.length !== 1) throw new Error(faces.length ? 'มีหลายคนในรูป กรุณาใช้รูปนักเรียนคนเดียว' : 'ไม่พบใบหน้า กรุณาใช้รูปหน้าชัดเจน');
  return detectFaceWithLandmarks(source);
}