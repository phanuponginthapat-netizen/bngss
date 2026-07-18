import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Package, MapPin, User, Phone, AlertTriangle, ArrowLeft, CheckCircle2, Mail, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";
import MapPicker from "@/components/MapPicker";

const PublicAssetPage = () => {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<any | null>(null);
  const [school, setSchool] = useState<any | null>(null);
  const [responsible, setResponsible] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [foundLocation, setFoundLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
      setAsset(data);
      if (data?.school_id) {
        const { data: s } = await supabase.from("schools").select("school_name, phone, address, email").eq("id", data.school_id).maybeSingle();
        setSchool(s);
      }
      if ((data as any)?.responsible_user_id) {
        const rid = (data as any).responsible_user_id;
        // Personnel table is readable by staff; fall back to public RPC for non-staff viewers
        const { data: pers } = await supabase
          .from("personnel")
          .select("prefix, first_name, last_name, position, phone")
          .eq("user_id", rid)
          .maybeSingle();
        if (pers) {
          setResponsible({ first_name: pers.first_name, last_name: pers.last_name, phone: pers.phone, position: pers.position });
        } else {
          const { data: rows } = await (supabase.rpc as any)("get_profiles_public", { _ids: [rid] });
          const p = (rows as any[])?.[0];
          if (p) setResponsible({ first_name: p.first_name, last_name: p.last_name, position: p.position_title, phone: null });
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleReportFound = async () => {
    if (!reporterName.trim() || !foundLocation.trim()) {
      toast.error("กรุณากรอกชื่อและสถานที่ที่พบ");
      return;
    }
    setSubmitting(true);
    const desc = `[พบทรัพย์สิน] พบที่: ${foundLocation}${reporterContact ? ` | ติดต่อกลับ: ${reporterContact}` : ""}`;
    const { error } = await supabase.from("asset_damage_reports").insert({
      asset_id: id, description: desc, reporter_name: reporterName,
    } as any);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
    toast.success("แจ้งพบทรัพย์สินสำเร็จ ขอบคุณค่ะ/ครับ");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!asset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold">ไม่พบข้อมูลทรัพย์สิน</h2>
            <p className="text-sm text-muted-foreground">QR Code นี้อาจไม่ถูกต้อง หรือทรัพย์สินถูกลบออกจากระบบแล้ว</p>
            <Link to="/"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" />กลับหน้าหลัก</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const photos: string[] = Array.isArray(asset.photos) && asset.photos.length > 0
    ? asset.photos
    : (asset.photo_url ? [asset.photo_url] : []);

  const ageYears = asset.acquisition_date
    ? (Date.now() - new Date(asset.acquisition_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    : 0;
  const ageDisplay = ageYears < 1
    ? `${Math.round(ageYears * 12)} เดือน`
    : `${Math.floor(ageYears)} ปี ${Math.round((ageYears % 1) * 12)} เดือน`;
  const usagePercent = asset.useful_life_years
    ? Math.min(100, Math.round((ageYears / asset.useful_life_years) * 100))
    : 0;

  const responsibleName = responsible
    ? `${responsible.first_name || ""} ${responsible.last_name || ""}`.trim()
    : (asset.responsible_person || "");

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted/30 p-4">
      <div className="max-w-lg mx-auto space-y-4 py-8">
        <div className="text-center mb-4">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center mb-3">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">ข้อมูลวัสดุ/ครุภัณฑ์</h1>
          <p className="text-sm text-muted-foreground">{school?.school_name || "โรงเรียน"}</p>
        </div>

        {/* Photos gallery */}
        {photos.length > 0 && (
          <Card className="overflow-hidden">
            <img src={photos[activePhoto]} alt={asset.asset_name} className="w-full h-64 object-cover" />
            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-2">
                {photos.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setActivePhoto(i)}
                    className={`shrink-0 ${i === activePhoto ? "ring-2 ring-primary" : ""}`}
                  >
                    <img src={p} alt="" className="w-14 h-14 object-cover rounded border" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{asset.asset_name}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground mt-1">{asset.asset_code}</p>
              </div>
              <Badge variant="outline">{asset.category}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {asset.serial_number && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">S/N</span>
                <span className="font-mono font-medium">{asset.serial_number}</span>
              </div>
            )}
            {asset.acquisition_date && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> วันที่ได้มา</span>
                <span>{asset.acquisition_date}</span>
              </div>
            )}
            {asset.useful_life_years && (
              <div className="space-y-1.5 border-b pb-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">อายุการใช้งาน ({ageDisplay} / {asset.useful_life_years} ปี)</span>
                  <span className="font-medium">{usagePercent}%</span>
                </div>
                <Progress
                  value={usagePercent}
                  className={`h-2 ${usagePercent >= 100 ? "[&>div]:bg-red-500" : usagePercent >= 75 ? "[&>div]:bg-amber-500" : "[&>div]:bg-emerald-500"}`}
                />
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">สภาพ</span>
              <Badge variant="outline">{asset.condition}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        {(asset.building || asset.room || asset.location) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> ตำแหน่งที่ใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {asset.building && <p className="font-semibold">{asset.building}</p>}
              {(asset.floor || asset.room) && (
                <p className="text-muted-foreground">
                  {asset.floor && `ชั้น ${asset.floor}`} {asset.room && `• ห้อง ${asset.room}`}
                </p>
              )}
              {asset.location && <p className="text-xs text-muted-foreground">{asset.location}</p>}
            </CardContent>
          </Card>
        )}

        {/* Map */}
        {asset.latitude && asset.longitude && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" /> ตำแหน่งบนแผนที่
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MapPicker
                lat={Number(asset.latitude)}
                lng={Number(asset.longitude)}
                radius={30}
                height={240}
                onChange={() => {}}
              />
            </CardContent>
          </Card>
        )}

        {/* Responsible person */}
        {responsibleName && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> ผู้รับผิดชอบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{responsibleName}</p>
              {responsible?.position && <p className="text-muted-foreground">{responsible.position}</p>}
              {responsible?.phone && (
                <a href={`tel:${responsible.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="w-4 h-4" /> {responsible.phone}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* School contact */}
        {school && (
          <Card className="bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ติดต่อโรงเรียน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-semibold">{school.school_name}</p>
              {school.address && <p className="text-muted-foreground">{school.address}</p>}
              {school.phone && (
                <a href={`tel:${school.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Phone className="w-4 h-4" /> {school.phone}
                </a>
              )}
              {school.email && (
                <a href={`mailto:${school.email}`} className="flex items-center gap-2 text-primary hover:underline">
                  <Mail className="w-4 h-4" /> {school.email}
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Report found / damage */}
        {!submitted ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">แจ้งพบ/ชำรุด</CardTitle>
              <p className="text-xs text-muted-foreground">ระบบจะแจ้งเจ้าหน้าที่</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {!reportOpen ? (
                <Button onClick={() => setReportOpen(true)} className="w-full" size="lg">
                  <CheckCircle2 className="w-4 h-4 mr-2" />แจ้งเรื่องเกี่ยวกับครุภัณฑ์นี้
                </Button>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-medium">ชื่อผู้แจ้ง *</label>
                    <input type="text" value={reporterName} onChange={(e) => setReporterName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="ชื่อ-นามสกุล" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">สถานที่ที่พบ / อาการ *</label>
                    <input type="text" value={foundLocation} onChange={(e) => setFoundLocation(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="เช่น ห้อง 201 หน้าจอเสีย" />
                  </div>
                  <div>
                    <label className="text-xs font-medium">เบอร์โทร / ช่องทางติดต่อกลับ</label>
                    <input type="text" value={reporterContact} onChange={(e) => setReporterContact(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" placeholder="เบอร์โทร หรือ LINE ID (ถ้ามี)" />
                  </div>
                  <Button onClick={handleReportFound} disabled={submitting} className="w-full">
                    {submitting ? "กำลังส่ง..." : "ยืนยันการแจ้ง"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-emerald-50 border-emerald-200">
            <CardContent className="pt-6 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-emerald-800">แจ้งสำเร็จแล้ว</h3>
              <p className="text-sm text-emerald-700">เจ้าหน้าที่จะดำเนินการต่อไป</p>
            </CardContent>
          </Card>
        )}

        <div className="text-center pt-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-3 h-3 inline mr-1" />กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PublicAssetPage;
