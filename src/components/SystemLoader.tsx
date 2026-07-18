import { useSystemSettings } from "@/hooks/useSystemSettings";
import { GraduationCap } from "lucide-react";

const SystemLoader = () => {
  const { appName, schoolName, schoolLogo } = useSystemSettings();
  const title = schoolName || appName || "Smart School";

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-primary via-secondary to-accent px-4">
      <div className="bg-white/15 backdrop-blur-xl border border-white/25 rounded-3xl px-10 py-9 flex flex-col items-center gap-5 shadow-2xl max-w-sm w-full">
        {schoolLogo ? (
          <img src={schoolLogo} alt={title} className="w-20 h-20 object-contain drop-shadow-lg" />
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center overflow-hidden shadow-lg ring-1 ring-white/30">
            <GraduationCap className="w-8 h-8 text-white" strokeWidth={1.75} />
          </div>
        )}

        <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />

        <div className="text-center">
          <div className="text-white text-base font-semibold tracking-wide line-clamp-2">
            {title}
          </div>
          <div className="text-white/85 text-sm mt-1 flex items-center justify-center">
            กำลังโหลดระบบ
            <span className="inline-flex gap-1 ml-1.5">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemLoader;
