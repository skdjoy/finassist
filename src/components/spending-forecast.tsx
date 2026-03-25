"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface SpendingForecastProps {
  totalExpenses: number;
  projectedMonthEnd: number;
  dailySpendingRate: number;
  budgetAmount?: number;
  daysRemaining: number;
}

export function SpendingForecast({ totalExpenses, projectedMonthEnd, dailySpendingRate, budgetAmount, daysRemaining }: SpendingForecastProps) {
  const projectedRemaining = dailySpendingRate * daysRemaining;
  const budgetTarget = budgetAmount || projectedMonthEnd;
  const progressPct = Math.min(100, (totalExpenses / budgetTarget) * 100);
  const onTrack = budgetAmount ? projectedMonthEnd <= budgetAmount : true;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-base">Spending Forecast</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Spent so far</span>
            <span className="font-semibold">৳{totalExpenses.toLocaleString()}</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Projected month-end</p>
            <p className={`text-lg font-bold ${onTrack ? "text-foreground" : "text-red-500"}`}>
              ৳{Math.round(projectedMonthEnd).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Remaining ({daysRemaining}d)</p>
            <p className="text-lg font-bold text-muted-foreground">
              ~৳{Math.round(projectedRemaining).toLocaleString()}
            </p>
          </div>
        </div>

        {budgetAmount && (
          <div className="pt-2 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget target</span>
              <span className="font-medium">৳{budgetAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Projected vs budget</span>
              <span className={`font-medium ${onTrack ? "text-green-600" : "text-red-500"}`}>
                {onTrack ? "On track" : `Over by ৳${Math.round(projectedMonthEnd - budgetAmount).toLocaleString()}`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
