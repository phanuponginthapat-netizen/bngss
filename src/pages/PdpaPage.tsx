import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";

export const PDPA_VERSION = "1.0";
export const PDPA_EFFECTIVE_DATE = "2026-04-29";

const PdpaPage = () => {
  const { lang } = useLanguage();
  const isTh = lang === "th";

  const sections = [
    {
      title: isTh ? "1. วัตถุประสงค์ของการเก็บข้อมูล" : "1. Purpose of Data Collection",
      body: isTh
        ? "โรงเรียนเก็บรวบรวมข้อมูลส่วนบุคคลเพื่อใช้ในการบริหารจัดการการศึกษา การติดต่อสื่อสารระหว่างบุคลากร นักเรียน และผู้ปกครอง การรายงานต่อหน่วยงานต้นสังกัด (สพฐ./เขตพื้นที่การศึกษา) และการให้บริการตามภารกิจของสถานศึกษา"
        : "The school collects personal data for educational administration, communication between staff, students, and parents, reporting to authorities (OBEC/District), and providing school services.",
    },
    {
      title: isTh ? "2. ประเภทข้อมูลที่เก็บรวบรวม" : "2. Categories of Data Collected",
      body: isTh
        ? "ข้อมูลทั่วไป (ชื่อ-นามสกุล เลขประจำตัว วันเกิด เพศ เบอร์โทร อีเมล รูปถ่าย ที่อยู่) ข้อมูลทางการศึกษา (ผลการเรียน การเข้าเรียน พฤติกรรม การประเมิน) ข้อมูลทางการแพทย์ (กรุ๊ปเลือด ผู้ติดต่อฉุกเฉิน) และข้อมูลที่จำเป็นต่อการให้บริการการศึกษา"
        : "General data (name, ID, birthdate, gender, phone, email, photo, address), educational data (grades, attendance, behavior, assessments), medical info (blood type, emergency contact), and other data required for educational services.",
    },
    {
      title: isTh ? "3. ฐานทางกฎหมายในการประมวลผล" : "3. Legal Basis for Processing",
      body: isTh
        ? "การประมวลผลข้อมูลของท่านเป็นไปตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) บนฐานความยินยอม ฐานสัญญา ฐานหน้าที่ตามกฎหมาย และฐานภารกิจสาธารณะของสถานศึกษา"
        : "Data processing complies with the Thai Personal Data Protection Act B.E. 2562 (PDPA) on the basis of consent, contract, legal obligation, and public mission of the educational institution.",
    },
    {
      title: isTh ? "4. การเปิดเผยข้อมูล" : "4. Data Disclosure",
      body: isTh
        ? "ข้อมูลของท่านจะไม่ถูกเปิดเผยต่อบุคคลภายนอก ยกเว้นกรณีที่กฎหมายกำหนด หรือได้รับความยินยอมจากท่าน ข้อมูลติดต่อพื้นฐาน (ชื่อ ตำแหน่ง รูปถ่าย เบอร์โทร อีเมลที่ทำงาน) อาจปรากฏในโปรไฟล์สาธารณะที่เข้าถึงได้ผ่าน QR Code บนบัตรประจำตัว เพื่อวัตถุประสงค์ในการติดต่อทางราชการ"
        : "Your data will not be disclosed to third parties except as required by law or with your consent. Basic contact info (name, position, photo, phone, work email) may appear on the public profile accessible via the ID-card QR code for official contact purposes.",
    },
    {
      title: isTh ? "5. สิทธิของเจ้าของข้อมูล" : "5. Rights of the Data Subject",
      body: isTh
        ? "ท่านมีสิทธิ (1) เข้าถึงและขอสำเนาข้อมูล (2) แก้ไขให้ถูกต้อง (3) ขอให้ลบหรือทำลาย (4) ขอให้ระงับการใช้ (5) คัดค้านการประมวลผล (6) ขอให้โอนย้าย (7) ถอนความยินยอม โดยติดต่อผู้ดูแลข้อมูลของโรงเรียน"
        : "You have the right to (1) access and obtain a copy, (2) rectification, (3) erasure, (4) restriction of processing, (5) objection, (6) data portability, (7) withdraw consent — by contacting the school's Data Protection Officer.",
    },
    {
      title: isTh ? "6. ระยะเวลาเก็บรักษา" : "6. Retention Period",
      body: isTh
        ? "ข้อมูลจะถูกเก็บตลอดระยะเวลาที่ท่านเป็นสมาชิกของสถานศึกษา และเก็บเพิ่มเติมตามระเบียบของกระทรวงศึกษาธิการสำหรับเอกสารทางการศึกษา (เช่น ปพ.1, ปพ.3) ตามอายุการเก็บรักษาที่กฎหมายกำหนด"
        : "Data is retained while you are a member of the school and per Ministry of Education regulations for academic documents (e.g., PP.1, PP.3) for the legally required retention period.",
    },
    {
      title: isTh ? "7. มาตรการรักษาความปลอดภัย" : "7. Security Measures",
      body: isTh
        ? "ระบบใช้มาตรการทางเทคนิคและการจัดการเพื่อปกป้องข้อมูล ได้แก่ การเข้ารหัสข้อมูล (TLS) Row-Level Security (RLS) การควบคุมสิทธิ์ตามบทบาท (RBAC) การบันทึก audit log และการสำรองข้อมูลอย่างสม่ำเสมอ"
        : "Technical and organizational measures protect your data: encryption in transit (TLS), Row-Level Security (RLS), Role-Based Access Control (RBAC), audit logging, and regular backups.",
    },
    {
      title: isTh ? "8. การติดต่อผู้ควบคุมข้อมูล" : "8. Contact the Data Controller",
      body: isTh
        ? "หากมีข้อสงสัย ต้องการใช้สิทธิ หรือร้องเรียนเกี่ยวกับการประมวลผลข้อมูลส่วนบุคคล กรุณาติดต่อผู้ดูแลระบบของโรงเรียน หรือเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) ของสถานศึกษา"
        : "For questions, requests to exercise your rights, or complaints regarding personal data processing, please contact the school administrator or the Data Protection Officer (DPO).",
    },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle variant="default" />
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {isTh ? "กลับหน้าหลัก" : "Back to home"}
        </Link>

        <Card className="border-0 shadow-card-hover overflow-hidden animate-fade-in-up">
          <div className="gradient-primary p-8 text-primary-foreground">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 backdrop-blur-sm flex items-center justify-center shrink-0">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  {isTh ? "ข้อตกลงการคุ้มครองข้อมูลส่วนบุคคล (PDPA)" : "Personal Data Protection Agreement"}
                </h1>
                <p className="text-sm text-primary-foreground/80 mt-1">
                  {isTh
                    ? "พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562"
                    : "Thai Personal Data Protection Act B.E. 2562"}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-primary-foreground/85">
              <span>{isTh ? "เวอร์ชัน" : "Version"}: <strong>{PDPA_VERSION}</strong></span>
              <span>{isTh ? "วันที่มีผลบังคับใช้" : "Effective date"}: <strong>{PDPA_EFFECTIVE_DATE}</strong></span>
            </div>
          </div>

          <CardContent className="p-6 md:p-10 space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isTh
                ? "เอกสารฉบับนี้อธิบายวิธีที่สถานศึกษาเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของบุคลากร นักเรียน ผู้ปกครอง และผู้เกี่ยวข้องตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 กรุณาอ่านโดยละเอียดก่อนใช้งานระบบ"
                : "This document explains how the school collects, uses, and discloses personal data of staff, students, parents, and related parties under the Thai PDPA Act B.E. 2562. Please read carefully before using the system."}
            </p>

            {sections.map((s) => (
              <section key={s.title} className="space-y-2">
                <h2 className="text-base font-semibold text-foreground">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </section>
            ))}

            <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {isTh ? "อัปเดตล่าสุด" : "Last updated"}: {PDPA_EFFECTIVE_DATE} (v{PDPA_VERSION})
              </p>
              <Link to="/login">
                <Button className="gradient-primary text-primary-foreground">
                  {isTh ? "ไปที่หน้าเข้าสู่ระบบ" : "Go to Login"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PdpaPage;