import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseScannerRelease } from "@/lib/scannerRelease";
import { fetchAppDownloadsJson } from "@/lib/storageUrl";

const PRODUCTS = ["android", "scanner", "facegate", "ios"] as const;

type Release = { product: string; title: string; version: string; releasedAt: string; files: { name: string; url: string; sizeBytes: number }[] };

/** ลิงก์ดาวน์โหลดรุ่นล่าสุดจาก GitHub Releases (งานสร้างเขียน release-<product>.json ไว้) */
export default function GithubReleaseDownloads() {
  const { data = [] } = useQuery({
    queryKey: ["github-releases"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const all = await Promise.all(PRODUCTS.map(async (p) => {
        const release = await fetchAppDownloadsJson<Release>(`release-${p}.json`);
        if (!release) return null;
        if (p === "scanner" && !parseScannerRelease(release)) return null;
        return release;
      }));
      return all.filter(Boolean) as Release[];
    },
  });
  if (!data.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Download className="h-5 w-5" /> ดาวน์โหลดรุ่นล่าสุด (GitHub Releases)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((r) => r.files.map((f) => (
          <div key={f.url} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                รุ่น {r.version} · {(f.sizeBytes / 1048576).toFixed(1)} MB · {new Date(r.releasedAt).toLocaleDateString("th-TH")}
              </div>
            </div>
            <Button asChild size="sm"><a href={f.url} rel="noreferrer">ดาวน์โหลด</a></Button>
          </div>
        )))}
      </CardContent>
    </Card>
  );
}
