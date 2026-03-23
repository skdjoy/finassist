import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BudgetItem { category: string; budget: number; spent: number; percentage: number }

export function BudgetProgress({ budgets }: { budgets: BudgetItem[] }) {
  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Budget Tracking</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-gray-500">No budgets set. Go to Budgets to add one.</p></CardContent>
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
              <span className={b.percentage > 90 ? "text-red-500 font-medium" : ""}>
                ৳{b.spent.toLocaleString()} / ৳{b.budget.toLocaleString()}
              </span>
            </div>
            <Progress value={Math.min(b.percentage, 100)} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
