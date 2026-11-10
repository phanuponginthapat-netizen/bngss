import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

export function AcademicReadNotice({ error, loading, onRetry }: {
  error?: unknown;
  loading: boolean;
  onRetry: () => void;
}) {
  if (!error && !loading) return null;
  return (
    <div role={error ? "alert" : "status"} className="flex flex-wrap items-center gap-3 border border-border rounded-lg p-4 bg-muted/30">
      {error ? <AlertCircle className="h-5 w-5 text-destructive" /> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      <div className="flex-1 min-w-0 text-sm">
        {error ? "โหลดข้อมูลไม่สำเร็จ ไม่สามารถยืนยันข้อมูลได้ในขณะนี้" : "กำลังโหลดข้อมูล..."}
      </div>
      {Boolean(error) && <Button variant="outline" size="sm" disabled={loading} onClick={onRetry}><RefreshCw className="h-4 w-4 mr-2" />ลองใหม่</Button>}
    </div>
  );
}