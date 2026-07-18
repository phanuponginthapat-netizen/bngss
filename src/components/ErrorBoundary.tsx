import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary — แสดง fallback แทนที่จะให้ทั้งแอปพัง
 * ใช้ wrap แต่ละหน้า/section เพื่อ isolate error
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    logError(error.message, {
      stack: error.stack,
      componentStack: info.componentStack ?? undefined,
      source: "react-error-boundary",
    });
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <Card className="m-4 border-destructive/40">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
            <div>
              <h3 className="font-semibold text-lg">เกิดข้อผิดพลาดในส่วนนี้</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {this.state.error?.message || "ไม่สามารถแสดงเนื้อหาได้"}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={this.reset} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" /> ลองใหม่
              </Button>
              <Button onClick={() => window.location.reload()} size="sm">
                รีเฟรชหน้า
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
