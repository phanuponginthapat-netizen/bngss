import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Laptop, Smartphone, Camera, Tablet, Projector, Package, Search, ScanLine, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

type Device = {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  status: string;
  notes?: string | null;
  photo_url?: string | null;
};

const CATEGORIES = [
  { value: "all", label: "ทั้งหมด", icon: ShoppingBag, color: "from-violet-500 to-fuchsia-500" },
  { value: "notebook", label: "โน้ตบุ๊ก", icon: Laptop, color: "from-sky-500 to-blue-600" },
  { value: "tablet", label: "แท็บเล็ต", icon: Tablet, color: "from-emerald-500 to-teal-600" },
  { value: "mobile", label: "มือถือ", icon: Smartphone, color: "from-amber-500 to-orange-600" },
  { value: "camera", label: "กล้อง", icon: Camera, color: "from-rose-500 to-pink-600" },
  { value: "projector", label: "โปรเจกเตอร์", icon: Projector, color: "from-indigo-500 to-purple-600" },
  { value: "other", label: "อื่นๆ", icon: Package, color: "from-slate-500 to-zinc-600" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  available: { label: "พร้อมยืม", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  borrowed: { label: "ถูกยืม", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  maintenance: { label: "ซ่อมบำรุง", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  lost: { label: "สูญหาย", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  retired: { label: "ปลดระวาง", cls: "bg-muted text-muted-foreground border-border" },
};

export default function IctCatalogPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ict_devices")
        .select("id, asset_code, name, category, brand, model, status, notes, photo_url")
        .order("status", { ascending: true })
        .order("name", { ascending: true });
      setDevices((data as Device[]) || []);
      setLoading(false);
    })();
  }, []);

  const countsByCat = useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    devices.forEach((d) => {
      if (onlyAvailable && d.status !== "available") return;
      m.all = (m.all || 0) + 1;
      m[d.category] = (m[d.category] || 0) + 1;
    });
    return m;
  }, [devices, onlyAvailable]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((d) => {
      if (tab !== "all" && d.category !== tab) return false;
      if (onlyAvailable && d.status !== "available") return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        d.asset_code.toLowerCase().includes(q) ||
        (d.brand || "").toLowerCase().includes(q) ||
        (d.model || "").toLowerCase().includes(q)
      );
    });
  }, [devices, search, tab, onlyAvailable]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" /> คลังอุปกรณ์ ICT ที่พร้อมให้ยืม
          </h1>
          <p className="text-sm text-muted-foreground">เลือกชมอุปกรณ์เหมือนช้อปปิ้ง แล้วไปยืมที่จุดบริการ</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={onlyAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => setOnlyAvailable((v) => !v)}
          >
            {onlyAvailable ? "เฉพาะพร้อมยืม" : "แสดงทั้งหมด"}
          </Button>
          <Link to="/dashboard/admin/ict-loans">
            <Button size="sm" className="gap-1"><ScanLine className="w-4 h-4" /> ไปยืม-คืน</Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="ค้นหา ชื่อ / รหัส / ยี่ห้อ / รุ่น"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-muted/50">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const n = countsByCat[c.value] || 0;
            return (
              <TabsTrigger
                key={c.value}
                value={c.value}
                className="flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Icon className="w-4 h-4" />
                <span>{c.label}</span>
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{n}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORIES.map((c) => (
          <TabsContent key={c.value} value={c.value} className="mt-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[4/5] rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-16 text-center text-muted-foreground">
                ไม่พบอุปกรณ์ในหมวดนี้
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((d) => {
                  const cat = CATEGORIES.find((x) => x.value === d.category) || CATEGORIES[CATEGORIES.length - 1];
                  const Icon = cat.icon;
                  const st = STATUS_LABEL[d.status] || STATUS_LABEL.available;
                  return (
                    <Card key={d.id} className="overflow-hidden group hover:shadow-lg transition-all hover:-translate-y-0.5">
                      <div className="relative aspect-square bg-muted/40 overflow-hidden">
                        {d.photo_url ? (
                          <img
                            src={d.photo_url}
                            alt={d.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br ${cat.color} flex items-center justify-center`}>
                            <Icon className="w-16 h-16 text-white/80" />
                          </div>
                        )}
                        <Badge variant="outline" className={`absolute top-2 right-2 ${st.cls} backdrop-blur-sm`}>{st.label}</Badge>
                      </div>
                      <CardContent className="p-3 space-y-1">
                        <div className="text-xs text-muted-foreground font-mono">{d.asset_code}</div>
                        <div className="font-semibold leading-tight line-clamp-2">{d.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {[d.brand, d.model].filter(Boolean).join(" ") || cat.label}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
