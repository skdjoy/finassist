import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PiggyBank } from "lucide-react";
import Link from "next/link";

interface BudgetItem { category: string; budget: number; spent: number; percentage: number }

export function BudgetProgress({ budgets, showLink = true }: { budgets: BudgetItem[]; showLink?: boolean }) {
  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Budget Tracking</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <PiggyBank className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No budgets set for this month.</p>
            {showLink && <Link href="/budgets" className="text-sm text-primary mt-1 hover:underline">Set up a budget</Link>}
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Budget Tracking</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {budgets.map((b) => (
          <div key={b.category}>
            <div className="flex justify-between text-sm mb-1">
              <span className="capitalize">{b.category}</span>
              <span className={b.percentage > 90 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                ৳{b.spent.toLocaleString()} / ৳{b.budget.toLocaleString()}
              </span>
            </div>
            <Progress value={Math.min(b.percentage, 100)} className={`h-2 ${b.percentage > 90 ? "[&>div]:bg-red-500" : b.percentage > 75 ? "[&>div]:bg-amber-500" : ""}`} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
