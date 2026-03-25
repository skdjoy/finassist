"use client";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface Insight { type: "info" | "warning" | "alert"; message: string }

const ICONS = { info: Info, warning: AlertTriangle, alert: AlertCircle };
const STYLES = {
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/10",
  warning: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
  alert: "bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-500/10",
};

export function SpendingInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {insights.map((insight, i) => {
        const Icon = ICONS[insight.type];
        return (
          <div key={i} className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${STYLES[insight.type]}`}>
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-snug">{insight.message}</p>
          </div>
        );
      })}
    </div>
  );
}
