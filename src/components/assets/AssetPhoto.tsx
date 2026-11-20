import { useEffect, useState } from 'react';
import { resolveAssetPhotoUrl } from '@/lib/assetPhotoUrl';
import { Button } from '@/components/ui/button';
import { ImageOff, RefreshCw } from 'lucide-react';
export default function AssetPhoto({src,alt='',className=''}:{src:string;alt?:string;className?:string}) {
  const [url,setUrl]=useState<string | null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{let active=true;setUrl(null);setFailed(false);resolveAssetPhotoUrl(src).then(value=>{if(active){setUrl(value);setFailed(!value);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[src,attempt]);
  if(failed)return <div className={`${className} flex items-center justify-center bg-muted`}><ImageOff className="h-4 w-4 text-muted-foreground"/><Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`ลองโหลดรูป ${alt} ใหม่`} onClick={()=>setAttempt(n=>n+1)}><RefreshCw className="h-3 w-3"/></Button></div>;
  return url ? <img src={url} alt={alt} className={className} loading="lazy" decoding="async" onError={()=>setFailed(true)}/> : <div className={`${className} bg-muted animate-pulse`}/>;
}