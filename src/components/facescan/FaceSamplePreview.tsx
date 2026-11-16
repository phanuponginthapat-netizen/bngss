import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
export type FacePoint = [number, number];
export default function FaceSamplePreview({ image, width, height, points, score, index, onRemove }: {
  image: string; width: number; height: number; points: FacePoint[]; score: number; index: number; onRemove: () => void;
}) {
  return <div className="space-y-2 rounded-lg border bg-card p-2">
    <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
      <img src={image} alt={`ใบหน้าลงทะเบียนรูปที่ ${index+1}`} className="h-full w-full object-contain" />
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full" aria-label="จุดจัดแนวใบหน้า ArcFace 5 จุด">
        <polyline points={points.map(p=>p.join(',')).join(' ')} fill="none" className="stroke-primary" strokeWidth={Math.max(width,height)/220} />
        {points.map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r={Math.max(width,height)/60} className="fill-background stroke-primary" strokeWidth={Math.max(width,height)/180}/><circle cx={x} cy={y} r={Math.max(width,height)/150} className="fill-primary"/></g>)}
      </svg>
      <Button size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" title="ลบรูปนี้" aria-label={`ลบรูปที่ ${index+1}`} onClick={onRemove}><X className="h-4 w-4"/></Button>
    </div>
    <div className="flex items-center justify-between text-xs"><span>รูป {index+1}</span><span className="font-semibold text-primary">คุณภาพ {score}/100</span></div>
  </div>;
}