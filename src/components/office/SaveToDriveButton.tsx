import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Save, Cloud } from "lucide-react";
import { createFile, updateFileContent } from "@/lib/office/driveFileIO";
import { swal } from "@/lib/swal";

interface Props {
  fileId: string | null;
  fileName: string;
  defaultName: string;
  mimeType: string;
  getBlob: () => Promise<Blob | ArrayBuffer>;
  onSaved?: (fileId: string, name: string) => void;
}

export function SaveToDriveButton({ fileId, fileName, defaultName, mimeType, getBlob, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fileName || defaultName);
  const [saving, setSaving] = useState(false);

  const doSave = async (asNew: boolean) => {
    setSaving(true);
    try {
      const data = await getBlob();
      if (asNew || !fileId) {
        const created = await createFile({ name, mimeType, data });
        swal.toast.success("บันทึกลง Google Drive แล้ว");
        onSaved?.(created.id, created.name);
      } else {
        await updateFileContent(fileId, data, mimeType);
        swal.toast.success("บันทึกทับไฟล์เดิมแล้ว");
        onSaved?.(fileId, name);
      }
      setOpen(false);
    } catch (e: any) {
      swal.error("บันทึกไม่สำเร็จ", String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => fileId ? doSave(false) : setOpen(true)} disabled={saving}>
        <Save className="w-4 h-4 mr-1" />
        {saving ? "กำลังบันทึก…" : fileId ? "บันทึก" : "บันทึกลง Drive"}
      </Button>
      {fileId && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={saving}>
          บันทึกเป็นไฟล์ใหม่
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-500" /> บันทึกลง Google Drive
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">ชื่อไฟล์</label>
            <Input value={name} onChange={e => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">ไฟล์จะไปอยู่ที่ My Drive (โฟลเดอร์รากของคุณ)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
            <Button onClick={() => doSave(true)} disabled={saving || !name.trim()}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
