import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  SUBJECT_GROUPS,
  GRADE_BANDS,
  QUALITATIVE_LEVELS,
  ACTIVITY_RESULT,
  DESIRABLE_CHARACTERISTICS,
  KEY_COMPETENCIES,
  READ_THINK_WRITE_STANDARDS,
  PP_DOCUMENTS,
  SDQ_CUTOFFS,
  SMSC_STANDARDS,
  GRADE_LEVELS,
  OBEC_VERSION,
  buildSubjectCode,
} from "@/lib/obecStandards";
import { BookOpen, GraduationCap, FileText, HeartHandshake, Brain, ShieldCheck, Hash } from "lucide-react";

export default function ObecStandardsPage() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-7xl">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          มาตรฐานอ้างอิง สพฐ. ที่ใช้ในระบบ
        </h1>
        <p className="text-muted-foreground text-sm">
          เนื้อหา/เกณฑ์ทุกหน้า (วิชา · เกรด · ปพ. · คุณลักษณะ · SDQ · สมศ.) อ้างอิงจากเอกสารชุดนี้
          อัปเดตล่าสุด พ.ศ. {OBEC_VERSION.lastUpdated}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="secondary">{OBEC_VERSION.curriculum}</Badge>
          <Badge variant="secondary">{OBEC_VERSION.ppRegulation}</Badge>
          <Badge variant="secondary">{OBEC_VERSION.sdqSource}</Badge>
          <Badge variant="secondary">{OBEC_VERSION.smscRound}</Badge>
        </div>
      </div>

      <Tabs defaultValue="subjects" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="subjects"><BookOpen className="h-4 w-4 mr-1" />กลุ่มสาระ</TabsTrigger>
          <TabsTrigger value="codes"><Hash className="h-4 w-4 mr-1" />รหัสวิชา</TabsTrigger>
          <TabsTrigger value="grades"><GraduationCap className="h-4 w-4 mr-1" />เกรด</TabsTrigger>
          <TabsTrigger value="character"><HeartHandshake className="h-4 w-4 mr-1" />คุณลักษณะ</TabsTrigger>
          <TabsTrigger value="competency"><Brain className="h-4 w-4 mr-1" />สมรรถนะ</TabsTrigger>
          <TabsTrigger value="pp"><FileText className="h-4 w-4 mr-1" />ปพ.1-8</TabsTrigger>
          <TabsTrigger value="sdq">SDQ</TabsTrigger>
          <TabsTrigger value="smsc">สมศ.</TabsTrigger>
        </TabsList>

        {/* กลุ่มสาระ */}
        <TabsContent value="subjects" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>8 กลุ่มสาระการเรียนรู้</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                {SUBJECT_GROUPS.map((s) => (
                  <div key={s.key} className={`rounded-lg p-4 ${s.color}`}>
                    <div className="text-3xl font-bold">{s.code}</div>
                    <div className="font-semibold mt-1">{s.name}</div>
                    <div className="text-xs opacity-70">{s.nameEn}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* รหัสวิชา */}
        <TabsContent value="codes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>โครงสร้างรหัสวิชา สพฐ.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-4 font-mono text-center text-lg">
                [อักษรกลุ่มสาระ] [ระดับชั้น 2 หลัก] [ภาคเรียน] [ลำดับวิชา 2 หลัก]
              </div>
              <p className="text-sm text-muted-foreground">
                ป.1=11 … ป.6=16, ม.1=21 … ม.6=26 · พื้นฐานเริ่มลำดับ 01 · เพิ่มเติมเริ่ม 21
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ตัวอย่าง</TableHead>
                    <TableHead>ความหมาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { code: buildSubjectCode("thai", 1, 1, 1), desc: "ภาษาไทย ป.1 ภาคเรียนที่ 1 พื้นฐาน วิชาที่ 1" },
                    { code: buildSubjectCode("math", 1, 1, 1), desc: "คณิตศาสตร์ ป.1 ภาคเรียนที่ 1 พื้นฐาน วิชาที่ 1" },
                    { code: buildSubjectCode("science", 4, 2, 1), desc: "วิทยาศาสตร์ ป.4 ภาคเรียนที่ 2 พื้นฐาน วิชาที่ 1" },
                    { code: buildSubjectCode("foreign", 7, 1, 1), desc: "ภาษาต่างประเทศ ม.1 ภาคเรียนที่ 1 พื้นฐาน วิชาที่ 1" },
                    { code: buildSubjectCode("math", 10, 1, 1, "เพิ่มเติม"), desc: "คณิตศาสตร์ ม.4 ภาคเรียนที่ 1 เพิ่มเติม วิชาที่ 1" },
                  ].map((x) => (
                    <TableRow key={x.code}>
                      <TableCell className="font-mono font-bold">{x.code}</TableCell>
                      <TableCell>{x.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div>
                <div className="text-sm font-medium mb-2">ระดับชั้นที่รองรับ</div>
                <div className="flex flex-wrap gap-2">
                  {GRADE_LEVELS.map((g) => (
                    <Badge key={g.value} variant="outline">{g.label}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* เกรด */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>เกณฑ์ระดับผลการเรียน 8 ระดับ (รายวิชา)</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ระดับ</TableHead>
                    <TableHead>คะแนน (%)</TableHead>
                    <TableHead>ค่าระดับ</TableHead>
                    <TableHead>ความหมาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GRADE_BANDS.map((g) => (
                    <TableRow key={g.grade}>
                      <TableCell className="font-bold text-lg">{g.grade}</TableCell>
                      <TableCell>{g.minPercent === 0 ? "ต่ำกว่า 50" : `${g.minPercent} ขึ้นไป`}</TableCell>
                      <TableCell>{g.point.toFixed(1)}</TableCell>
                      <TableCell>{g.meaning}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">ผลการประเมินเชิงคุณภาพ (คุณลักษณะ / อ่านคิดวิเคราะห์)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {QUALITATIVE_LEVELS.map((q) => (
                  <div key={q.code} className="flex items-center justify-between">
                    <Badge variant="outline" className="font-bold">{q.code}</Badge>
                    <span>{q.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">ผลกิจกรรมพัฒนาผู้เรียน</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {ACTIVITY_RESULT.map((q) => (
                  <div key={q.code} className="flex items-center justify-between">
                    <Badge variant="outline" className="font-bold">{q.code}</Badge>
                    <span>{q.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* คุณลักษณะ */}
        <TabsContent value="character" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>คุณลักษณะอันพึงประสงค์ 8 ข้อ</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-3">
                {DESIRABLE_CHARACTERISTICS.map((c) => (
                  <div key={c.no} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground font-bold">
                      {c.no}
                    </div>
                    <div className="font-medium pt-1">{c.name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>การประเมินอ่าน คิดวิเคราะห์ และเขียน (5 มาตรฐาน)</CardTitle></CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                {READ_THINK_WRITE_STANDARDS.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* สมรรถนะ */}
        <TabsContent value="competency">
          <Card>
            <CardHeader><CardTitle>สมรรถนะสำคัญของผู้เรียน 5 ด้าน</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {KEY_COMPETENCIES.map((c) => (
                  <div key={c.no} className="p-4 rounded-lg border bg-card">
                    <div className="text-sm text-muted-foreground">สมรรถนะที่ {c.no}</div>
                    <div className="font-semibold mt-1">{c.name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ปพ. */}
        <TabsContent value="pp">
          <Card>
            <CardHeader><CardTitle>เอกสารหลักฐานการศึกษา ปพ.1 – ปพ.8</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>รหัส</TableHead>
                    <TableHead>ชื่อเอกสาร</TableHead>
                    <TableHead>วัตถุประสงค์</TableHead>
                    <TableHead>ประเภท</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PP_DOCUMENTS.map((d) => (
                    <TableRow key={d.code}>
                      <TableCell className="font-bold">{d.code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.name}</div>
                        {d.variants && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {d.variants.map((v) => <Badge key={v} variant="outline" className="text-xs">{v}</Badge>)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{d.purpose}</TableCell>
                      <TableCell>
                        {d.isOfficial
                          ? <Badge>ทางการ</Badge>
                          : <Badge variant="secondary">ภายในสถานศึกษา</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SDQ */}
        <TabsContent value="sdq">
          <Card>
            <CardHeader>
              <CardTitle>เกณฑ์ SDQ — กรมสุขภาพจิต (ฉบับ 25 ข้อ)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                คะแนน Total Difficulties = อารมณ์ + ความประพฤติ + สมาธิ/ไฮเปอร์ + เพื่อน (0–40) ·
                Prosocial เป็นด้านสังคม (0–10) คะแนนสูง = ดี
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ผู้ประเมิน</TableHead>
                    <TableHead>Total — ปกติ</TableHead>
                    <TableHead>Total — เสี่ยง</TableHead>
                    <TableHead>Total — มีปัญหา</TableHead>
                    <TableHead>Prosocial — ปกติ</TableHead>
                    <TableHead>Prosocial — เสี่ยง</TableHead>
                    <TableHead>Prosocial — มีปัญหา</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.keys(SDQ_CUTOFFS) as Array<keyof typeof SDQ_CUTOFFS>).map((k) => {
                    const c = SDQ_CUTOFFS[k];
                    const label = k === "self" ? "นักเรียน (11–16 ปี)" : k === "parent" ? "ผู้ปกครอง" : "ครู";
                    return (
                      <TableRow key={k}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell>0 – {c.totalDifficulties.normalMax}</TableCell>
                        <TableCell>{c.totalDifficulties.normalMax + 1} – {c.totalDifficulties.riskMax}</TableCell>
                        <TableCell>{c.totalDifficulties.riskMax + 1} – 40</TableCell>
                        <TableCell>{c.prosocial.normalMin} – 10</TableCell>
                        <TableCell>{c.prosocial.riskValue}</TableCell>
                        <TableCell>0 – {c.prosocial.riskValue - 1}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* สมศ. */}
        <TabsContent value="smsc" className="space-y-4">
          {SMSC_STANDARDS.map((s) => (
            <Card key={s.no}>
              <CardHeader>
                <CardTitle>
                  มาตรฐานที่ {s.no} — {s.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  {s.indicators.map((i, idx) => <li key={idx}>{i}</li>)}
                </ol>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
