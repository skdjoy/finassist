import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingUp, ArrowUpDown, PiggyBank, CalendarClock } from "lucide-react";

interface SummaryCardsProps {
  totalExpenses: number;
  totalIncome: number;
  expenseChange: number;
  savingsRate: number;
  dailySpendingRate: number;
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const cards = [
  { key: "spent", label: "Total Spent", icon: Wallet, iconBg: "bg-red-50", iconColor: "text-red-600" },
  { key: "income", label: "Income", icon: TrendingUp, iconBg: "bg-green-50", iconColor: "text-green-600" },
  { key: "change", label: "vs Last Month", icon: ArrowUpDown, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  { key: "savings", label: "Savings Rate", icon: PiggyBank, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  { key: "daily", label: "Daily Average", icon: CalendarClock, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
];

export function SummaryCards({ totalExpenses, totalIncome, expenseChange, savingsRate, dailySpendingRate }: SummaryCardsProps) {
  const values: Record<string, { display: string; className: string; subtitle?: string }> = {
    spent: { display: formatBDT(totalExpenses), className: "text-foreground" },
    income: { display: formatBDT(totalIncome), className: "text-green-600" },
    change: {
      display: `${expenseChange > 0 ? "+" : ""}${expenseChange.toFixed(1)}%`,
      className: expenseChange > 0 ? "text-red-500" : "text-green-600",
    },
    savings: {
      display: `${savingsRate.toFixed(0)}%`,
      className: savingsRate >= 20 ? "text-emerald-600" : savingsRate > 0 ? "text-amber-600" : "text-red-500",
      subtitle: savingsRate >= 20 ? "Healthy" : savingsRate > 0 ? "Low" : "Deficit",
    },
    daily: {
      display: formatBDT(Math.round(dailySpendingRate)),
      className: "text-foreground",
      subtitle: "per day",
    },
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const val = values[card.key];
        return (
          <Card key={card.key} className="shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`text-xl font-bold ${val.className}`}>{val.display}</p>
                  {val.subtitle && <p className="text-xs text-muted-foreground">{val.subtitle}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
