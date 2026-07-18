import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, Wifi, AlertCircle, ChevronRight } from "lucide-react";

interface IoTDevice {
  id: string;
  name: string;
  unit: string | null;
  last_value: string | null;
  last_status: string | null;
}

export function IoTSummaryWidget() {
  const qc = useQueryClient();
  const { data: devices = [] } = useQuery({
    queryKey: ["iot-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("iot_devices")
        .select("id, name, unit, last_value, last_status")
        .eq("is_active", true)
        .order("display_order")
        .limit(6);
      if (error) throw error;
      return data as IoTDevice[];
    },
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const ch = supabase
      .channel("iot-summary-rt")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "iot_devices" },
        () => qc.invalidateQueries({ queryKey: ["iot-summary"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const online = devices.filter((d) => d.last_status === "online").length;
  const errors = devices.filter((d) => d.last_status === "error").length;

  return (
    <Card className="h-full border border-border/50 shadow-elevated rounded-2xl ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-500" /> IoT
        </CardTitle>
        <Link to="/dashboard/iot" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center">
          ดูทั้งหมด <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <Wifi className="h-3 w-3 text-emerald-500" /> ออนไลน์ {online}
          </Badge>
          {errors > 0 && (
            <Badge variant="outline" className="gap-1 text-rose-600 border-rose-500/30">
              <AlertCircle className="h-3 w-3" /> ผิดพลาด {errors}
            </Badge>
          )}
          <span className="text-muted-foreground">ทั้งหมด {devices.length}</span>
        </div>

        {devices.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            ยังไม่มีอุปกรณ์ — <Link to="/dashboard/iot/devices" className="underline">เพิ่มอุปกรณ์</Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {devices.slice(0, 4).map((d) => (
              <div key={d.id} className="rounded-lg border bg-muted/30 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground truncate">{d.name}</p>
                <p className="text-base font-bold">
                  {d.last_value ?? "—"}
                  {d.unit && <span className="text-xs text-muted-foreground ml-1">{d.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IoTSummaryWidget;