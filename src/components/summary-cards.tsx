import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, ArrowUpDown, Target } from "lucide-react";

interface SummaryCardsProps {
  totalExpenses: number;
  totalIncome: number;
  expenseChange: number;
  budgetUtilization: number;
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const cards = [
  { key: "spent", label: "Total Spent", icon: Wallet, iconBg: "bg-red-50", iconColor: "text-red-600" },
  { key: "income", label: "Income", icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-600" },
  { key: "change", label: "vs Last Month", icon: ArrowUpDown, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { key: "budget", label: "Budget Used", icon: Target, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
];

export function SummaryCards({ totalExpenses, totalIncome, expenseChange, budgetUtilization }: SummaryCardsProps) {
  const values: Record<string, { display: string; className: string }> = {
    spent: { display: formatBDT(totalExpenses), className: "text-foreground" },
    income: { display: formatBDT(totalIncome), className: "text-green-600" },
    change: { display: `${expenseChange > 0 ? "+" : ""}${expenseChange.toFixed(1)}%`, className: expenseChange > 0 ? "text-red-500" : "text-green-600" },
    budget: { display: `${budgetUtilization.toFixed(0)}%`, className: budgetUtilization > 90 ? "text-red-500" : "text-foreground" },
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const val = values[card.key];
        return (
          <Card key={card.key} className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className={`text-2xl font-bold ${val.className}`}>{val.display}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
