import { MapPin, Phone, Mail } from "lucide-react";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";
import { Button } from "@/components/ui/button";

export default function SchoolContactDetails() {
  const { data: settings = {}, isLoading, isError, refetch } = useCmsSettingsBulk();
  if (isLoading) return <p className="text-muted-foreground">กำลังโหลดข้อมูลติดต่อ…</p>;
  if (isError) return <div className="space-y-3"><p className="text-destructive">โหลดข้อมูลติดต่อไม่สำเร็จ</p><Button variant="outline" onClick={() => void refetch()}>ลองใหม่</Button></div>;
  const details = [
    { label: "ที่อยู่", value: settings.school_address, Icon: MapPin },
    { label: "โทรศัพท์", value: settings.school_phone, Icon: Phone },
    { label: "อีเมล", value: settings.school_email, Icon: Mail },
  ].filter(item => item.value?.trim());
  return <div className="space-y-6">
    {details.map(({ label, value, Icon }) => <div key={label} className="flex items-start gap-4">
      <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 space-y-1"><p className="text-sm text-muted-foreground">{label}</p><p className="break-words text-foreground">{value}</p></div>
    </div>)}
    {!details.length && <p className="text-muted-foreground">ยังไม่มีข้อมูลติดต่อ</p>}
  </div>;
}