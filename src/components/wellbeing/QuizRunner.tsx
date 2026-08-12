import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";

export interface QuizOption { label: string; value: number; emoji?: string }
export interface QuizQuestion { id: string; text: string; options: QuizOption[] }

interface Props {
  title: string;
  intro?: string;
  questions: QuizQuestion[];
  submitting?: boolean;
  onCancel?: () => void;
  onFinish: (answers: Record<string, number>) => void;
}

const CHEERS = ["เยี่ยมมาก!", "ไปได้สวย!", "อีกนิดเดียว!", "สุดยอด!", "ทำได้ดีมาก!"];

/** แบบประเมินทีละข้อ พร้อมแถบความคืบหน้าและคำชม เพื่อให้นักเรียนอยากทำจนจบ */
export default function QuizRunner({ title, intro, questions, submitting, onCancel, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const q = questions[idx];
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const pct = Math.round((answered / total) * 100);
  const cheer = useMemo(() => CHEERS[Math.floor((idx / total) * CHEERS.length)] ?? CHEERS[0], [idx, total]);

  const pick = (value: number) => {
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    if (idx < total - 1) setTimeout(() => setIdx((i) => i + 1), 180);
  };

  const allDone = questions.every((x) => answers[x.id] !== undefined);

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> {title}
            </div>
            {intro && <p className="text-xs text-muted-foreground mt-0.5">{intro}</p>}
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">{pct}%</div>
            <div className="text-[11px] text-muted-foreground">{answered}/{total} ข้อ</div>
          </div>
        </div>
        <Progress value={pct} className="h-2 mt-3" />
        <div className="text-[11px] text-primary mt-1">{cheer}</div>
      </div>

      <CardContent className="p-5 space-y-4">
        <div className="text-sm text-muted-foreground">ข้อ {idx + 1} จาก {total}</div>
        <div className="text-lg font-medium leading-relaxed">{q.text}</div>

        <div className="grid gap-2">
          {q.options.map((o) => {
            const active = answers[q.id] === o.value;
            return (
              <button
                key={`${o.label}-${o.value}`}
                onClick={() => pick(o.value)}
                className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition-all hover:border-primary/60 hover:bg-primary/5 ${
                  active ? "border-primary bg-primary/10 font-medium shadow-sm" : "border-border"
                }`}
              >
                <span className="mr-2">{o.emoji ?? (active ? "✅" : "⚪")}</span>
                {o.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> ก่อนหน้า
            </Button>
            <Button variant="ghost" size="sm" disabled={idx >= total - 1} onClick={() => setIdx((i) => i + 1)}>
              ถัดไป <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="flex gap-2">
            {onCancel && <Button variant="outline" size="sm" onClick={onCancel}>ยกเลิก</Button>}
            <Button size="sm" disabled={!allDone || submitting} onClick={() => onFinish(answers)}>
              <Check className="w-4 h-4 mr-1" /> {submitting ? "กำลังบันทึก..." : "ส่งคำตอบ"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
