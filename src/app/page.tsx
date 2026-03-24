"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { SummaryCards } from "@/components/summary-cards";
import { IncomeExpenseChart } from "@/components/income-expense-chart";
import { CategoryDonut } from "@/components/category-donut";
import { MerchantBarChart } from "@/components/merchant-bar-chart";
import { TopExpensesTable } from "@/components/top-expenses-table";
import { BudgetProgress } from "@/components/budget-progress";

interface DashboardData {
  totalExpenses: number; totalIncome: number; expenseChange: number;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; amount: number }[];
  topExpenses: { id: string; merchant: string; amount: number; category: string; date: string; source: string }[];
  budgetTracking: { category: string; budget: number; spent: number; percentage: number }[];
  incomeExpenseTrend: { month: string; income: number; expenses: number }[];
}

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?month=${month}`)
      .then((res) => res.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [month]);

  const overallBudget = data?.budgetTracking?.find((b) => b.category === "overall");
  const budgetUtilization = overallBudget?.percentage || 0;

  return (
    <div className="min-h-screen bg-muted/50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading || !data ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <SummaryCards totalExpenses={data.totalExpenses} totalIncome={data.totalIncome}
              expenseChange={data.expenseChange} budgetUtilization={budgetUtilization} />
            <IncomeExpenseChart data={data.incomeExpenseTrend} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategoryDonut data={data.byCategory} />
              <MerchantBarChart data={data.topMerchants} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopExpensesTable expenses={data.topExpenses} />
              <BudgetProgress budgets={data.budgetTracking} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
