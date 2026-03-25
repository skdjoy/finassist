import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TopExpense { id: string; merchant: string | null; amount: number; category: string; date: string; source: string }

export function TopExpensesTable({ expenses }: { expenses: TopExpense[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="text-base">Top Expenses</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{e.merchant || "Unknown"}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(e.date), "MMM d")} &middot; <Badge variant="outline" className="text-xs">{e.category}</Badge></p>
              </div>
              <p className="font-semibold">৳{e.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
