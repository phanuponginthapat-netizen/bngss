import { SimpleCrudPage } from "@/components/generic/SimpleCrudPage";
import { Video } from "lucide-react";

export default function CctvCamerasPage() {
  return (
    <SimpleCrudPage
      title="กล้องวงจรปิด CCTV"
      subtitle="จัดการรายชื่อกล้อง CCTV และ Stream URL (เฉพาะผู้ดูแลระบบ)"
      icon={Video}
      table="cctv_cameras"
      searchableFields={["name", "location"]}
      fields={[
        { name: "name", label: "ชื่อกล้อง", required: true, placeholder: "เช่น ประตูหน้า" },
        { name: "location", label: "สถานที่", required: true },
        { name: "rtsp_url", label: "RTSP URL", placeholder: "rtsp://..." },
        { name: "hls_url", label: "HLS URL (.m3u8)" },
        { name: "snapshot_url", label: "Snapshot URL (.jpg)" },
        { name: "is_active", label: "ใช้งาน", type: "checkbox", defaultValue: true },
        { name: "notes", label: "หมายเหตุ", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "ชื่อกล้อง" },
        { key: "location", label: "สถานที่" },
        { key: "is_active", label: "สถานะ", render: v => v ? "🟢 ใช้งาน" : "⚪ ปิด" },
      ]}
    />
  );
}
