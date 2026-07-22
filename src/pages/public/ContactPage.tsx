import { useEffect, useState } from "react";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { getSchoolInfo } from "@/lib/schoolInfo";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { MapPin, Phone, Mail, Clock, Printer } from "lucide-react";

export default function ContactPage() {
  const [info, setInfo] = useState<any>(null);
  const s: any = useSystemSettings();
  useEffect(() => { getSchoolInfo("contact").then(setInfo); }, []);
  const c = info?.content || {};

  return (
    <PublicPageLayout title="ติดต่อโรงเรียน" subtitle="เราพร้อมให้บริการ" breadcrumbs={[{ label: "ติดต่อเรา" }]}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          {[
            { icon: MapPin, label: "ที่อยู่", value: c.address },
            { icon: Phone, label: "โทรศัพท์", value: c.phone },
            { icon: Mail, label: "อีเมล", value: c.email },
            { icon: Printer, label: "โทรสาร", value: c.fax },
            { icon: Clock, label: "เวลาทำการ", value: c.hours },
          ].filter((x) => x.value).map((x, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-border/50 bg-background/70 p-5 shadow-sm backdrop-blur">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <x.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-muted-foreground">{x.label}</div>
                <div className="mt-0.5 text-foreground">{x.value}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/50 bg-background/70 shadow-sm">
          {c.map_embed ? (
            <div className="aspect-square" dangerouslySetInnerHTML={{ __html: c.map_embed }} />
          ) : (
            <div className="flex aspect-square items-center justify-center text-muted-foreground">
              เพิ่มแผนที่ได้จาก CMS
            </div>
          )}
        </div>
      </div>
    </PublicPageLayout>
  );
}
