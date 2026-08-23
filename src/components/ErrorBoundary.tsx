import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Copy, Home } from "lucide-react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Optional label to identify which boundary failed (for logging) */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
  errorInfo: ErrorInfo | null;
}

function genErrorId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof (crypto as unknown as { randomUUID?: () => string }).randomUUID === "function") {
      return (crypto as unknown as { randomUUID: () => string }).randomUUID().slice(0, 8).toUpperCase();
    }
  } catch {}
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/**
 * ErrorBoundary — ป้องกัน blank screen
 * - catch render/lifecycle errors
 * - log to console + supabase (error_logs) gracefully
 * - show user-friendly fallback with "รีโหลด" button + error ID
 * ใช้ wrap ทั้งแอป (App.tsx) และแต่ละ section เพื่อ isolate error
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorId: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Auto-reload once on chunk load failure after deploy (Vercel old chunk 404)
    const msg = String(error?.message || "");
    const isChunkError = /Loading chunk.*failed|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed/i.test(msg);
    if (isChunkError) {
      try {
        const key = "chunk_reload_" + location.pathname;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          location.reload();
          return { hasError: false, error: null, errorId: null, errorInfo: null };
        }
      } catch {}
    }
    return { hasError: true, error, errorId: genErrorId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const errorId = this.state.errorId ?? genErrorId();
    // Ensure state has errorId + info even if getDerivedState ran earlier without it
    if (!this.state.errorId || !this.state.errorInfo) {
      this.setState({ errorId, errorInfo: info });
    }

    // 1) console — always
    console.error(`[ErrorBoundary:${errorId}]${this.props.label ? ` [${this.props.label}]` : ""}`, error, info);

    // 2) supabase error_logs via logError (handles missing table gracefully)
    try {
      logError(error.message || "react-error-boundary", {
        stack: error.stack,
        componentStack: info.componentStack ?? undefined,
        source: this.props.label ? `react-error-boundary:${this.props.label}` : "react-error-boundary",
        context: { errorId, label: this.props.label } as unknown as Record<string, unknown>,
      });
    } catch (e) {
      console.warn("[ErrorBoundary] logError failed", e);
    }

    // Also attempt direct supabase insert with errorId as fallback if logError swallows table-missing
    // (logError already does this; keep try/catch to never throw from boundary)
  }

  reset = () => this.setState({ hasError: false, error: null, errorId: null, errorInfo: null });

  handleCopyId = async () => {
    const id = this.state.errorId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // fallback
      try {
        const el = document.createElement("input");
        el.value = id;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      } catch {}
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const errorId = this.state.errorId ?? "—";
      const message = this.state.error?.message || "ไม่สามารถแสดงเนื้อหาได้";

      // Prevent blank screen — always render a visible fallback
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-destructive/40 shadow-lg">
            <CardContent className="p-6 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">เกิดข้อผิดพลาดในส่วนนี้</h3>
                <p className="text-sm text-muted-foreground break-words">
                  {message}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                  <span>รหัสข้อผิดพลาด: <span className="font-mono font-semibold text-foreground">{errorId}</span></span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={this.handleCopyId} aria-label="คัดลอกรหัส">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">กรุณาแจ้งรหัสนี้ให้ผู้ดูแลระบบเพื่อตรวจสอบ (ดู log ใน error_logs)</p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={this.reset} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" /> ลองใหม่
                </Button>
                <Button onClick={() => window.location.reload()} size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" /> รีโหลด
                </Button>
                <Button onClick={() => (window.location.href = "/")} variant="secondary" size="sm">
                  <Home className="h-4 w-4 mr-2" /> หน้าแรก
                </Button>
              </div>

              {this.state.error?.stack && (
                <details className="text-left mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer select-none">รายละเอียดสำหรับผู้ดูแล</summary>
                  <pre className="mt-2 text-xs bg-muted p-3 rounded-md overflow-auto max-h-40 whitespace-pre-wrap break-words">
                    {this.state.error.stack.slice(0, 3000)}
                    {this.state.errorInfo?.componentStack ? `\n\nComponent stack:${this.state.errorInfo.componentStack.slice(0, 2000)}` : ""}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
