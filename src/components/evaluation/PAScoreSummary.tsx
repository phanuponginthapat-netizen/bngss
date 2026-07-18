import { Card, CardContent } from "@/components/ui/card";

interface Props {
  totalAvg: number;
  resultLevel: { label: string; color: string };
  domainAvgs: { domain: number; avg: number }[];
}

export default function PAScoreSummary({ totalAvg, resultLevel, domainAvgs }: Props) {
  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground">คะแนนเฉลี่ยรวม</p>
            <p className={`text-4xl font-bold ${resultLevel.color}`}>{totalAvg.toFixed(2)}</p>
            <p className={`text-sm font-semibold ${resultLevel.color}`}>ระดับ: {resultLevel.label}</p>
          </div>
          <div className="flex gap-4">
            {domainAvgs.map(d => (
              <div key={d.domain} className="text-center">
                <p className="text-xs text-muted-foreground">ด้านที่ {d.domain}</p>
                <p className="text-xl font-bold">{d.avg.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
