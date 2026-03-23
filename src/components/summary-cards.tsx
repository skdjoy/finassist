import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardsProps {
  totalExpenses: number;
  totalIncome: number;
  expenseChange: number;
  budgetUtilization: number;
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function SummaryCards({ totalExpenses, totalIncome, expenseChange, budgetUtilization }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Total Spent</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold">{formatBDT(totalExpenses)}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Income</CardTitle></CardHeader>
        <CardContent><p className="text-2xl font-bold text-green-600">{formatBDT(totalIncome)}</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">vs Last Month</CardTitle></CardHeader>
        <CardContent><p className={`text-2xl font-bold ${expenseChange > 0 ? "text-red-500" : "text-green-600"}`}>{expenseChange > 0 ? "+" : ""}{expenseChange.toFixed(1)}%</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-500">Budget Used</CardTitle></CardHeader>
        <CardContent><p className={`text-2xl font-bold ${budgetUtilization > 90 ? "text-red-500" : "text-gray-900"}`}>{budgetUtilization.toFixed(0)}%</p></CardContent>
      </Card>
    </div>
  );
}
