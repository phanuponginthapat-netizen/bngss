import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  BadgeCheck,
  Download,
  ExternalLink,
  QrCode,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import {
  ANDROID_APK_DOWNLOAD_URL,
  ANDROID_RELEASE_PAGE_URL,
  formatReleaseDate,
  formatReleaseSize,
  useAndroidRelease,
} from "@/lib/githubRelease";

const STEPS = [
  "แตะปุม ดาวนโหลด APK ดานบน แลวรอไฟลต์ิิดตังใหเสร็จ",
  "เปดแจงเตือนหรอโฟลเดอรด์านโหลด แลวแตะไฟลบngss-app.apk",
  'กอนติดตัง ระบบอาจถามให้อนุญาต "ติดตังแอปจากแหลงที้ไมรจูัก" — เลือก อนุญาต',
  "เปดแอปแลวเขาสู่ระบบดวยบัญชีโรงเรียน",
];

const FACTS = [
  { title: "Android 7.0 ข้ึนไป", detail: "รองรบัต้งแต่ Android 7.0 ถืงรุนล่าสุด" },
  { title: "ไฟลเ์ดียวจบ", detail: "ไมตองตอกลิงก และไมเกบขอมูลไวในเซิรฟรภายนอก" },
  { title: "แจงเตือนผานแอป", detail: "ร บแจงเตือนผาน Firebase โดยตรง ไมเกนโควตา LINE" },
  { title: "อัปเดตไดท นที", detail: "รุนใหมเผยแพรผาน GitHub Releases แลวหนานี้แสดงใหอตนมัต" },
];

export default function AppDownloadPage() {
  const s = useSystemSettings();
  const { release, isLive, isFetching, refetch } = useAndroidRelease();
  const schoolName = s.schoolName || "โรงเรียน";
  const logo = s.schoolLogo;

  return (
    <PublicPageLayout
      title="ดาวนโหลดแอป BNG Smart"
      subtitle="ไฟลติดตังสำหรบเครื่อง Android (APK) รุนล่าสุดจาก GitHub Releases"
      breadcrumbs={[{ label: "ดาวนโหลดแอป" }]}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  {logo ? (
                    <img src={logo} alt={schoolName} className="h-full w-full object-contain" />
                  ) : (
                    <Smartphone className="h-8 w-8" />
                  )}
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl sm:text-2xl">
                    แอป {s.appShortName || schoolName}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    เขาดูคะแนน การเชคชื่อ แจงเตือน และงานตาง ๆ ไดจากมือถือ
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {release.version ? (
                  <Badge className="gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    รุน {release.version}
                  </Badge>
                ) : (
                  <Badge variant="secondary">รอขอมูลเวอร์ชัน</Badge>
                )}
                <Badge variant="outline">{formatReleaseSize(release.sizeBytes)}</Badge>
                <Badge variant="outline">อัปเดตเมื่อ {formatReleaseDate(release.publishedAt)}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <a href={ANDROID_APK_DOWNLOAD_URL} download={release.fileName} className="block">
                <Button size="lg" className="w-full gap-2 text-base">
                  <Download className="h-5 w-5" />
                  ดาวนโหลด APK {release.version ? `(รุน ${release.version})` : ""}
                </Button>
              </a>

              <p className="text-center text-xs text-muted-foreground">
                ไฟลบngss-app.apk · {formatReleaseSize(release.sizeBytes)} · มาจาก GitHub Releases
                ของโรงเรียนเทานั้ น
              </p>

              {release.notes && (
                <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
                  อัปเดตล่าสุด: {release.notes}
                </p>
              )}

              {!isLive && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>อานขอมูลเวอร์ชันลสดุจาก GitHub ไมได</AlertTitle>
                  <AlertDescription className="text-xs">
                    หนานี้ยังดาวนโหลดไฟลรุนลสดุไดตามปกต แตขอมูลที้แสดงอาจเปนคาที้ตรวจไว
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 gap-1.5"
                      onClick={() => refetch()}
                      disabled={isFetching}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {isFetching ? "กำลังลองใหม..." : "ลองใหม"}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <div className="text-sm font-semibold text-foreground">ติดตังใน 4 ขั้ นตอน</div>
                <ol className="space-y-2">
                  {STEPS.map((step, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Badge variant="outline" className="shrink-0">
                        {i + 1}
                      </Badge>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-5 w-5 text-primary" />
                  สแกนจากมือถือ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-center">
                <div className="mx-auto flex w-fit rounded-2xl bg-background p-3 ring-1 ring-border">
                  <QRCodeSVG value={ANDROID_APK_DOWNLOAD_URL} size={168} />
                </div>
                <p className="text-xs text-muted-foreground">
                  แตะปุมสแกนในโทรศัพท แลวเลอกดาวนโหลดไฟลไดทันท
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">ตองการอืน ๆ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <a href={ANDROID_RELEASE_PAGE_URL} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    ขอมูลการอัปเดต (GitHub)
                  </a>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start gap-2">
                  <a href="/install">
                    <Smartphone className="h-4 w-4" />
                    iPhone / iPad หรอติดตังลงหนาจอ
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f) => (
            <Card key={f.title}>
              <CardContent className="pt-6">
                <div className="text-sm font-semibold text-foreground">{f.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">{f.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">ถาดาวนโหลดแลวติดตังไมได</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>
              • โฟน/แท็บเลตบางรนุ ตองเปดอนุญาต ติดตังแอปจากแหลงที้ไมรจูัก กอน (ในหนาตังคา
              ความปลอดภ ัย)
            </p>
            <p>• ถาเคยติดตังรนุ เกาไว แตะติดตังทบทับไดเลย ขอมูลในแอปไมหาย</p>
            <p>• ถาไฟลหายกอนติดตัง ใหกดดาวนโหลดใหม</p>
          </AlertDescription>
        </Alert>
      </div>
    </PublicPageLayout>
  );
}
