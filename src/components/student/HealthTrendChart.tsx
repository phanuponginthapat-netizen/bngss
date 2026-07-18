import { useEffect, useState } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Activity, Plus, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";

interface Measurement {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
}

// เกณฑ์น้ำหนัก/ส่วนสูง แบบ simplified (กรมอนามัย 6-18 ปี ค่าเฉลี่ย)
// ใช้เป็นเส้นอ้างอิงคร่าวๆ — ในระบบจริงควรอ้างอิงเพศ + เปอร์เซ็นไทล์
const BMI_NORMAL_MIN = 18.5;
const BMI_NORMAL_MAX = 25.0;

export default function HealthTrendChart({ studentId, student }: { studentId: string; student?: Student }) {
  const [data, setData] = useState<Measurement[]>([]);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [date, setDate] = useState(todayBangkok());
  const [metric, setMetric] = useState<"weight" | "height" | "bmi">("bmi");
  const [loading, setLoading] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [assessBmi, setAssessBmi] = useState<{ bmi: number; category: string } | null>(null);

  // คำนวณ BMI แบบสด ขณะกรอก
  const liveBmi = (() => {
    const w = Number(weight);
    const h = Number(height);
    if (!w || !h) return null;
    const hm = h / 100;
    return +(w / (hm * hm)).toFixed(2);
  })();
  const liveCat = liveBmi == null ? null
    : liveBmi < 18.5 ? { label: "ต่ำกว่าเกณฑ์ (ผอม)", cls: "bg-orange-100 text-orange-800" }
    : liveBmi < 23 ? { label: "ตรงเกณฑ์ (ปกติ)", cls: "bg-green-100 text-green-800" }
    : liveBmi < 25 ? { label: "ท้วม", cls: "bg-yellow-100 text-yellow-800" }
    : liveBmi < 30 ? { label: "เกินเกณฑ์ (อ้วน)", cls: "bg-red-100 text-red-800" }
    : { label: "อ้วนมาก", cls: "bg-red-200 text-red-900" };

  const load = async () => {
    const { data, error } = await supabase
      .from("health_measurements")
      .select("id, measured_at, weight_kg, height_cm, bmi")
      .eq("student_id", studentId)
      .order("measured_at", { ascending: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setData((data as Measurement[]) ?? []);
  };

  useEffect(() => {
    if (studentId) load();
    // realtime subscription
    const ch = supabase
      .channel(`health_${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "health_measurements", filter: `student_id=eq.${studentId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const add = async () => {
    if (!weight && !height) {
      toast.error("กรอกน้ำหนักหรือส่วนสูงอย่างน้อยหนึ่งอย่าง");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("health_measurements").insert({
      student_id: studentId,
      measured_at: date,
      weight_kg: weight ? Number(weight) : null,
      height_cm: height ? Number(height) : null,
      recorded_by: user?.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("บันทึกแล้ว");
    setWeight("");
    setHeight("");
    load();
  };

  const calcAge = (dob?: string | null): number | null => {
    if (!dob) return null;
    const b = new Date(dob);
    if (isNaN(b.getTime())) return null;
    return Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
  };

  const assessAi = async () => {
    const w = liveBmi != null ? Number(weight) : latest?.weight_kg ?? null;
    const h = liveBmi != null ? Number(height) : latest?.height_cm ?? null;
    if (!w || !h) {
      toast.error("ต้องมีน้ำหนักและส่วนสูง");
      return;
    }
    setAssessing(true);
    setAssessment(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("assess-bmi", {
        body: {
          weight_kg: w,
          height_cm: h,
          age: calcAge(student?.date_of_birth),
          gender: student?.gender,
          history: data.slice(-6).map((d) => ({
            date: d.measured_at, weight_kg: d.weight_kg, height_cm: d.height_cm, bmi: d.bmi,
          })),
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      setAssessment((res as any).assessment);
      setAssessBmi({ bmi: (res as any).bmi, category: (res as any).category });
    } catch (e: any) {
      toast.error(e?.message || "ประเมินไม่สำเร็จ");
    } finally {
      setAssessing(false);
    }
  };

  const chartData = data.map((d) => ({
    date: new Date(d.measured_at).toLocaleDateString("th-TH", { month: "short", day: "numeric" }),
    weight: d.weight_kg,
    height: d.height_cm,
    bmi: d.bmi,
  }));

  const dataKey = metric === "weight" ? "weight" : metric === "height" ? "height" : "bmi";
  const unit = metric === "weight" ? "kg" : metric === "height" ? "cm" : "";
  const latest = data[data.length - 1];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          แนวโน้มสุขภาพ {student ? `— ${student.first_name} ${student.last_name}` : ""}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <div>
            <Label>วันที่ชั่ง</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>น้ำหนัก (kg)</Label>
            <Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="เช่น 32.5" />
          </div>
          <div>
            <Label>ส่วนสูง (cm)</Label>
            <Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="เช่น 135" />
          </div>
          <Button onClick={add} disabled={loading} className="md:col-span-1">
            <Plus className="h-4 w-4 mr-1" /> บันทึก
          </Button>
          <Select value={metric} onValueChange={(v) => setMetric(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bmi">BMI</SelectItem>
              <SelectItem value="weight">น้ำหนัก</SelectItem>
              <SelectItem value="height">ส่วนสูง</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Live BMI preview while typing */}
        {liveBmi != null && liveCat && (
          <div className="flex flex-wrap items-center gap-2 text-sm p-3 rounded-md border bg-muted/30">
            <span className="font-medium">BMI ที่กำลังกรอก:</span>
            <span className={`px-2 py-1 rounded font-semibold ${liveCat.cls}`}>{liveBmi} — {liveCat.label}</span>
            <span className="text-xs text-muted-foreground">(คำนวณสด ยังไม่บันทึก)</span>
          </div>
        )}

        {/* Summary + AI button */}
        {latest && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded bg-muted">บันทึกล่าสุด: {new Date(latest.measured_at).toLocaleDateString("th-TH")}</span>
            {latest.weight_kg && <span className="px-2 py-1 rounded bg-muted">น้ำหนัก {latest.weight_kg} kg</span>}
            {latest.height_cm && <span className="px-2 py-1 rounded bg-muted">ส่วนสูง {latest.height_cm} cm</span>}
            {latest.bmi && (
              <span className={`px-2 py-1 rounded ${latest.bmi < BMI_NORMAL_MIN ? "bg-orange-100 text-orange-800" : latest.bmi > BMI_NORMAL_MAX ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                BMI {latest.bmi} {latest.bmi < BMI_NORMAL_MIN ? "ผอม" : latest.bmi > BMI_NORMAL_MAX ? "เกินเกณฑ์" : "เกณฑ์ปกติ"}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={assessAi} disabled={assessing} className="ml-auto">
              {assessing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              ประเมินด้วย AI
            </Button>
          </div>
        )}

        {/* AI assessment result */}
        {assessment && (
          <div className="p-4 rounded-md border bg-gradient-to-br from-primary/5 to-transparent space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              ผลประเมินจาก AI
              {assessBmi && (
                <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded bg-muted">
                  BMI {assessBmi.bmi} — {assessBmi.category}
                </span>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">{assessment}</div>
          </div>
        )}

        {/* Chart */}
        {chartData.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-50" />
            ยังไม่มีข้อมูล — บันทึกครั้งแรกด้านบน
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} unit={unit} />
                <Tooltip />
                <Legend />
                {metric === "bmi" && (
                  <>
                    <ReferenceLine y={BMI_NORMAL_MIN} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: "ผอม", position: "left", fontSize: 10 }} />
                    <ReferenceLine y={BMI_NORMAL_MAX} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: "เกินเกณฑ์", position: "left", fontSize: 10 }} />
                  </>
                )}
                <Line type="monotone" dataKey={dataKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name={metric === "bmi" ? "BMI" : metric === "weight" ? "น้ำหนัก (kg)" : "ส่วนสูง (cm)"} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
