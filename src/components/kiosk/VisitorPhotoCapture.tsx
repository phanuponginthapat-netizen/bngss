import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { validVisitorLiveness, cosine, type VisitorSample } from '../../../supabase/functions/_shared/visitorLiveness';

const steps = ['มองตรงเข้ากล้อง', 'หันหน้าไปด้านหนึ่งช้า ๆ', 'หันหน้าไปอีกด้านช้า ๆ', 'หลับตา', 'ลืมตา'];
const poses = ['front', 'left', 'right', 'closed', 'open'];
function bounded<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
export default function VisitorPhotoCapture({ photo, onPhoto }: { photo: string; onPhoto: (photo: string, samples?: VisitorSample[]) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const apiRef = useRef<typeof import('@/lib/faceApi') | null>(null);
  const shooting = useRef(false);
  const [camera, setCamera] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);
  const stop = () => {
    generation.current++; shooting.current = false;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null; setCamera(false); setReady(false); setCapturing(false);
  };
  useEffect(() => () => { generation.current++; stream.current?.getTracks().forEach(track => track.stop()); }, []);
  const start = async () => {
    const run = ++generation.current;
    onPhoto('', []); setError(''); setCount(0); setReady(false); setCamera(true); setMessage('กำลังเปิดกล้อง…');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('เปิดกล้องไม่ได้ กรุณาอนุญาตใช้กล้อง');
      const request = navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      void request.then(media => { if (run !== generation.current) media.getTracks().forEach(track => track.stop()); }, () => {});
      const media = await bounded(request, 20000, 'ยังไม่ได้รับสิทธิ์กล้อง กรุณาอนุญาตกล้องแล้วลองใหม่');
      if (run !== generation.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      // The portal video can mount after getUserMedia resolves.
      await bounded((async () => {
        while (run === generation.current) {
          const v = video.current;
          if (v) { v.srcObject = media; await v.play(); if (v.videoWidth && v.readyState >= 2) { setPortrait(v.videoHeight > v.videoWidth); return; } }
          await new Promise(r => setTimeout(r, 100));
        }
      })(), 10000, 'กล้องยังไม่ส่งภาพ กรุณาปิดกล้องในแอปอื่นแล้วลองใหม่');
      if (run !== generation.current) return;
      setMessage('กำลังเตรียมตรวจใบหน้า…');
      const api = await bounded(import('@/lib/faceApi'), 20000, 'โหลดตัวตรวจใบหน้าไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');
      await bounded(api.loadFaceModels(msg => { if (run === generation.current) setMessage(msg); }), 60000, 'เตรียมตรวจใบหน้านานเกินไป กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่');
      if (run !== generation.current) return;
      apiRef.current = api; setReady(true); setMessage('มองตรงเข้ากล้อง');
    } catch (e) {
      if (run !== generation.current) return;
      setError(e instanceof Error ? e.message : 'เปิดกล้องไม่สำเร็จ'); setMessage(''); stop();
    }
  };
  const capture = async () => {
    const api = apiRef.current;
    if (!ready || !api || shooting.current) return;
    shooting.current = true; setCapturing(true);
    const run = generation.current;
    try {
      const samples: VisitorSample[] = [];
      const deadline = Date.now() + 90000;
      let stable = 0;
      while (run === generation.current && samples.length < 5) {
        if (Date.now() > deadline) throw new Error('ถ่ายไม่ครบ กรุณาเริ่มใหม่ในบริเวณที่มีแสงเพียงพอ');
        const v = video.current;
        if (!v?.videoWidth) throw new Error('ภาพจากกล้องหยุด กรุณาเปิดกล้องใหม่');
        setMessage(steps[samples.length]);
        // Detect and save the same frozen frame, not a later live-video pose.
        const frame = document.createElement('canvas'); frame.width = 640; frame.height = Math.round(640 * v.videoHeight / v.videoWidth);
        const ctx = frame.getContext('2d'); if (!ctx) throw new Error('อ่านภาพไม่ได้');
        ctx.drawImage(v, 0, 0, frame.width, frame.height);
        const faces = await bounded(api.getAllDescriptors(frame, undefined, { singleFace: false }), 15000, 'ตรวจใบหน้าไม่ตอบสนอง กรุณาลองใหม่');
        if (run !== generation.current) return;
        if (faces.length !== 1) { stable = 0; setMessage(faces.length ? 'ให้มีผู้มาติดต่อเพียงคนเดียวในภาพ' : 'ไม่พบใบหน้า กรุณามองตรงและเพิ่มแสง'); await new Promise(r => setTimeout(r, 300)); continue; }
        const detected = faces[0];
        if (!detected.descriptor || detected.descriptor.length !== 512) { stable = 0; setMessage('อ่านใบหน้าไม่ได้ กรุณามองกล้องให้ชัดเจน'); await new Promise(r => setTimeout(r, 300)); continue; }
        const face = { descriptor: detected.descriptor, yaw: api.estimateYaw(detected.landmarks), ear: api.averageEAR(detected.landmarks) };
        const index = samples.length;
        const descriptor = Array.from(face.descriptor);
        if (index && cosine(samples[0].descriptor, descriptor) < .5) throw new Error('ใบหน้าเปลี่ยนระหว่างถ่าย กรุณาเริ่มใหม่');
        const qualifies = index === 0 ? Math.abs(face.yaw) < .15 : index === 1 ? face.yaw < -.18 : index === 2 ? face.yaw > .18 : index === 3 ? face.ear < .20 : face.ear > .25;
        stable = qualifies ? stable + 1 : 0;
        if (stable >= (index === 3 ? 1 : 2)) {
          samples.push({ pose: poses[index], image: frame.toDataURL('image/jpeg', .75), descriptor, yaw: face.yaw, ear: face.ear, at: Date.now() });
          setCount(samples.length); stable = 0;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      if (run !== generation.current) return;
      if (!validVisitorLiveness(samples)) throw new Error('ตรวจการเคลื่อนไหวไม่ผ่าน กรุณาถ่ายใหม่');
      onPhoto(samples[0].image, samples); setMessage('ถ่ายครบและตรวจการเคลื่อนไหวแล้ว'); stop();
    } catch (e) {
      if (run !== generation.current) return;
      setError(e instanceof Error ? e.message : 'ตรวจใบหน้าไม่สำเร็จ'); setMessage(''); stop();
    }
  };
  return <div className="space-y-3">
    <Button type="button" variant="outline" className="min-h-12 w-full" onClick={() => void start()}><Camera className="mr-2 h-5 w-5"/>{photo ? 'ถ่ายใหม่หลายมุม' : 'เปิดกล้องถ่ายใบหน้า'}</Button>
    <Dialog open={camera} onOpenChange={open => { if (!open) { setMessage(''); stop(); } }}>
      <DialogContent className="flex flex-col gap-3 overflow-hidden sm:max-w-2xl sm:h-[85dvh]">
        <DialogTitle className="shrink-0 pr-8">ถ่ายใบหน้าผู้มาติดต่อ</DialogTitle>
        <DialogDescription className="sr-only">ถ่ายใบหน้าสดหลายมุมและตรวจการเคลื่อนไหว</DialogDescription>
        <div className="relative grid min-h-0 flex-1 place-items-center overflow-hidden rounded-md bg-muted [container-type:size]">
          <div className={portrait ? 'relative aspect-[3/4] w-[min(100%,75cqh)]' : 'relative aspect-[4/3] w-[min(100%,133cqh)]'}>
          <video ref={video} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" aria-label="กล้องผู้มาติดต่อ"/>
          <div aria-label="กรอบใบหน้า" className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[45%] border-4 border-primary"/>
          </div>
        </div>
        <div className="shrink-0 space-y-3">
          <p role="status" className="min-h-12 text-center text-base font-medium">{message}<span className="block text-sm text-muted-foreground">{count}/5</span></p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="min-h-12" onClick={() => { setMessage(''); stop(); }}><X className="mr-2 h-4 w-4"/>ยกเลิก</Button>
            <Button type="button" className="min-h-12 flex-1" disabled={!ready || capturing} onClick={() => void capture()}>{!ready || capturing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Camera className="mr-2 h-5 w-5"/>}{capturing ? 'กำลังถ่ายหลายมุม' : !ready ? 'กำลังเตรียม…' : 'เริ่มถ่ายใบหน้า'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {!camera && message && <p role="status" className="text-sm">{message} · {count}/5</p>}
    {!camera && photo && <img src={photo} alt="รูปผู้มาติดต่อ" className="mx-auto max-h-80 w-full rounded-md object-contain"/>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}