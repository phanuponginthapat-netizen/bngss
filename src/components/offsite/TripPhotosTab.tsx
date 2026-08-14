import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { swal } from "@/lib/swal";
import { compressImage } from "@/lib/imageCompress";
import { createStorageSignedUrl } from "@/lib/storageUrl";
import { getCurrentCoords, mapsLink, formatCoords } from "@/lib/geolocation";
import { Camera, ImagePlus, MapPin, Trash2, Loader2 } from "lucide-react";

const BUCKET = "offsite-photos";

type Photo = {
  id: string;
  trip_id: string;
  photo_url: string;
  caption: string | null;
  lat: number | null;
  lng: number | null;
  taken_at: string;
  uploaded_by: string | null;
};

function PhotoCard({ photo, onDelete }: { photo: Photo; onDelete: (p: Photo) => void }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let alive = true;
    createStorageSignedUrl(BUCKET, photo.photo_url).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [photo.photo_url]);

  return (
    <div className="rounded-xl overflow-hidden border bg-card">
      <div className="aspect-video bg-muted">
        {url ? (
          <img src={url} alt={photo.caption || "รูปกิจกรรมนอกพื้นที่"} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
      </div>
      <div className="p-3 space-y-1">
        {photo.caption && <div className="text-sm font-medium">{photo.caption}</div>}
        <div className="text-xs text-muted-foreground">
          {new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(photo.taken_at))}
        </div>
        {photo.lat != null && photo.lng != null && (
          <a
            href={mapsLink(photo.lat, photo.lng)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
          >
            <MapPin className="w-3 h-3" /> {formatCoords(photo.lat, photo.lng)}
          </a>
        )}
        <div className="pt-1">
          <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={() => onDelete(photo)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> ลบ
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TripPhotosTab({ tripId, canEdit }: { tripId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["offsite_photos", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_offsite_photos")
        .select("*")
        .eq("trip_id", tripId)
        .order("taken_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const coords = await getCurrentCoords();
      const { data: { user } } = await supabase.auth.getUser();
      for (const raw of Array.from(files)) {
        const file = await compressImage(raw, { maxWidth: 1600, maxSizeKB: 400 } as any);
        const path = `${tripId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { error } = await supabase.from("student_offsite_photos").insert({
          trip_id: tripId,
          photo_url: path,
          caption: caption.trim() || null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          uploaded_by: user?.id ?? null,
        } as any);
        if (error) throw error;
      }
      setCaption("");
      qc.invalidateQueries({ queryKey: ["offsite_photos", tripId] });
      swal.toast.success(coords ? "อัปโหลดรูปพร้อมพิกัดแล้ว" : "อัปโหลดรูปแล้ว (ไม่ได้รับอนุญาตให้ใช้พิกัด)");
    } catch (e: any) {
      swal.toast.error(e?.message || "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  };

  const handleDelete = async (p: Photo) => {
    const ok = await swal.confirm({ title: "ลบรูปนี้?" });
    if (!ok) return;
    await supabase.storage.from(BUCKET).remove([p.photo_url]);
    const { error } = await supabase.from("student_offsite_photos").delete().eq("id", p.id);
    if (error) { swal.toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["offsite_photos", tripId] });
    swal.toast.success("ลบแล้ว");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ImagePlus className="w-4 h-4" /> รูปภาพกิจกรรม ({photos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="space-y-2 rounded-xl border p-3 bg-muted/30">
            <Label className="text-xs">คำบรรยายรูป (ใส่ก่อนเลือกรูป)</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="เช่น ถึงจุดหมายปลายทาง" />
            <div className="flex gap-2 flex-wrap">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFiles(e.target.files)} />
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
              <Button size="sm" disabled={uploading} onClick={() => cameraRef.current?.click()} className="gap-1">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} ถ่ายรูป
              </Button>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()} className="gap-1">
                <ImagePlus className="w-4 h-4" /> เลือกรูปจากเครื่อง
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">ระบบจะบันทึกพิกัด GPS ขณะอัปโหลดโดยอัตโนมัติ (ถ้าอนุญาต)</p>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">กำลังโหลด...</div>
        ) : photos.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">ยังไม่มีรูปภาพ</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((p) => (
              <PhotoCard key={p.id} photo={p} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
