import { useState, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, ClipboardCheck, Eye, AlertTriangle, Heart, Shield, Flame } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

// ==========================================
// Section 1: DISC (16 ข้อ) — cross-validated
// ==========================================
type DiscType = "D" | "I" | "S" | "C";
interface DiscOption { label: string; type: DiscType }
interface DiscQuestion { id: number; q: string; options: DiscOption[] }

const DISC_QUESTIONS: DiscQuestion[] = [
  // --- กลุ่ม A: สถานการณ์ในที่ทำงาน ---
  { id: 1, q: "เมื่อโรงเรียนต้องเตรียมรับการประเมินจาก สมศ. คุณมักจะ...", options: [
    { label: "รับเป็นแกนนำวางแผนจัดเตรียมทันที", type: "D" },
    { label: "ประสานงานทุกฝ่ายและสร้างบรรยากาศร่วมมือ", type: "I" },
    { label: "สนับสนุนงานเบื้องหลังอย่างสม่ำเสมอ", type: "S" },
    { label: "ตรวจสอบเกณฑ์ประเมินอย่างละเอียดและจัดทำรายงาน", type: "C" },
  ]},
  { id: 2, q: "ในที่ประชุมครูประจำเดือน คุณมักจะ...", options: [
    { label: "เสนอแนวทางแก้ปัญหาและตัดสินใจรวดเร็ว", type: "D" },
    { label: "กระตุ้นให้คนอื่นมีส่วนร่วมอย่างกระตือรือร้น", type: "I" },
    { label: "รับฟังทุกฝ่ายอย่างใจเย็นก่อนแสดงความเห็น", type: "S" },
    { label: "เตรียมข้อมูลสถิติมาสนับสนุนข้อเสนอ", type: "C" },
  ]},
  { id: 3, q: "เมื่อมีโครงการกิจกรรมพิเศษ (ค่ายวิชาการ/กีฬาสี) คุณมักจะ...", options: [
    { label: "อาสารับผิดชอบเป็นประธานจัดงาน", type: "D" },
    { label: "ดูแลบรรยากาศให้สนุกสนานและทุกคนมีส่วนร่วม", type: "I" },
    { label: "ช่วยงานเบื้องหลังจนเสร็จโดยไม่ต้องรับเครดิต", type: "S" },
    { label: "วางแผนงบ ตาราง และรายละเอียดอย่างเป็นระบบ", type: "C" },
  ]},
  { id: 4, q: "เมื่อนักเรียนมีปัญหาพฤติกรรมในห้องเรียน คุณจัดการอย่างไร...", options: [
    { label: "แก้ไขสถานการณ์ทันทีด้วยความเด็ดขาด", type: "D" },
    { label: "พูดคุยสร้างแรงจูงใจให้นักเรียนปรับตัว", type: "I" },
    { label: "รับฟังปัญหาอย่างอดทนและให้โอกาสปรับปรุง", type: "S" },
    { label: "บันทึกพฤติกรรมอย่างเป็นระบบเพื่อหาแนวทาง", type: "C" },
  ]},
  // --- กลุ่ม B: บทบาทและจุดแข็ง ---
  { id: 5, q: "ในการทำงานฝ่ายงานต่างๆ คุณถนัดที่สุดคือ...", options: [
    { label: "ฝ่ายบริหาร - วางนโยบายและขับเคลื่อนองค์กร", type: "D" },
    { label: "ฝ่ายกิจการนักเรียน - ดูแลกิจกรรมและสร้างความสัมพันธ์", type: "I" },
    { label: "ฝ่ายบริการ/สนับสนุน - อำนวยความสะดวกทุกฝ่าย", type: "S" },
    { label: "ฝ่ายวิชาการ/งบประมาณ - วิเคราะห์ข้อมูลและวางแผน", type: "C" },
  ]},
  { id: 6, q: "รูปแบบการสอนที่คุณถนัดที่สุดคือ...", options: [
    { label: "Project-Based Learning ที่เน้นผลสัมฤทธิ์", type: "D" },
    { label: "Active Learning ที่สนุกสนาน มีส่วนร่วมสูง", type: "I" },
    { label: "สอนทีละขั้นตอน ดูแลรายคนอย่างใจเย็น", type: "S" },
    { label: "วางแผนการสอนละเอียด มีสื่อ/ใบงานครบถ้วน", type: "C" },
  ]},
  { id: 7, q: "เมื่อต้องประสานงานกับผู้ปกครอง คุณมักจะ...", options: [
    { label: "แจ้งข้อมูลตรงประเด็นและเสนอทางออกชัดเจน", type: "D" },
    { label: "สร้างความสัมพันธ์ที่ดีและสื่อสารด้วยความเป็นมิตร", type: "I" },
    { label: "รับฟังด้วยความเข้าใจและติดตามอย่างต่อเนื่อง", type: "S" },
    { label: "เตรียมข้อมูลผลการเรียน/พฤติกรรมอย่างครบถ้วน", type: "C" },
  ]},
  { id: 8, q: "จุดแข็งของคุณในการทำงานโรงเรียนคือ...", options: [
    { label: "กล้าตัดสินใจ มุ่งมั่น ผลักดันงานให้สำเร็จ", type: "D" },
    { label: "สื่อสารเก่ง สร้างแรงบันดาลใจให้ทีมครู", type: "I" },
    { label: "อดทน เชื่อถือได้ ดูแลนักเรียนสม่ำเสมอ", type: "S" },
    { label: "ละเอียดรอบคอบ จัดทำเอกสาร/รายงานมีคุณภาพ", type: "C" },
  ]},
  // --- กลุ่ม C: Cross-validation (ถามวนซ้ำเพื่อยืนยันความสม่ำเสมอ) ---
  { id: 9, q: "เมื่อเพื่อนร่วมงานขอความช่วยเหลือเรื่องที่ไม่ใช่หน้าที่ของคุณ คุณมักจะ...", options: [
    { label: "ช่วยเท่าที่จำเป็น แต่กลับไปทำงานของตัวเองให้เสร็จก่อน", type: "D" },
    { label: "ช่วยด้วยความยินดีและชวนคุยไปด้วย", type: "I" },
    { label: "ช่วยอย่างเต็มที่แม้ต้องทำงานล่วงเวลา", type: "S" },
    { label: "ช่วยได้ถ้ามีข้อมูลที่ชัดเจนว่าต้องทำอะไร", type: "C" },
  ]},
  { id: 10, q: "ถ้าได้เป็นหัวหน้าโครงการ สิ่งแรกที่คุณจะทำคือ...", options: [
    { label: "กำหนดเป้าหมายและ deadline ทันที", type: "D" },
    { label: "นัดประชุมทีมเพื่อสร้างความตื่นเต้นร่วมกัน", type: "I" },
    { label: "สำรวจว่าสมาชิกแต่ละคนพร้อมแค่ไหน", type: "S" },
    { label: "รวบรวมข้อมูลและทำ Research ก่อน", type: "C" },
  ]},
  { id: 11, q: "สิ่งที่ทำให้คุณเครียดมากที่สุดในการทำงานคือ...", options: [
    { label: "ความล่าช้าและการตัดสินใจที่ไม่ชัดเจน", type: "D" },
    { label: "บรรยากาศเงียบเหงา ไม่มีปฏิสัมพันธ์กับใคร", type: "I" },
    { label: "ความขัดแย้งรุนแรงหรือถูกกดดันอย่างหนัก", type: "S" },
    { label: "งานที่ไม่มีระบบ ข้อมูลสับสน ไม่มีมาตรฐาน", type: "C" },
  ]},
  { id: 12, q: "เมื่อโรงเรียนต้องปรับหลักสูตรใหม่ คุณมักจะ...", options: [
    { label: "นำทีมครูวางกรอบหลักสูตรใหม่ทันที", type: "D" },
    { label: "ระดมความคิดจากครูทุกกลุ่มสาระอย่างสนุกสนาน", type: "I" },
    { label: "ค่อยๆ ปรับเปลี่ยนตามจังหวะ ไม่รีบร้อน", type: "S" },
    { label: "ศึกษาหลักสูตรแกนกลางอย่างละเอียดก่อนเริ่ม", type: "C" },
  ]},
  // --- กลุ่ม D: สถานการณ์ที่ท้าทาย (เพื่อวัดแววที่ลึกขึ้น) ---
  { id: 13, q: "ถ้าผู้ปกครองมาร้องเรียนอย่างรุนแรง คุณจะจัดการอย่างไร...", options: [
    { label: "เผชิญหน้าอย่างมั่นคงและชี้แจงข้อเท็จจริง", type: "D" },
    { label: "ใช้ทักษะสื่อสารคลี่คลายอารมณ์แล้วหาทางออกร่วมกัน", type: "I" },
    { label: "รับฟังอย่างอดทน ไม่โต้แย้ง แล้วค่อยๆ อธิบาย", type: "S" },
    { label: "รวบรวมหลักฐานและเอกสารยืนยันก่อนชี้แจง", type: "C" },
  ]},
  { id: 14, q: "เมื่อมีครูคนหนึ่งทำผิดพลาดร้ายแรง คุณมักจะ...", options: [
    { label: "ตักเตือนอย่างตรงไปตรงมาทันที", type: "D" },
    { label: "พูดคุยเป็นการส่วนตัวด้วยท่าทีเป็นมิตร", type: "I" },
    { label: "ให้โอกาสแก้ตัวและติดตามอย่างใกล้ชิด", type: "S" },
    { label: "ตรวจสอบระเบียบแล้วดำเนินการตามขั้นตอน", type: "C" },
  ]},
  { id: 15, q: "ในช่วงสอบปลายภาค คุณรู้สึกอย่างไร...", options: [
    { label: "ตื่นเต้นที่จะเห็นผลลัพธ์ของการสอน", type: "D" },
    { label: "เป็นห่วงนักเรียนและคอยให้กำลังใจ", type: "I" },
    { label: "ทำหน้าที่คุมสอบอย่างสม่ำเสมอตามตาราง", type: "S" },
    { label: "เตรียมข้อสอบและเกณฑ์ให้ครบถ้วนล่วงหน้า", type: "C" },
  ]},
  { id: 16, q: "ถ้าต้องเลือกหนึ่งอย่าง คุณเลือก...", options: [
    { label: "อำนาจในการตัดสินใจและเปลี่ยนแปลงสิ่งต่างๆ", type: "D" },
    { label: "การยอมรับและความรักจากเพื่อนร่วมงาน", type: "I" },
    { label: "ความมั่นคงและสภาพแวดล้อมที่สงบ", type: "S" },
    { label: "ความถูกต้องแม่นยำในทุกสิ่งที่ทำ", type: "C" },
  ]},
];

// ==========================================
// Section 2: สุขภาพจิตเบื้องต้น (24 ข้อ)
// ==========================================
type MhDomain = "stress" | "burnout" | "resilience" | "interpersonal" | "emotional" | "selfworth";
interface MhQuestion { id: number; q: string; domain: MhDomain; reversed?: boolean }

// Likert 1-5: ไม่เลย / น้อย / ปานกลาง / มาก / มากที่สุด
const MH_QUESTIONS: MhQuestion[] = [
  // --- ความเครียด (stress) ---
  { id: 101, q: "ท่านรู้สึกกังวลหรือเครียดเกี่ยวกับงานแม้ในเวลาพักผ่อน", domain: "stress" },
  { id: 102, q: "ท่านมีอาการปวดหัว ปวดไหล่ หรือนอนไม่หลับจากความเครียดในงาน", domain: "stress" },
  { id: 103, q: "ท่านรู้สึกว่างานเอกสาร/รายงานมีมากจนรับมือไม่ไหว", domain: "stress" },
  { id: 104, q: "ท่านสามารถจัดการเวลาให้สมดุลระหว่างงานกับชีวิตส่วนตัวได้ดี", domain: "stress", reversed: true },
  // --- ภาวะหมดไฟ (burnout) ---
  { id: 201, q: "ท่านรู้สึกเบื่อหน่ายกับงานสอนหรืองานในโรงเรียน", domain: "burnout" },
  { id: 202, q: "ท่านรู้สึกว่าความพยายามของท่านไม่ได้รับการเห็นคุณค่า", domain: "burnout" },
  { id: 203, q: "ท่านรู้สึกหมดแรงจูงใจในการทำงานหรืออยากลาออก", domain: "burnout" },
  { id: 204, q: "ท่านยังคงรู้สึกตื่นเต้นและมีความสุขเมื่อสอนนักเรียน", domain: "burnout", reversed: true },
  // --- ความยืดหยุ่นทางอารมณ์ (resilience) ---
  { id: 301, q: "เมื่อเจอปัญหา ท่านสามารถฟื้นตัวและกลับมาสู้ต่อได้เร็ว", domain: "resilience", reversed: true },
  { id: 302, q: "ท่านมองปัญหาเป็นโอกาสในการเรียนรู้มากกว่าอุปสรรค", domain: "resilience", reversed: true },
  { id: 303, q: "เมื่อถูกวิพากษ์วิจารณ์ ท่านรู้สึกเสียใจนานหลายวัน", domain: "resilience" },
  { id: 304, q: "ท่านมีความมั่นใจว่าสามารถรับมือกับความเปลี่ยนแปลงได้", domain: "resilience", reversed: true },
  // --- ความสัมพันธ์กับเพื่อนร่วมงาน (interpersonal) ---
  { id: 401, q: "ท่านรู้สึกว่ามีเพื่อนร่วมงานที่ไว้วางใจปรึกษาได้", domain: "interpersonal", reversed: true },
  { id: 402, q: "ท่านรู้สึกโดดเดี่ยวหรือถูกแบ่งแยกจากกลุ่มในที่ทำงาน", domain: "interpersonal" },
  { id: 403, q: "ท่านสามารถแสดงความเห็นต่างโดยไม่เกิดความขัดแย้ง", domain: "interpersonal", reversed: true },
  { id: 404, q: "ท่านรู้สึกไม่สบายใจเมื่อต้องทำงานร่วมกับบางคน", domain: "interpersonal" },
  // --- ความมั่นคงทางอารมณ์ (emotional) ---
  { id: 501, q: "ท่านมีอารมณ์แปรปรวนง่ายในช่วงที่งานหนัก", domain: "emotional" },
  { id: 502, q: "ท่านสามารถควบคุมอารมณ์ได้ดีแม้ในสถานการณ์กดดัน", domain: "emotional", reversed: true },
  { id: 503, q: "ท่านรู้สึกหงุดหงิดหรือโกรธง่ายกว่าปกติในช่วงนี้", domain: "emotional" },
  { id: 504, q: "ท่านมีช่วงเวลาที่รู้สึกเศร้าหรือหดหู่โดยไม่มีเหตุผลชัดเจน", domain: "emotional" },
  // --- คุณค่าในตนเอง (selfworth) ---
  { id: 601, q: "ท่านรู้สึกภูมิใจในอาชีพครูและงานที่ทำอยู่", domain: "selfworth", reversed: true },
  { id: 602, q: "ท่านรู้สึกว่าตัวเองไม่เก่งพอเมื่อเทียบกับครูคนอื่น", domain: "selfworth" },
  { id: 603, q: "ท่านเชื่อมั่นว่าการสอนของท่านสร้างความเปลี่ยนแปลงให้นักเรียน", domain: "selfworth", reversed: true },
  { id: 604, q: "ท่านรู้สึกว่าตัวเองเป็นภาระของทีม", domain: "selfworth" },
];

const LIKERT_OPTIONS = [
  { value: 1, label: "ไม่เลย" },
  { value: 2, label: "น้อย" },
  { value: 3, label: "ปานกลาง" },
  { value: 4, label: "มาก" },
  { value: 5, label: "มากที่สุด" },
];

const MH_DOMAIN_LABELS: Record<MhDomain, { label: string; icon: any; riskLabel: string }> = {
  stress: { label: "ความเครียดในงาน", icon: AlertTriangle, riskLabel: "ระดับความเครียด" },
  burnout: { label: "ภาวะหมดไฟ (Burnout)", icon: Flame, riskLabel: "ความเสี่ยงหมดไฟ" },
  resilience: { label: "ความยืดหยุ่นทางจิตใจ", icon: Shield, riskLabel: "ความยืดหยุ่น" },
  interpersonal: { label: "ความสัมพันธ์ในที่ทำงาน", icon: Heart, riskLabel: "ความสัมพันธ์" },
  emotional: { label: "ความมั่นคงทางอารมณ์", icon: Brain, riskLabel: "ความมั่นคงอารมณ์" },
  selfworth: { label: "คุณค่าในตนเอง", icon: Heart, riskLabel: "ความเชื่อมั่นในตนเอง" },
};

const DISC_LABELS: Record<string, { label: string; desc: string; color: string; suitableFor: string }> = {
  D: {
    label: "D - Dominance (ผู้นำ)",
    desc: "กล้าตัดสินใจ มุ่งผลสำเร็จ ขับเคลื่อนองค์กร",
    color: "bg-danger-soft text-danger",
    suitableFor: "เหมาะกับ: หัวหน้าฝ่าย, ผู้ช่วย ผอ., ประธานโครงการ, หัวหน้ากลุ่มสาระ",
  },
  I: {
    label: "I - Influence (ผู้สร้างแรงบันดาลใจ)",
    desc: "สื่อสารเก่ง มีเสน่ห์ กระตือรือร้น สร้างบรรยากาศดี",
    color: "bg-warning-soft text-warning",
    suitableFor: "เหมาะกับ: ฝ่ายกิจการนักเรียน, ประชาสัมพันธ์, ครูที่ปรึกษา, กิจกรรมพัฒนาผู้เรียน",
  },
  S: {
    label: "S - Steadiness (ผู้สนับสนุน)",
    desc: "อดทน ใจเย็น เชื่อถือได้ ทำงานสม่ำเสมอ",
    color: "bg-success-soft text-success",
    suitableFor: "เหมาะกับ: ครูประจำชั้น, งานแนะแนว, ดูแลนักเรียนพิเศษ, งานห้องสมุด",
  },
  C: {
    label: "C - Conscientiousness (ผู้วิเคราะห์)",
    desc: "ละเอียดรอบคอบ มีระบบ ทำงานมีคุณภาพ",
    color: "bg-info-soft text-info",
    suitableFor: "เหมาะกับ: ฝ่ายวิชาการ, งานทะเบียน/วัดผล, งบประมาณ, งานวิจัย/SAR",
  },
};

// ==========================================
// Scoring helpers
// ==========================================
const calcDiscScores = (answers: Record<number, string>) => {
  const scores: Record<string, number> = { D: 0, I: 0, S: 0, C: 0 };
  DISC_QUESTIONS.forEach((q) => {
    const ans = answers[q.id];
    if (ans) scores[ans] = (scores[ans] || 0) + 1;
  });
  return scores;
};

const calcMhScores = (answers: Record<number, number>) => {
  const domains: Record<MhDomain, number[]> = {
    stress: [], burnout: [], resilience: [], interpersonal: [], emotional: [], selfworth: [],
  };
  MH_QUESTIONS.forEach((q) => {
    const raw = answers[q.id];
    if (raw == null) return;
    const score = q.reversed ? (6 - raw) : raw; // reversed = high is good → flip
    domains[q.domain].push(score);
  });
  const result: Record<MhDomain, { avg: number; level: string; color: string }> = {} as any;
  for (const [domain, scores] of Object.entries(domains)) {
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    let level: string, color: string;
    if (avg <= 1.5) { level = "ปกติ"; color = "bg-success-soft text-success"; }
    else if (avg <= 2.5) { level = "เล็กน้อย"; color = "bg-info-soft text-info"; }
    else if (avg <= 3.5) { level = "ปานกลาง"; color = "bg-warning-soft text-warning"; }
    else if (avg <= 4.0) { level = "สูง"; color = "bg-warning-soft text-warning"; }
    else { level = "สูงมาก — ควรได้รับการดูแล"; color = "bg-danger-soft text-danger"; }
    result[domain as MhDomain] = { avg, level, color };
  }
  return result;
};

const getOverallMhRisk = (mhScores: ReturnType<typeof calcMhScores>) => {
  const riskDomains = ["stress", "burnout", "emotional", "selfworth"] as MhDomain[];
  const avgRisk = riskDomains.reduce((sum, d) => sum + (mhScores[d]?.avg || 0), 0) / riskDomains.length;
  // resilience and interpersonal are protective factors
  const protective = (["resilience", "interpersonal"] as MhDomain[]).reduce((sum, d) => sum + (mhScores[d]?.avg || 0), 0) / 2;
  // Lower protective = worse (because reversed items flip)
  const combined = avgRisk - (5 - protective) * 0.3;
  if (combined <= 2) return { level: "สุขภาพจิตดี", color: "text-success", emoji: "😊" };
  if (combined <= 3) return { level: "พอใช้ — ควรดูแลตัวเอง", color: "text-warning", emoji: "😐" };
  if (combined <= 3.8) return { level: "เสี่ยง — ควรได้รับการสนับสนุน", color: "text-warning", emoji: "😟" };
  return { level: "เสี่ยงสูง — ควรปรึกษาผู้เชี่ยวชาญ", color: "text-danger", emoji: "🆘" };
};

// ==========================================
// Component
// ==========================================
const PersonnelAssessmentPage = () => {
  const { lang } = useLanguage();
  const { role, userId } = useUserRole();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"self" | "overview">("self");
  const [section, setSection] = useState<"disc" | "mh">("disc");
  const [discAnswers, setDiscAnswers] = useState<Record<number, string>>({});
  const [mhAnswers, setMhAnswers] = useState<Record<number, number>>({});
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear() + 543));

  const isAdminOrDirector = role === "admin" || role === "director";

  const currentUser = useMemo(() => (userId ? { id: userId } : null), [userId]);

  const { data: myAssessments = [] } = useQuery({
    queryKey: ["my-assessments", currentUser?.id],
    enabled: !!currentUser?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel_assessments")
        .select("*")
        .eq("user_id", currentUser!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: allAssessments = [] } = useQuery({
    queryKey: ["all-assessments", yearFilter],
    enabled: isAdminOrDirector,
    queryFn: async () => {
      const { data } = await supabase
        .from("personnel_assessments")
        .select("*")
        .eq("academic_year", parseInt(yearFilter) - 543)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["assessment-profiles"],
    enabled: isAdminOrDirector,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, position_title, department");
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const discScores = calcDiscScores(discAnswers);
      const dominant = Object.entries(discScores).sort((a, b) => b[1] - a[1])[0][0];
      const mhScores = calcMhScores(mhAnswers);

      const { error } = await supabase.from("personnel_assessments").insert({
        user_id: currentUser!.id,
        assessment_type: "disc_mh_comprehensive",
        answers: { disc: discAnswers, mh: mhAnswers },
        scores: { disc: discScores, mh: Object.fromEntries(Object.entries(mhScores).map(([k, v]) => [k, v.avg])) },
        total_score: DISC_QUESTIONS.length + MH_QUESTIONS.length,
        result_summary: dominant,
        academic_year: new Date().getFullYear(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลการประเมินเรียบร้อย");
      setDiscAnswers({});
      setMhAnswers({});
      setSection("disc");
      queryClient.invalidateQueries({ queryKey: ["my-assessments"] });
      queryClient.invalidateQueries({ queryKey: ["all-assessments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const discComplete = Object.keys(discAnswers).length === DISC_QUESTIONS.length;
  const mhComplete = Object.keys(mhAnswers).length === MH_QUESTIONS.length;
  const allComplete = discComplete && mhComplete;

  const discProgress = Math.round((Object.keys(discAnswers).length / DISC_QUESTIONS.length) * 100);
  const mhProgress = Math.round((Object.keys(mhAnswers).length / MH_QUESTIONS.length) * 100);

  const getProfileName = (uid: string) => {
    const p = profiles.find((pr: any) => pr.id === uid);
    return p ? `${p.first_name} ${p.last_name}` : uid.slice(0, 8);
  };
  const getProfileDept = (uid: string) => profiles.find((pr: any) => pr.id === uid)?.department || "-";
  const getProfilePosition = (uid: string) => profiles.find((pr: any) => pr.id === uid)?.position_title || "-";

  // Stats for overview
  const discStats = { D: 0, I: 0, S: 0, C: 0 };
  const mhRiskCounts = { good: 0, fair: 0, risk: 0, high: 0 };
  allAssessments.forEach((a: any) => {
    if (a.result_summary && discStats[a.result_summary as keyof typeof discStats] !== undefined) {
      discStats[a.result_summary as keyof typeof discStats]++;
    }
    const mhS = a.scores?.mh;
    if (mhS) {
      const riskDomains = ["stress", "burnout", "emotional", "selfworth"];
      const avgRisk = riskDomains.reduce((sum, d) => sum + (mhS[d] || 0), 0) / riskDomains.length;
      if (avgRisk <= 2) mhRiskCounts.good++;
      else if (avgRisk <= 3) mhRiskCounts.fair++;
      else if (avgRisk <= 3.8) mhRiskCounts.risk++;
      else mhRiskCounts.high++;
    }
  });

  // Preview of latest result
  const latestResult = useMemo(() => {
    if (!myAssessments.length) return null;
    const latest = myAssessments[0] as any;
    const disc = latest.scores?.disc || latest.scores || {};
    const mh = latest.scores?.mh;
    const dominant = latest.result_summary;
    return { disc, mh, dominant, created_at: latest.created_at };
  }, [myAssessments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          แบบประเมินบุคลิกภาพและสุขภาพจิตครู
        </h1>
        <p className="text-sm text-muted-foreground">
          DISC Personality + Mental Wellness Screening — 40 ข้อ เพื่อวัดแววบุคลิกภาพ ประเมินความเครียด ภาวะหมดไฟ และความพร้อมทางจิตใจ
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "self" ? "default" : "outline"} size="sm" onClick={() => setTab("self")}>
          <ClipboardCheck className="w-4 h-4 mr-1" /> ทำแบบประเมิน
        </Button>
        {isAdminOrDirector && (
          <Button variant={tab === "overview" ? "default" : "outline"} size="sm" onClick={() => setTab("overview")}>
            <Eye className="w-4 h-4 mr-1" /> ภาพรวม (สำหรับ ผอ.)
          </Button>
        )}
      </div>

      {/* ========= SELF TAB ========= */}
      {tab === "self" && (
        <div className="space-y-6">
          {/* Latest result */}
          {latestResult && (
            <Card>
              <CardHeader><CardTitle className="text-base">ผลประเมินล่าสุดของคุณ</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {/* DISC result */}
                {(() => {
                  const info = DISC_LABELS[latestResult.dominant] || DISC_LABELS["S"];
                  return (
                    <div className="space-y-3">
                      <Badge className={info.color + " text-sm px-3 py-1"}>{info.label}</Badge>
                      <p className="text-sm text-muted-foreground">{info.desc}</p>
                      <p className="text-sm font-medium text-primary">{info.suitableFor}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {Object.entries(latestResult.disc).map(([type, score]) => (
                          <div key={type} className="text-center">
                            <p className="text-xs text-muted-foreground">{DISC_LABELS[type]?.label.split(" ")[0] || type}</p>
                            <Progress value={(Number(score) / DISC_QUESTIONS.length) * 100} className="h-2 mt-1" />
                            <p className="text-sm font-bold mt-1">{String(score)}/{DISC_QUESTIONS.length}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {/* MH result */}
                {latestResult.mh && (
                  <div className="mt-4 border-t pt-4 space-y-2">
                    <p className="text-sm font-semibold">สุขภาพจิตเบื้องต้น</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(latestResult.mh).map(([domain, avg]) => {
                        const info = MH_DOMAIN_LABELS[domain as MhDomain];
                        if (!info) return null;
                        const val = Number(avg);
                        let level: string, color: string;
                        if (val <= 1.5) { level = "ปกติ"; color = "bg-success-soft text-success"; }
                        else if (val <= 2.5) { level = "เล็กน้อย"; color = "bg-info-soft text-info"; }
                        else if (val <= 3.5) { level = "ปานกลาง"; color = "bg-warning-soft text-warning"; }
                        else { level = "สูง"; color = "bg-warning-soft text-warning"; }
                        return (
                          <div key={domain} className="p-2 rounded border text-center">
                            <p className="text-xs text-muted-foreground">{info.label}</p>
                            <Badge className={color + " mt-1"}>{level}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  ประเมินเมื่อ: {new Date(latestResult.created_at).toLocaleDateString("th-TH")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Progress overview */}
          <div className="grid grid-cols-2 gap-3">
            <Card className={`cursor-pointer border-2 ${section === "disc" ? "border-primary" : "border-transparent"}`} onClick={() => setSection("disc")}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">ตอนที่ 1: DISC ({Object.keys(discAnswers).length}/{DISC_QUESTIONS.length})</p>
                </div>
                <Progress value={discProgress} className="h-2 mt-2" />
                {discComplete && <p className="text-xs text-success mt-1">✓ ครบแล้ว</p>}
              </CardContent>
            </Card>
            <Card className={`cursor-pointer border-2 ${section === "mh" ? "border-primary" : "border-transparent"}`} onClick={() => setSection("mh")}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">ตอนที่ 2: สุขภาพจิต ({Object.keys(mhAnswers).length}/{MH_QUESTIONS.length})</p>
                </div>
                <Progress value={mhProgress} className="h-2 mt-2" />
                {mhComplete && <p className="text-xs text-success mt-1">✓ ครบแล้ว</p>}
              </CardContent>
            </Card>
          </div>

          {/* Section 1: DISC */}
          {section === "disc" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  ตอนที่ 1: แบบวัดบุคลิกภาพ DISC (เลือก 1 ข้อที่ตรงกับตัวคุณมากที่สุด)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {DISC_QUESTIONS.map((q) => (
                  <div key={q.id} className="p-4 border rounded-lg">
                    <p className="font-medium mb-3">{q.id}. {q.q}</p>
                    <RadioGroup value={discAnswers[q.id] || ""} onValueChange={(v) => setDiscAnswers({ ...discAnswers, [q.id]: v })}>
                      <div className="space-y-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <RadioGroupItem value={opt.type} id={`dq${q.id}-${i}`} />
                            <Label htmlFor={`dq${q.id}-${i}`} className="cursor-pointer text-sm">{opt.label}</Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                  </div>
                ))}
                <Button className="w-full" onClick={() => setSection("mh")} disabled={!discComplete}>
                  ถัดไป → ตอนที่ 2: สุขภาพจิต
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Section 2: Mental Health */}
          {section === "mh" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  ตอนที่ 2: แบบประเมินสุขภาพจิตเบื้องต้น (เลือกระดับที่ตรงกับความรู้สึกของท่านในช่วง 1 เดือนที่ผ่านมา)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {(["stress", "burnout", "resilience", "interpersonal", "emotional", "selfworth"] as MhDomain[]).map((domain) => {
                  const domainInfo = MH_DOMAIN_LABELS[domain];
                  const domainQs = MH_QUESTIONS.filter((q) => q.domain === domain);
                  const Icon = domainInfo.icon;
                  return (
                    <div key={domain} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Icon className="w-4 h-4 text-primary" />
                        {domainInfo.label}
                      </div>
                      {domainQs.map((q) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm">{q.id - Math.floor(q.id / 100) * 100}. {q.q}</p>
                          <RadioGroup
                            value={mhAnswers[q.id] != null ? String(mhAnswers[q.id]) : ""}
                            onValueChange={(v) => setMhAnswers({ ...mhAnswers, [q.id]: parseInt(v) })}
                            className="flex flex-wrap gap-3"
                          >
                            {LIKERT_OPTIONS.map((opt) => (
                              <div key={opt.value} className="flex items-center gap-1">
                                <RadioGroupItem value={String(opt.value)} id={`mh${q.id}-${opt.value}`} />
                                <Label htmlFor={`mh${q.id}-${opt.value}`} className="cursor-pointer text-xs">{opt.label}</Label>
                              </div>
                            ))}
                          </RadioGroup>
                        </div>
                      ))}
                    </div>
                  );
                })}

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSection("disc")}>← กลับตอนที่ 1</Button>
                  <Button
                    className="flex-1"
                    onClick={() => submitMutation.mutate()}
                    disabled={!allComplete || submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "กำลังบันทึก..." : `ส่งผลประเมิน (${Object.keys(discAnswers).length + Object.keys(mhAnswers).length}/40 ข้อ)`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ========= OVERVIEW TAB ========= */}
      {tab === "overview" && isAdminOrDirector && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">ประเมินแล้ว</p>
              <p className="text-2xl font-bold text-primary">{allAssessments.length}</p>
            </CardContent></Card>
            {Object.entries(DISC_LABELS).map(([type, info]) => (
              <Card key={type}><CardContent className="pt-4 text-center">
                <p className="text-xs text-muted-foreground">{type}</p>
                <p className="text-2xl font-bold">{discStats[type as keyof typeof discStats]}</p>
              </CardContent></Card>
            ))}
            <Card className="border-danger/30"><CardContent className="pt-4 text-center">
              <p className="text-xs text-muted-foreground">⚠️ เสี่ยงสุขภาพจิต</p>
              <p className="text-2xl font-bold text-danger">{mhRiskCounts.risk + mhRiskCounts.high}</p>
            </CardContent></Card>
          </div>

          <div className="flex gap-3 items-center">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2569, 2568, 2567].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>บุคลากร</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>ฝ่าย</TableHead>
                <TableHead>DISC</TableHead>
                <TableHead>ตำแหน่งที่เหมาะ</TableHead>
                <TableHead>เครียด</TableHead>
                <TableHead>หมดไฟ</TableHead>
                <TableHead>ยืดหยุ่น</TableHead>
                <TableHead>อารมณ์</TableHead>
                <TableHead>สัมพันธ์</TableHead>
                <TableHead>คุณค่า</TableHead>
                <TableHead>วันที่</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {allAssessments.map((a: any) => {
                  const info = DISC_LABELS[a.result_summary] || DISC_LABELS["S"];
                  const mh = a.scores?.mh || {};
                  const mhBadge = (val: number) => {
                    if (!val && val !== 0) return <span className="text-xs text-muted-foreground">-</span>;
                    const v = Number(val);
                    let color = "bg-success-soft text-success";
                    if (v > 3.5) color = "bg-danger-soft text-danger";
                    else if (v > 2.5) color = "bg-warning-soft text-warning";
                    return <Badge className={color + " text-xs"}>{v.toFixed(1)}</Badge>;
                  };
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">{getProfileName(a.user_id)}</TableCell>
                      <TableCell className="text-xs">{getProfilePosition(a.user_id)}</TableCell>
                      <TableCell className="text-xs">{getProfileDept(a.user_id)}</TableCell>
                      <TableCell><Badge className={info.color}>{a.result_summary}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[160px]">{info.suitableFor.replace("เหมาะกับ: ", "")}</TableCell>
                      <TableCell>{mhBadge(mh.stress)}</TableCell>
                      <TableCell>{mhBadge(mh.burnout)}</TableCell>
                      <TableCell>{mhBadge(mh.resilience)}</TableCell>
                      <TableCell>{mhBadge(mh.emotional)}</TableCell>
                      <TableCell>{mhBadge(mh.interpersonal)}</TableCell>
                      <TableCell>{mhBadge(mh.selfworth)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(a.created_at).toLocaleDateString("th-TH")}</TableCell>
                    </TableRow>
                  );
                })}
                {allAssessments.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">ยังไม่มีครูทำแบบประเมิน</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}
    </div>
  );
};

export default PersonnelAssessmentPage;
