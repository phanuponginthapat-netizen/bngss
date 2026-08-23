import { useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, FileText, Plus, Eye, Printer, CheckCircle2, Clock, AlertCircle, Calendar, User, School, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";


interface Personnel { id: string; first_name: string; last_name: string; prefix: string | null; position: string; department: string; subject_group: string | null; }
interface ObservationSession { id: string; teacher_id: string; teacher_name?: string; classroom: string; subject: string; observation_date?: string; scheduled_date?: string; status: "draft" | "in_progress" | "completed" | "cancelled"; observer_name: string; created_at: string; updated_at: string; }
interface RubricCriterion { key: string; label_th: string; label_en: string; group: string; }
interface ObservationRecord { id: string; session_id: string; scores: Record<string, number>; comments: Record<string, string>; overall_comment: string; strengths: string; suggestions: string; total_score: number; max_score: number; percentage: number; is_draft: boolean; submitted_by: string; submitted_at: string; }

const RUBRIC_CRITERIA: RubricCriterion[] = [
  { key: "step1", label_th: "��鹷�� 1 ��鹹�", label_en: "Step 1: Motivation", group: "5-step" },
  { key: "step2", label_th: "��鹷�� 2 ����ʹ�", label_en: "Step 2: Presentation", group: "5-step" },
  { key: "step3", label_th: "��鹷�� 3 ��鹽֡��", label_en: "Step 3: Practice", group: "5-step" },
  { key: "step4", label_th: "��鹷�� 4 �����ػ", label_en: "Step 4: Summary", group: "5-step" },
  { key: "step5", label_th: "��鹷�� 5 ��鹢���", label_en: "Step 5: Application", group: "5-step" },
  { key: "cls_mgmt", label_th: "��èѴ�����ͧ���¹", label_en: "Classroom Management", group: "general" },
  { key: "active_learn", label_th: "��èѴ������¹����ԧ�ء", label_en: "Active Learning", group: "general" },
  { key: "assess", label_th: "��û����Թ��", label_en: "Assessment", group: "general" },
];

const CRITERION_GROUPS = [
  { key: "5-step", label_th: "����͹ 5 ���", label_en: "5-Step Teaching" },
  { key: "general", label_th: "ࡳ������", label_en: "General Criteria" },
];

const STATUS_MAP: Record<string, { label_th: string; label_en: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label_th: "��ҧ", label_en: "Draft", variant: "secondary" },
  in_progress: { label_th: "���ѧ���Թ���", label_en: "In Progress", variant: "default" },
  completed: { label_th: "�������", label_en: "Completed", variant: "outline" },
  cancelled: { label_th: "¡��ԡ", label_en: "Cancelled", variant: "destructive" },
};

const SCORE_LABELS: Record<number, { th: string; en: string }> = {
  1: { th: "��辺", en: "Not Observed" },
  2: { th: "����", en: "Poor" },
  3: { th: "����", en: "Fair" },
  4: { th: "��", en: "Good" },
  5: { th: "���ҡ", en: "Excellent" },
};

const MAX_SCORE = 5;
const TOTAL_MAX = RUBRIC_CRITERIA.length * MAX_SCORE;

const L = (th: string, en: string, lang: string) => (lang === "th" ? th : en);

const formatDate = (d: string, lang: string) => {
  try {
    const date = new Date(d);
    return lang === "th"
      ? date.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
      : date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch { return d; }
};

const calcTotal = (sc: Record<string, number>) =>
  RUBRIC_CRITERIA.reduce((sum, c) => sum + (sc[c.key] || 0), 0);

const calcPercentage = (total: number) => Math.round((total / TOTAL_MAX) * 10000) / 100;

const emptyScores = (): Record<string, number> =>
  Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.key, 0]));

const emptyComments = (): Record<string, string> =>
  Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.key, ""]));

function ScoreSlider({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { lang } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={value >= 4 ? "outline" : value >= 3 ? "secondary" : value > 0 ? "destructive" : "secondary"}>
          {value} / {MAX_SCORE}
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <Slider value={[value]} onValueChange={(v) => onChange(v[0])} min={0} max={5} step={1} className="flex-1" />
        <div className="w-10 text-center text-sm font-bold">{value}</div>
      </div>
      {value > 0 && <p className="text-xs text-muted-foreground">{SCORE_LABELS[value]?.[lang as "th" | "en"] || ""}</p>}
    </div>
  );
}

function ScoreInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { lang } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={value >= 4 ? "outline" : value >= 3 ? "secondary" : value > 0 ? "destructive" : "secondary"}>
          {value} / {MAX_SCORE}
        </Badge>
      </div>
      <Input type="number" min={0} max={5} step={1} value={value}
        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0 && v <= 5) onChange(v); }}
        className="w-24" />
      {value > 0 && <p className="text-xs text-muted-foreground">{SCORE_LABELS[value]?.[lang as "th" | "en"] || ""}</p>}
    </div>
  );
}

export default function ObservationSessionPage() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("sessions");
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [scoringSession, setScoringSession] = useState<ObservationSession | null>(null);
  const [detailSession, setDetailSession] = useState<ObservationSession | null>(null);
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formClassroom, setFormClassroom] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [formObserver, setFormObserver] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(emptyScores);
  const [scoreComments, setScoreComments] = useState<Record<string, string>>(emptyComments);
  const [overallComment, setOverallComment] = useState("");
  const [strengths, setStrengths] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [filterTeacher, setFilterTeacher] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const { data: teachers = [] } = useQuery({
    queryKey: ["personnel-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("personnel")
        .select("id, first_name, last_name, prefix, position, department, subject_group")
        .eq("status", "active").order("first_name");
      if (error) throw error;
      return (data || []) as Personnel[];
    },
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["observation-sessions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("observation_sessions" as any) as any)
        .select("*").order("scheduled_date" as any, { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["observation-records"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("observation_records" as any) as any)
        .select("*").order("created_at" as any, { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const teacher = teachers.find((t) => t.id === formTeacherId);
      const teacherName = teacher ? `${teacher.prefix || ""} ${teacher.first_name} ${teacher.last_name}`.trim() : "";
      const { data, error } = await (supabase.from("observation_sessions" as any) as any)
        .insert({ teacher_id: formTeacherId, teacher_name: teacherName, classroom: formClassroom,
          subject: formSubject, scheduled_date: formDate, observation_date: formDate, status: "draft", observer_name: formObserver } as any)
        .select().single();
      if (error) throw error; return data;
    },
    onSuccess: () => {
      toast.success(L("���ҧ�ͺ�ѧࡵ��ó������", "Session created successfully", lang));
      queryClient.invalidateQueries({ queryKey: ["observation-sessions"] });
      resetForm(); setSessionDialogOpen(false);
    },
    onError: (err: unknown) => {
      toast.error((err instanceof Error ? err.message : String(err)) || L("�Դ��ͼԴ��Ҵ", "An error occurred", lang));
    },
  });

  const submitScoreMutation = useMutation({
    mutationFn: async ({ sessionId, isDraft }: { sessionId: string; isDraft: boolean }) => {
      const total = calcTotal(scores); const pct = calcPercentage(total);
      const { error } = await supabase.from("observation_records" as any).upsert({
        session_id: sessionId, scores, comments: scoreComments, overall_comment: overallComment,
        strengths, suggestions, total_score: total, max_score: TOTAL_MAX, percentage: pct,
        is_draft: isDraft, submitted_at: new Date().toISOString(),
      }, { onConflict: "session_id" });
      if (error) throw error;
      if (!isDraft) await supabase.from("observation_sessions" as any).update({ status: "completed" }).eq("id", sessionId);
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isDraft ? L("�ѹ�֡��ҧ�����", "Draft saved successfully", lang) : L("�觼Ż����Թ�����", "Score submitted successfully", lang));
      queryClient.invalidateQueries({ queryKey: ["observation-sessions", "observation-records"] });
      setScoringSession(null);
    },
    onError: (err: unknown) => {
      toast.error((err instanceof Error ? err.message : String(err)) || L("�Դ��ͼԴ��Ҵ", "An error occurred", lang));
    },
  });

  const resetForm = () => { setFormTeacherId(""); setFormClassroom(""); setFormSubject(""); setFormDate(new Date().toISOString().split("T")[0]); setFormObserver(""); };
  const resetScoring = () => { setScores(emptyScores()); setScoreComments(emptyComments()); setOverallComment(""); setStrengths(""); setSuggestions(""); };

  const openScoring = useCallback((session: ObservationSession) => {
    const existing = records.find((r) => r.session_id === session.id);
    if (existing) { setScores(existing.scores || emptyScores()); setScoreComments(existing.comments || emptyComments()); setOverallComment(existing.overall_comment || ""); setStrengths(existing.strengths || ""); setSuggestions(existing.suggestions || ""); } else { resetScoring(); }
    setScoringSession(session);
  }, [records]);

  const totalScore = useMemo(() => calcTotal(scores), [scores]);
  const percentage = useMemo(() => calcPercentage(totalScore), [totalScore]);

  const getTeacherName = useCallback((id: string) => {
    const t = teachers.find((x) => x.id === id);
    return t ? `${t.prefix || ""} ${t.first_name} ${t.last_name}`.trim() : id;
  }, [teachers]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (filterTeacher !== "all") result = result.filter((r) => { const s = sessions.find((x) => x.id === r.session_id); return s?.teacher_id === filterTeacher; });
    if (filterDateFrom) result = result.filter((r) => { const s = sessions.find((x) => x.id === r.session_id) as any; return s && ((s.scheduled_date ?? s.observation_date) >= filterDateFrom); });
    if (filterDateTo) result = result.filter((r) => { const s = sessions.find((x) => x.id === r.session_id) as any; return s && ((s.scheduled_date ?? s.observation_date) <= filterDateTo); });
    return result;
  }, [records, sessions, filterTeacher, filterDateFrom, filterDateTo]);

  const handlePrint = (record: ObservationRecord) => {
    const session = sessions.find((s) => s.id === record.session_id);
    const win = window.open("", "_blank");
    if (!win) return;
    const rows = RUBRIC_CRITERIA.map((c) =>
      `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:600">${c.label_th}</td>` +
      `<td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:18px">${record.scores?.[c.key] ?? 0}</td>` +
      `<td style="padding:8px;border:1px solid #ddd">${record.comments?.[c.key] || "-"}</td></tr>`
    ).join("");
    const tl = L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang);
    const cl = L("\u0E2B\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21", "Classroom", lang);
    const sl = L("\u0E27\u0E34\u0E2A\u0E32", "Subject", lang);
    const dl = L("\u0E27\u0E31\u0E22\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Date", lang);
    const ol = L("\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observer", lang);
    const crl = L("\u0E40\u0E01\u0E37\u0E48\u0E2D\u0E21", "Criteria", lang);
    const scl = L("\u0E04\u0E23\u0E32\u0E22\u0E2A\u0E23\u0E30\u0E1B\u0E31\u0E07", "Score", lang);
    const cml = L("\u0E04\u0E33\u0E21\u0E01\u0E32\u0E23", "Comment", lang);
    const ovl = L("\u0E04\u0E33\u0E19\u0E32\u0E22\u0E25\u0E48\u0E32", "Overall Comment", lang);
    const stl = L("\u0E08\u0E38\u0E14\u0E01\u0E31\u0E1A\u0E07", "Strengths", lang);
    const sgl = L("\u0E02\u0E49\u0E2D\u0E21\u0E23\u0E30\u0E07\u0E08", "Suggestions", lang);
    const title = L("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E01\u0E32\u0E23\u0E2A\u0E2D\u0E14", "Teaching Observation Report", lang);
    win.document.write(
      `<!DOCTYPE html><html><head><title>Observation Report</title>` +
      `<style>body{font-family:sans-serif;padding:30px;color:#333}h1{font-size:20px;margin-bottom:4px}` +
      `.meta{font-size:13px;color:#666;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin:16px 0}` +
      `.score-box{background:#f0f4ff;padding:16px;border-radius:8px;text-align:center;margin:16px 0}` +
      `.score-big{font-size:36px;font-weight:700;color:#2563eb}.section{margin:20px 0}` +
      `.section h3{font-size:15px;margin-bottom:6px}.section p{font-size:13px;line-height:1.6}` +
      `@media print{body{padding:15px}}</style></head><body><h1>${title}</h1>` +
      `<div class="meta"><div>${tl}: ${session?.teacher_name || session?.teacher_id || "-"}</div>` +
      `<div>${cl}: ${session?.classroom || "-"} | ${sl}: ${session?.subject || "-"}</div>` +
      `<div>${dl}: ${formatDate(((session as any)?.scheduled_date ?? (session as any)?.observation_date ?? ""), lang)}</div>` +
      `<div>${ol}: ${session?.observer_name || "-"}</div></div>` +
      `<table><thead><tr><th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${crl}</th>` +
      `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:center">${scl}</th>` +
      `<th style="padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left">${cml}</th></tr></thead>` +
      `<tbody>${rows}</tbody></table>` +
      `<div class="score-box"><div class="score-big">${record.total_score} / ${record.max_score}</div>` +
      `<div>${record.percentage}%</div></div>` +
      `<div class="section"><h3>${ovl}</h3><p>${record.overall_comment || "-"}</p></div>` +
      `<div class="section"><h3>${stl}</h3><p>${record.strengths || "-"}</p></div>` +
      `<div class="section"><h3>${sgl}</h3><p>${record.suggestions || "-"}</p></div>` +
      `<script>window.onload=function(){window.print()}</script></body></html>`
    );
    win.document.close();
  };

  const pctColor = percentage >= 80 ? "text-green-600" : percentage >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" />
          {L("\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E40\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23 \u0E41\u0E1A\u0E1A OBEC", "OBEC Teaching Observation Management", lang)}
        </h1>
        <p className="text-muted-foreground text-sm">
          {L("\u0E23\u0E30\u0E22\u0E30\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48 5 \u0E02\u0E49\u0E2D\u0E2A\u0E2D\u0E14 \u0E2A\u0E1E\u0E40\u0E01\u0E49 + \u0E40\u0E01\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E19", "5-Step Teaching Model Observation + General Criteria", lang)}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="sessions" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />{L("\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Sessions", lang)}
          </TabsTrigger>
          <TabsTrigger value="scoring" className="flex items-center gap-1">
            <Star className="h-4 w-4" />{L("\u0E1B\u0E23\u0E30\u0E21\u0E37\u0E2D\u0E02\u0E48\u0E32\u0E22", "Rubric Scoring", lang)}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1">
            <FileText className="h-4 w-4" />{L("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", "Reports", lang)}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setSessionDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />{L("\u0E2A\u0E23\u0E47\u0E2D\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E21", "New Session", lang)}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {L("\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "All Observation Sessions", lang)}
              </CardTitle>
              <CardDescription>{L("\u0E21\u0E35 " + sessions.length + " \u0E23\u0E31\u0E22", "Total " + sessions.length + " sessions", lang)}</CardDescription>
            </CardHeader>
            <CardContent>
              {sessionsLoading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">{L("\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E14\u0E22...", "Loading...", lang)}</p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{L("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "No observation sessions yet", lang)}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang)}</TableHead>
                        <TableHead>{L("\u0E2B\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21", "Classroom", lang)}</TableHead>
                        <TableHead>{L("\u0E27\u0E34\u0E2A\u0E32", "Subject", lang)}</TableHead>
                        <TableHead>{L("\u0E27\u0E31\u0E22\u0E17\u0E35\u0E48", "Date", lang)}</TableHead>
                        <TableHead>{L("\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observer", lang)}</TableHead>
                        <TableHead>{L("\u0E2A\u0E31\u0E0D\u0E27", "Status", lang)}</TableHead>
                        <TableHead className="text-right">{L("\u0E01\u0E32\u0E23\u0E14\u0E33\u0E40\u0E2B\u0E47\u0E19", "Actions", lang)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s, idx) => {
                        const st = STATUS_MAP[s.status] || STATUS_MAP.draft;
                        const hasRecord = records.some((r) => r.session_id === s.id && !r.is_draft);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{s.teacher_name || getTeacherName(s.teacher_id)}</TableCell>
                            <TableCell>{s.classroom}</TableCell>
                            <TableCell>{s.subject}</TableCell>
                            <TableCell className="text-sm">{formatDate((s as any).scheduled_date ?? (s as any).observation_date, lang)}</TableCell>
                            <TableCell className="text-sm">{s.observer_name || "-"}</TableCell>
                            <TableCell><Badge variant={st.variant}>{(st as any)[lang] ?? (st as any)[`label_${lang}`]}</Badge></TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => { openScoring(s); setActiveTab("scoring"); }} title={L("\u0E1B\u0E23\u0E30\u0E21\u0E37\u0E2D\u0E02\u0E48\u0E32\u0E22", "Score", lang)}>
                                <Star className="h-4 w-4" />
                              </Button>
                              {hasRecord && (
                                <Button variant="ghost" size="sm" onClick={() => setDetailSession(s)} title={L("\u0E14\u0E39\u0E27", "View", lang)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scoring" className="space-y-4 mt-4">
          {!scoringSession ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-medium mb-1">{L("\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27", "Select an observation session", lang)}</p>
                <p className="text-sm">{L("\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27\u0E43\u0E19\u0E01\u0E32\u0E23\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Choose a session from the Sessions tab to begin scoring", lang)}</p>
                <Button variant="outline" className="mt-4" onClick={() => setActiveTab("sessions")}>
                  {L("\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Go to Sessions", lang)}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {scoringSession.teacher_name || getTeacherName(scoringSession.teacher_id)}
                  </h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-3 mt-1">
                    <span className="flex items-center gap-1"><School className="h-3.5 w-3.5" />{scoringSession.classroom}</span>
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{scoringSession.subject}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate((scoringSession as any).scheduled_date ?? (scoringSession as any).observation_date, lang)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${pctColor}`}>{percentage}%</div>
                  <div className="text-sm text-muted-foreground">{totalScore} / {TOTAL_MAX}</div>
                  <Progress value={percentage} className="w-40 h-2 mt-1" />
                </div>
              </div>
              {CRITERION_GROUPS.map((group) => (
                <Card key={group.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {group.key === "5-step" ? <ClipboardCheck className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      {(group as any)[lang] ?? (group as any)[`label_${lang}`]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {RUBRIC_CRITERIA.filter((c) => c.group === group.key).map((c) => (
                      <div key={c.key} className="space-y-3 pb-4 border-b last:border-b-0 last:pb-0">
                        <ScoreSlider value={scores[c.key] || 0} onChange={(v) => setScores((prev) => ({ ...prev, [c.key]: v }))} label={(c as any)[lang] ?? (c as any)[`label_${lang}`] ?? c.key} />
                        <Textarea placeholder={L("\u0E04\u0E33\u0E21\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21...", "Additional comments...", lang)} value={scoreComments[c.key] || ""} onChange={(e) => setScoreComments((prev) => ({ ...prev, [c.key]: e.target.value }))} rows={2} className="text-sm" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{L("\u0E04\u0E33\u0E19\u0E32\u0E22\u0E25\u0E48\u0E32", "Overall Comments", lang)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{L("\u0E04\u0E33\u0E19\u0E32\u0E22\u0E25\u0E48\u0E32", "Overall Comment", lang)}</Label>
                    <Textarea placeholder={L("\u0E04\u0E33\u0E19\u0E32\u0E22\u0E25\u0E48\u0E32\u0E40\u0E01\u0E37\u0E48\u0E2D\u0E23\u0E31\u0E48\u0E07\u0E2A\u0E31\u0E0D\u0E27...", "Overall teaching comments...", lang)} value={overallComment} onChange={(e) => setOverallComment(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-500" />{L("\u0E08\u0E38\u0E14\u0E01\u0E31\u0E1A\u0E07", "Strengths", lang)}</Label>
                    <Textarea placeholder={L("\u0E08\u0E38\u0E14\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E0D\u0E27...", "Teaching strengths...", lang)} value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><AlertCircle className="h-4 w-4 text-amber-500" />{L("\u0E02\u0E49\u0E2D\u0E21\u0E23\u0E30\u0E07\u0E08", "Suggestions", lang)}</Label>
                    <Textarea placeholder={L("\u0E2A\u0E37\u0E48\u0E2D\u0E17\u0E35\u0E48\u0E04\u0E27\u0E32\u0E21\u0E41\u0E1B\u0E25\u0E07\u0E21\u0E32...", "Areas for improvement...", lang)} value={suggestions} onChange={(e) => setSuggestions(e.target.value)} rows={3} />
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setScoringSession(null)}>{L("\u0E22\u0E01\u0E40\u0E25\u0E34\u0E22", "Cancel", lang)}</Button>
                <Button variant="secondary" onClick={() => submitScoreMutation.mutate({ sessionId: scoringSession.id, isDraft: true })} disabled={submitScoreMutation.isPending}>{L("\u0E1A\u0E31\u0E15\u0E27\u0E23\u0E31\u0E1A\u0E2A\u0E34\u0E49\u0E19", "Save Draft", lang)}</Button>
                <Button onClick={() => submitScoreMutation.mutate({ sessionId: scoringSession.id, isDraft: false })} disabled={submitScoreMutation.isPending}>{L("\u0E2A\u0E48\u0E07\u0E1C\u0E37\u0E34\u0E2A\u0E23\u0E30\u0E1B\u0E31\u0E07\u0E2A\u0E34\u0E49\u0E19", "Submit Score", lang)}</Button>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="reports" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />{L("\u0E01\u0E23\u0E32\u0E1B\u0E32\u0E2A\u0E32\u0E23", "Filters", lang)}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang)}</Label>
                  <Select value={filterTeacher} onValueChange={setFilterTeacher}>
                    <SelectTrigger><SelectValue placeholder={L("\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "All", lang)} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{L("\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14", "All Teachers", lang)}</SelectItem>
                      {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.prefix || ""} {t.first_name} {t.last_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{L("\u0E08\u0E32\u0E27\u0E17\u0E35\u0E48", "From Date", lang)}</Label>
                  <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{L("\u0E16\u0E63\u0E48\u0E17\u0E35\u0E48", "To Date", lang)}</Label>
                  <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{L("\u0E1C\u0E37\u0E34\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observation Results", lang)}</CardTitle>
              <CardDescription>{filteredRecords.length + " " + L("\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23", "records", lang)}</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>{L("\u0E44\u0E21\u0E48\u0E1E\u0E22\u0E1C\u0E37\u0E34\u0E2A\u0E23\u0E30\u0E1B\u0E31\u0E07", "No observation records found", lang)}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>{L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang)}</TableHead>
                        <TableHead>{L("\u0E2B\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21", "Class", lang)}</TableHead>
                        <TableHead>{L("\u0E27\u0E34\u0E2A\u0E32", "Subject", lang)}</TableHead>
                        <TableHead>{L("\u0E27\u0E31\u0E22\u0E17\u0E35\u0E48", "Date", lang)}</TableHead>
                        <TableHead className="text-center">{L("\u0E04\u0E23\u0E32\u0E22", "Score", lang)}</TableHead>
                        <TableHead className="text-center">%</TableHead>
                        <TableHead>{L("\u0E2A\u0E31\u0E0D\u0E27", "Status", lang)}</TableHead>
                        <TableHead className="text-right">{L("\u0E14\u0E33\u0E40\u0E2B\u0E47\u0E19", "Actions", lang)}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((r, idx) => {
                        const session = sessions.find((s) => s.id === r.session_id);
                        const sp = calcPercentage(r.total_score);
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-sm">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{session?.teacher_name || getTeacherName(session?.teacher_id || "")}</TableCell>
                            <TableCell>{session?.classroom || "-"}</TableCell>
                            <TableCell>{session?.subject || "-"}</TableCell>
                            <TableCell className="text-sm">{formatDate(((session as any)?.scheduled_date ?? (session as any)?.observation_date ?? ""), lang)}</TableCell>
                            <TableCell className="text-center font-semibold">{r.total_score} / {r.max_score}</TableCell>
                            <TableCell className="text-center"><Badge variant={sp >= 80 ? "outline" : sp >= 60 ? "secondary" : "destructive"}>{sp}%</Badge></TableCell>
                            <TableCell>
                              {r.is_draft ? (
                                <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />{L("\u0E23\u0E31\u0E1A", "Draft", lang)}</Badge>
                              ) : (
                                <Badge variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />{L("\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19", "Completed", lang)}</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => handlePrint(r)} title={L("\u0E1E\u0E34\u0E21\u0E1E\u0E34\u0E19", "Print", lang)}><Printer className="h-4 w-4" /></Button>
                              {session && <Button variant="ghost" size="sm" onClick={() => setDetailSession(session)} title={L("\u0E14\u0E39\u0E27", "View", lang)}><Eye className="h-4 w-4" /></Button>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="sm:max-w-lg sm:max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{L("\u0E2A\u0E23\u0E47\u0E2D\u0E23\u0E31\u0E22\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E21", "New Observation Session", lang)}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang)} *</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger><SelectValue placeholder={L("\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E04\u0E23\u0E37...", "Select teacher...", lang)} /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (<SelectItem key={t.id} value={t.id}>{t.prefix || ""} {t.first_name} {t.last_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{L("\u0E2B\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21", "Classroom", lang)} *</Label>
                <Input value={formClassroom} onChange={(e) => setFormClassroom(e.target.value)} placeholder="1/1" />
              </div>
              <div className="space-y-2">
                <Label>{L("\u0E27\u0E34\u0E2A\u0E32", "Subject", lang)} *</Label>
                <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder={L("\u0E04\u0E13\u0E34\u0E15\u0E28\u0E34\u0E28\u0E2A\u0E32\u0E23", "Mathematics", lang)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{L("\u0E27\u0E31\u0E22\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observation Date", lang)} *</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{L("\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observer Name", lang)}</Label>
                <Input value={formObserver} onChange={(e) => setFormObserver(e.target.value)} placeholder={L("\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observer name", lang)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSessionDialogOpen(false)}>{L("\u0E22\u0E01\u0E40\u0E25\u0E34\u0E22", "Cancel", lang)}</Button>
            <Button onClick={() => createSessionMutation.mutate()} disabled={!formTeacherId || !formClassroom || !formSubject || !formDate || createSessionMutation.isPending}>
              {createSessionMutation.isPending ? "..." : L("\u0E2A\u0E23\u0E47\u0E2D", "Create", lang)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailSession} onOpenChange={() => setDetailSession(null)}>
        <DialogContent className="sm:max-w-2xl sm:max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{L("\u0E23\u0E32\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E23\u0E31\u0E48\u0E27\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observation Detail", lang)}</DialogTitle></DialogHeader>
          {detailSession && (() => {
            const record = records.find((r) => r.session_id === detailSession.id);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{L("\u0E04\u0E23\u0E13\u0E1C\u0E31\u0E14\u0E2A\u0E31\u0E0D\u0E27", "Teacher", lang)}: </span><span className="font-medium">{detailSession.teacher_name || getTeacherName(detailSession.teacher_id)}</span></div>
                  <div><span className="text-muted-foreground">{L("\u0E2B\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21", "Classroom", lang)}: </span><span className="font-medium">{detailSession.classroom}</span></div>
                  <div><span className="text-muted-foreground">{L("\u0E27\u0E34\u0E2A\u0E32", "Subject", lang)}: </span><span className="font-medium">{detailSession.subject}</span></div>
                  <div><span className="text-muted-foreground">{L("\u0E27\u0E31\u0E22\u0E17\u0E35\u0E48", "Date", lang)}: </span><span className="font-medium">{formatDate((detailSession as any).scheduled_date ?? (detailSession as any).observation_date, lang)}</span></div>
                  <div><span className="text-muted-foreground">{L("\u0E1C\u0E39\u0E49\u0E2A\u0E31\u0E19\u0E40\u0E01\u0E32\u0E23", "Observer", lang)}: </span><span className="font-medium">{detailSession.observer_name || "-"}</span></div>
                  <div><span className="text-muted-foreground">{L("\u0E2A\u0E31\u0E0D\u0E27", "Status", lang)}: </span><Badge variant={(STATUS_MAP[detailSession.status] || STATUS_MAP.draft).variant}>{(STATUS_MAP[detailSession.status] as any)[lang] ?? (STATUS_MAP[detailSession.status] as any)[`label_${lang}`] ?? detailSession.status}</Badge></div>
                </div>
                {record ? (
                  <>
                    <div className="text-center py-3 rounded-lg bg-muted">
                      <div className={`text-3xl font-bold ${calcPercentage(record.total_score) >= 80 ? "text-green-600" : calcPercentage(record.total_score) >= 60 ? "text-yellow-600" : "text-red-600"}`}>
                        {record.total_score} / {record.max_score}
                      </div>
                      <div className="text-sm text-muted-foreground">{calcPercentage(record.total_score)}%</div>
                    </div>
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{L("\u0E40\u0E01\u0E37\u0E48\u0E2D\u0E21", "Criteria", lang)}</TableHead>
                        <TableHead className="text-center">{L("\u0E04\u0E23\u0E32\u0E22", "Score", lang)}</TableHead>
                        <TableHead>{L("\u0E04\u0E33\u0E21\u0E01\u0E32\u0E23", "Comment", lang)}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {RUBRIC_CRITERIA.map((c) => (
                          <TableRow key={c.key}>
                            <TableCell className="text-sm font-medium">{(c as any)[lang] ?? (c as any)[`label_${lang}`] ?? c.key}</TableCell>
                            <TableCell className="text-center">{record.scores?.[c.key] ?? 0}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{record.comments?.[c.key] || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {record.overall_comment && <div className="space-y-1"><Label>{L("\u0E04\u0E33\u0E19\u0E32\u0E22", "Overall", lang)}</Label><p className="text-sm">{record.overall_comment}</p></div>}
                    {record.strengths && <div className="space-y-1"><Label className="text-green-600">{L("\u0E08\u0E38\u0E14\u0E01\u0E31\u0E1A\u0E07", "Strengths", lang)}</Label><p className="text-sm">{record.strengths}</p></div>}
                    {record.suggestions && <div className="space-y-1"><Label className="text-amber-600">{L("\u0E02\u0E49\u0E2D\u0E21\u0E23\u0E30\u0E07\u0E08", "Suggestions", lang)}</Label><p className="text-sm">{record.suggestions}</p></div>}
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => { handlePrint(record); }}>
                        <Printer className="h-4 w-4 mr-1" />{L("\u0E1E\u0E34\u0E21\u0E1E\u0E34\u0E19", "Print", lang)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-4">{L("\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E37\u0E34\u0E2A\u0E23\u0E30\u0E1B\u0E31\u0E07", "No observation record yet", lang)}</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
