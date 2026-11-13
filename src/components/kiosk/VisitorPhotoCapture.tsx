import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { validVisitorLiveness, cosine, type VisitorSample } from '../../../supabase/functions/_shared/visitorLiveness';

const steps = ['มองตรงเข้ากล้อง', 'หันหน้าไปด้านหนึ่งช้า ๆ', 'หันหน้าไปอีกด้านช้า ๆ', 'หลับตา', 'ลืมตา'];
const poses = ['front', 'left', 'right', 'closed', 'open'];
export default function VisitorPhotoCapture({ photo, onPhoto }: { photo: string; onPhoto: (photo: string, samples?: VisitorSample[]) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const stop = () => {
    generation.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null; setCamera(false);
  };
  useEffect(() => () => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const start = async () => {
    const run = ++generation.current;
    onPhoto('', []); setError(''); setCount(0); setMessage('กำลังเปิดกล้องและเตรียมตรวจใบหน้า…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('เปิดกล้องไม่ได้ กรุณาอนุญาตใช้กล้อง');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (run !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = media; setCamera(true);
      const api = await import('@/lib/faceApi');
      await api.loadFaceModels();
      if (run !== generation.current) return;
      const samples: VisitorSample[] = [];
      const deadline = Date.now() + 90000;
      let stable = 0;
      while (run === generation.current && samples.length < 5) {
        if (Date.now() > deadline) throw new Error('ถ่ายไม่ครบ กรุณาเริ่มใหม่ในบริเวณที่มีแสงเพียงพอ');
        const v = video.current;
        if (!v?.videoWidth) { await new Promise(r => setTimeout(r, 250)); continue; }
        setMessage(steps[samples.length]);
        const faces = await api.getAllDescriptors(v, undefined, { singleFace: false });
        if (faces.length !== 1) { stable = 0; setMessage('ให้มีผู้มาติดต่อเพียงคนเดียวในภาพ'); await new Promise(r => setTimeout(r, 300)); continue; }
        const detected = faces[0];
        const face = detected.descriptor ? { descriptor: detected.descriptor, yaw: api.estimateYaw(detected.landmarks), ear: api.averageEAR(detected.landmarks) } : null;
        if (run !== generation.current) return;
        if (!face?.descriptor) { stable = 0; setMessage('ไม่พบใบหน้าชัดเจน กรุณามองกล้อง'); await new Promise(r => setTimeout(r, 300)); continue; }
        const index = samples.length;
        const descriptor = Array.from(face.descriptor);
        if (index && cosine(samples[0].descriptor, descriptor) < .5) throw new Error('ใบหน้าเปลี่ยนระหว่างถ่าย กรุณาเริ่มใหม่');
        const qualifies = index === 0 ? Math.abs(face.yaw) < .15 : index === 1 ? face.yaw < -.18 : index === 2 ? face.yaw > .18 : index === 3 ? face.ear < .20 : face.ear > .25;
        stable = qualifies ? stable + 1 : 0;
        if (stable >= (index === 3 ? 1 : 2)) {
          const c = document.createElement('canvas'); c.width = 640; c.height = Math.round(640 * v.videoHeight / v.videoWidth);
          const ctx = c.getContext('2d'); if (!ctx) throw new Error('อ่านภาพไม่ได้');
          ctx.drawImage(v, 0, 0, c.width, c.height);
          samples.push({ pose: poses[index], image: c.toDataURL('image/jpeg', .75), descriptor, yaw: face.yaw, ear: face.ear, at: Date.now() });
          setCount(samples.length); stable = 0;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      if (run !== generation.current) return;
      if (!validVisitorLiveness(samples)) throw new Error('ตรวจการเคลื่อนไหวไม่ผ่าน กรุณาถ่ายใหม่');
      onPhoto(samples[0].image, samples); setMessage('ถ่ายครบและตรวจการเคลื่อนไหวแล้ว'); stop();
    } catch (e) {
      if (run !== generation.current) return;
      setError(e instanceof Error ? e.message : 'ตรวจใบหน้าไม่สำเร็จ'); stop();
    }
  };
  useEffect(() => { if (camera && video.current && stream.current) video.current.srcObject = stream.current; }, [camera]);
  return <div className="space-y-3">
    <Button type="button" variant="outline" disabled={camera} onClick={() => void start()}><Camera className="mr-2 h-4 w-4"/>{photo ? 'ถ่ายใหม่หลายมุม' : 'ถ่ายใบหน้าสดหลายมุม'}</Button>
    {camera && <><video ref={video} autoPlay muted playsInline className="aspect-[4/3] w-full rounded-md bg-muted object-contain" aria-label="กล้องผู้มาติดต่อ"/><Button type="button" variant="outline" onClick={stop}><X className="mr-2 h-4 w-4"/>ยกเลิกถ่าย</Button></>}
    {message && <p role="status" className="text-sm">{message} · {count}/5</p>}
    {!camera && photo && <img src={photo} alt="รูปผู้มาติดต่อ" className="h-36 w-36 rounded-md object-cover"/>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
