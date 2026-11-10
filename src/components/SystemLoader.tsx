import { Loader2 } from "lucide-react";

const SystemLoader = () => {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground" role="status" aria-live="polite" aria-label="กำลังโหลดระบบ">
      <Loader2 className="w-7 h-7 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-sm">กำลังโหลดระบบ</p>
    </div>
  );
};
export default SystemLoader;
