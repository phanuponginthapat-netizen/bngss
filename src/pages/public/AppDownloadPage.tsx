import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ANDROID_APK_FILE_NAME,
  ANDROID_APK_DOWNLOAD_URL,
  ANDROID_RELEASE_PAGE_URL,
  formatReleaseDate,
  formatReleaseSize,
  useAndroidRelease,
} from "@/lib/githubRelease";

const GITHUB_REPO_URL = "https://github.com/phanuponginthapat-netizen/bngss";

export default function AppDownloadPage() {
  const { schoolLogo } = useSystemSettings();
  const { release, isLive: live, isFetching: loading, refetch } = useAndroidRelease();
  const { data: qrOk } = useQuery({
    queryKey: ["app-download-link-check"],
    queryFn: async () => {
      try {
        const res = await fetch(ANDROID_APK_DOWNLOAD_URL, {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-store",
        });
        return res.ok || res.type === "opaque";
      } catch {
        return false;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const versionLabel = release.version ? "v" + release.version : "";

  return (
    <PublicPageLayout title="ดาวน์โหลดแอป BNG Smart" description="ไฟล์ติดตั้งรุ่นล่าสุดจาก GitHub Releases">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <a href="/" className="hover:text-foreground hover:underline">
            {schoolName || "BNG Smart School"}
          </a>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">ดาวน์โหลดแอป</span>
        </div>

        <Card className="mt-4 overflow-hidden border-primary/20">
          <CardHeader className="bg-gradient-to-br from-primary/10 via-secondary/50 to-background">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border bg-background object-contain p-1.5"
                  />
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Smartphone className="h-3.5 w-3.5" />
                      สำหรับ Android
                    </Badge>
                    {versionLabel ? (
                      <Badge variant="outline" className="font-mono">
                        รุ่น {versionLabel}
                      </Badge>
                    ) : null}
                  </div>
                  <CardTitle className="mt-2 text-2xl sm:text-3xl">ดาวน์โหลดแอป BNG Smart</CardTitle>
                  <CardDescription className="mt-1 text-sm">
                    {loading ? "กำลังตรวจข้อมูล..." : "ไฟล์ติดตั้งรุ่นล่าสุดจาก GitHub Releases"}
                  </CardDescription>
                </div>
              </div>
              <div className="w-full max-w-xs">
                <Button
                  asChild
                  size="lg"
                  className="w-full gap-2 text-base shadow-lg shadow-primary/25"
                >
                  <a
                    href={ANDROID_APK_DOWNLOAD_URL}
                    download={ANDROID_APK_FILE_NAME}
                    aria-label="ดาวน์โหลด APK"
                  >
                    <Download className="h-5 w-5" />
                    ดาวน์โหลด APK
                  </a>
                </Button>
                <p className="mt-2 text-center text-xs text-muted-foreground">จาก GitHub Releases ของโรงเรียนเท่านั้น</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {release.sizeBytes ? (
                <Badge variant="outline" className="gap-1 font-normal">
                  <Info className="h-3.5 w-3.5" />
                  ขนาด {formatReleaseSize(release.sizeBytes)}
                </Badge>
              ) : null}
              {release.publishedAt ? (
                <Badge variant="outline" className="gap-1 font-normal">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  วันที่ {formatReleaseDate(release.publishedAt)}
                </Badge>
              ) : null}
              {release.notes ? (
                <span className="truncate">
                  อัปเดตล่าสุด: 
                  {release.notes}
                </span>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            {!live ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>อ่านข้อมูลจาก GitHub ไม่ได้</AlertTitle>
                <AlertDescription className="mt-1 text-sm">
                  ยังดาวน์โหลดไฟล์รุ่นล่าสุดได้ตามปกติ แต่ข้อมูลแสดงอาจเป็นค่าที่ตรวจไว้
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      disabled={loading}
                      onClick={() => refetch()}
                    >
                      <RefreshCw className={"h-4 w-4" + (loading ? " animate-spin" : "")} />
                      {loading ? "กำลังลองใหม่..." : "ลองใหม่"}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <div>
              <h2 className="text-lg font-semibold">ติดตั้งใน 4 ขั้นตอน</h2>
              <ol className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { n: 1, t: "แตะปุ่มดาวน์โหลด แล้วรอไฟล์ติดตั้งให้สำเร็จ", icon: Download },
                  { n: 2, t: "เปิดการแจ้งเตือน หรือเปิดไฟล์ที่ดาวน์โหลดล่าสุด", icon: CheckCircle2 },
                  { n: 3, t: "ก่อนติดตั้ง ระบบอาจถามอนุญาตให้ติดตั้งแอปจากแหล่างที่ไม่รู้จัก", icon: Info },
                  { n: 4, t: "เปิดแอปแล้วเข้าสู่ระบบด้วยบัญชีโรงเรียน", icon: Smartphone },
                ].map(({ n, t, icon: Icon }) => (
                  <li key={n} className="flex gap-3 rounded-lg border bg-card p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {n}
                    </span>
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm leading-relaxed">{t}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              <Card className="border-primary/20 bg-secondary/40">
                <CardContent className="flex flex-col items-center gap-2 p-4">
                  <QRCodeSVG
                    value={ANDROID_APK_DOWNLOAD_URL}
                    size={148}
                    level="M"
                    marginSize={1}
                    aria-label="สแกนจากมือถือ"
                  />
                  <p className="text-xs text-muted-foreground">สแกนจากมือถือ</p>
                </CardContent>
              </Card>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium text-foreground">แตะปุ่มสแกนในโทรศัพท์ แล้วเลือกดาวน์โหลดได้ทันที</p>
                <p>
                  {ANDROID_RELEASE_PAGE_URL.replace("https://", "")}
                </p>
                <p className="text-xs">
                  {qrOk === false
                    ? "ถ้าไฟล์หายก่อนติดตั้ง ให้กดดาวน์โหลดใหม่"
                    : "รุ่นใหม่ เผยแพร่ผ่าน GitHub Releases แล้วหน้านี้แสดงให้"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Android 7.0 ขึ้นไป</CardTitle>
                  <CardDescription className="text-sm">รองรับตั้งแต่ Android 7.0 ถึงรุ่นล่าสุด</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>ไฟล์เดียวจบ</p>
                  <p className="text-muted-foreground">ไม่ต้องต่อลิงก์ และไม่เก็บข้อมูลไว้ ภายนอก</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">แจ้งเตือนผ่านแอป</CardTitle>
                  <CardDescription className="text-sm">รับการแจ้งเตือนผ่าน Firebase โดยตรง ไม่กินโควตา LINE</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>อัปเดตได้ทันที</p>
                  <p className="text-muted-foreground">รุ่นใหม่ เผยแพร่ผ่าน GitHub Releases แล้วหน้านี้แสดงให้</p>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>ถ้าดาวน์โหลดแล้วติดตั้งไม่ได้</AlertTitle>
              <AlertDescription className="mt-1 space-y-1 text-sm">
                <p>• โทรศัพท์บางเครื่อง ต้องเปิดอนุญาตก่อน</p>
                <p>• ถ้าเคยติดตั้งรุ่นเก่าไว้ ติดตั้งทับได้ ข้อมูลไม่ได้หาย</p>
                <p>• ถ้าไฟล์หายก่อนติดตั้ง ให้กดดาวน์โหลดใหม่</p>
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <span className="text-sm font-medium">ต้องการอื่น ๆ</span>
              <Button asChild size="sm" variant="outline" className="gap-2">
                <a href="/install">iPhone / iPad หรือติดตั้งลงหน้าจอ</a>
              </Button>
              <Button asChild size="sm" variant="ghost" className="gap-2">
                <a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
                  ข้อมูลการอัปเดต (GitHub)
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button asChild size="sm" variant="link" className="gap-1 px-0">
                <a href="/login">เข้าสู่ระบบ</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicPageLayout>
  );
}
