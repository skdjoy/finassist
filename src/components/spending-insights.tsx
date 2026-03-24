import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Insight } from "@/lib/insights";

const ICONS = {
  info: { icon: Info, bg: "bg-blue-50", text: "text-blue-600" },
  warning: { icon: AlertTriangle, bg: "bg-amber-50", text: "text-amber-600" },
  alert: { icon: AlertCircle, bg: "bg-red-50", text: "text-red-600" },
};

export function SpendingInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Insights</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, i) => {
            const config = ICONS[insight.type];
            const Icon = config.icon;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg ${config.bg} flex-shrink-0`}>
                  <Icon className={`h-4 w-4 ${config.text}`} />
                </div>
                <p className="text-sm">{insight.message}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
