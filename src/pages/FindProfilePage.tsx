import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ScanLine, Search, User, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "@/components/BarcodeScanner";
import { useSystemSettings } from "@/hooks/useSystemSettings";

type SearchResult = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  student_code: string | null;
  employee_code: string | null;
  role_label: string | null;
};

/**
 * Public page: ค้นหา/สแกน QR บัตรประจำตัว เพื่อเปิดดูโปรไฟล์สาธารณะของบุคคลในโรงเรียน
 * - รองรับการค้นหาด้วยรหัสนักเรียน/บุคลากร หรือชื่อจริง/นามสกุล/ชื่อเล่น
 * - รองรับ QR ที่เก็บแค่ student_code/employee_code
 * - รองรับ QR ที่เป็น URL `/p/:id` หรือ `/p/c/:code`
 * - ไม่ต้องล็อกอิน
 */
const FindProfilePage = () => {
  const navigate = useNavigate();
  const { appName } = useSystemSettings();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  const tryNavigateFromScanned = async (raw: string) => {
    const v = raw.trim();
    if (!v) return;

    const idMatch = v.match(/\/p\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (idMatch) {
      navigate(`/p/${idMatch[1]}`);
      return;
    }
    const codeMatch = v.match(/\/p\/c\/([^/?#]+)/i);
    const lookup = codeMatch ? decodeURIComponent(codeMatch[1]) : v;
    await resolveCode(lookup);
  };

  // Direct code resolve (from QR scan) — single exact match
  const resolveCode = async (lookup: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("find_profile_id_by_code", { _code: lookup });
      if (error) throw error;
      if (!data) {
        toast.error("ไม่พบบุคคลที่ตรงกับรหัสนี้");
        return;
      }
      navigate(`/p/${data}`);
    } catch (e: any) {
      toast.error(e?.message || "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;
    if (term.length < 2) {
      toast.error("กรุณากรอกอย่างน้อย 2 ตัวอักษร");
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.rpc("search_public_profiles", { _q: term });
      if (error) throw error;
      const list = (data || []) as SearchResult[];
      if (list.length === 0) {
        toast.error("ไม่พบบุคคลที่ตรงกับคำค้น");
        setResults([]);
        return;
      }
      // If exactly one match and the query matches a code exactly → jump straight in
      if (
        list.length === 1 &&
        (list[0].student_code?.toLowerCase() === term.toLowerCase() ||
          list[0].employee_code?.toLowerCase() === term.toLowerCase())
      ) {
        navigate(`/p/${list[0].id}`);
        return;
      }
      setResults(list);
    } catch (e: any) {
      toast.error(e?.message || "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const fullName = (p: SearchResult) =>
    [p.first_name, p.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ";
  const initials = (p: SearchResult) =>
    (p.first_name?.[0] || "") + (p.last_name?.[0] || "") || "?";

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" />กลับหน้าหลัก</Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="truncate max-w-[200px]">{appName}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ค้นหาบุคคลในโรงเรียน</h1>
          <p className="text-sm text-muted-foreground">
            สแกน QR บนบัตรประจำตัว หรือกรอกรหัส/ชื่อจริง/นามสกุล/ชื่อเล่น เพื่อเปิดดูโปรไฟล์สาธารณะ
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <Button
              type="button"
              size="lg"
              className="w-full h-14 text-base font-semibold"
              onClick={() => setScanOpen(true)}
            >
              <ScanLine className="w-5 h-5 mr-2" />
              สแกน QR บนบัตรประจำตัว
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                รหัสนักเรียน / รหัสบุคลากร / ชื่อ / นามสกุล / ชื่อเล่น
              </label>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="เช่น 0001-2567 หรือ สมชาย"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                  className="h-11"
                />
                <Button type="submit" disabled={loading || query.trim().length < 2} className="h-11">
                  <Search className="w-4 h-4 mr-1" />
                  ค้นหา
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {results && results.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                พบ {results.length} รายการ
              </div>
              <ul className="divide-y">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/p/${p.id}`)}
                      className="w-full flex items-center gap-3 px-2 py-3 hover:bg-accent/50 rounded-md text-left transition"
                    >
                      <Avatar className="h-11 w-11">
                        <AvatarImage src={p.avatar_url || undefined} alt={fullName(p)} />
                        <AvatarFallback>{initials(p)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {fullName(p)}
                          {p.nickname ? <span className="text-muted-foreground"> ({p.nickname})</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.role_label && <span>{p.role_label}</span>}
                          {(p.student_code || p.employee_code) && (
                            <span> · {p.student_code || p.employee_code}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          ระบบจะแสดงเฉพาะข้อมูลสาธารณะที่โรงเรียนเปิดเผยเท่านั้น
        </p>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(v) => {
          setScanOpen(false);
          tryNavigateFromScanned(v);
        }}
        title="สแกน QR บัตรประจำตัว"
      />
    </div>
  );
};

export default FindProfilePage;
