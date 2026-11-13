import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function VisitorPhotoCapture({ photo, onPhoto }: { photo: string; onPhoto: (photo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const opening = useRef(0);
  const [camera, setCamera] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const stop = () => {
    opening.current += 1;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setCamera(false);
    setReady(false);
  };
  useEffect(() => () => {
    opening.current += 1;
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);
  useEffect(() => {
    if (camera && video.current && stream.current) video.current.srcObject = stream.current;
  }, [camera]);
  const start = async () => {
    const attempt = ++opening.current;
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (attempt !== opening.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current?.getTracks().forEach(track => track.stop());
      stream.current = media;
      setCamera(true);
    } catch {
      setError('เปิดกล้องไม่ได้ กรุณาอนุญาตใช้กล้อง หรือเลือกภาพจากเครื่อง');
    }
  };
  const save = (source: CanvasImageSource, width: number, height: number) => {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 800 / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx || !width || !height) throw new Error('อ่านภาพไม่ได้');
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', .8);
    if (result.length > 1_400_000) throw new Error('รูปใหญ่เกินไป');
    onPhoto(result);
    setError('');
  };
  const capture = () => {
    const source = video.current;
    if (!source || !ready) return;
    try { save(source, source.videoWidth, source.videoHeight); stop(); }
    catch { setError('ถ่ายภาพไม่สำเร็จ กรุณาลองอีกครั้ง'); }
  };
  const select = async (file?: File) => {
    if (!file) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('เลือกรูป JPG PNG หรือ WebP ไม่เกิน 8 MB');
      const bitmap = await createImageBitmap(file);
      try { save(bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
      stop();
    } catch (e) { setError(e instanceof Error ? e.message : 'อ่านรูปไม่ได้'); }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void start()}><Camera className="mr-2 h-4 w-4"/>{photo ? 'ถ่ายใหม่' : 'เปิดกล้องถ่ายภาพ'}</Button>
      <Button type="button" variant="outline" asChild><label className="cursor-pointer"><ImagePlus className="mr-2 h-4 w-4"/>เลือกภาพ<Input type="file" className="sr-only" aria-label="เลือกภาพผู้มาติดต่อ" accept="image/jpeg,image/png,image/webp" onChange={e => { void select(e.target.files?.[0]); e.target.value = ''; }}/></label></Button>
    </div>
    {camera && <div className="space-y-2">
      <video ref={video} autoPlay muted playsInline onLoadedData={() => setReady(true)} className="aspect-[4/3] w-full rounded-md bg-muted object-contain" aria-label="กล้องผู้มาติดต่อ"/>
      <div className="flex gap-2"><Button type="button" disabled={!ready} onClick={capture}><Camera className="mr-2 h-4 w-4"/>ถ่ายภาพ</Button><Button type="button" variant="outline" onClick={stop}><X className="mr-2 h-4 w-4"/>ปิดกล้อง</Button></div>
    </div>}
    {!camera && photo && <img src={photo} alt="รูปผู้มาติดต่อ" className="h-36 w-36 rounded-md object-cover"/>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}