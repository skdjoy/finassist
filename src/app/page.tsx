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
import { RecurringTransactions } from "@/components/recurring-transactions";
import { SpendingInsights } from "@/components/spending-insights";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { SpendingForecast } from "@/components/spending-forecast";

interface DashboardData {
  totalExpenses: number; totalIncome: number; totalWithdrawals: number;
  expenseChange: number; savingsRate: number; dailySpendingRate: number; projectedMonthEnd: number;
  typeBreakdown: Record<string, { count: number; total: number }>;
  categoryTrends: Record<string, Record<string, number>>;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; amount: number }[];
  topExpenses: { id: string; merchant: string; amount: number; category: string; date: string; source: string }[];
  budgetTracking: { category: string; budget: number; spent: number; percentage: number }[];
  incomeExpenseTrend: { month: string; income: number; expenses: number; savings: number }[];
  recurring: { merchant: string; frequency: "weekly" | "monthly" | "quarterly"; avgAmount: number; count: number; lastDate: string; nextExpectedDate: string; monthlyEstimate: number; confidence: number }[];
  insights: { type: "info" | "warning" | "alert"; message: string }[];
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
  const trendMonths = data?.incomeExpenseTrend?.map((t) => t.month) || [];
  const daysInMonth = new Date(parseInt(month.split("-")[0]), parseInt(month.split("-")[1]), 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - new Date().getDate());

  return (
    <div className="min-h-screen bg-muted/50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading || !data ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : (
          <>
            <SummaryCards
              totalExpenses={data.totalExpenses}
              totalIncome={data.totalIncome}
              expenseChange={data.expenseChange}
              savingsRate={data.savingsRate}
              dailySpendingRate={data.dailySpendingRate}
            />

            <SpendingInsights insights={data.insights} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <IncomeExpenseChart data={data.incomeExpenseTrend} />
              </div>
              <SpendingForecast
                totalExpenses={data.totalExpenses}
                projectedMonthEnd={data.projectedMonthEnd}
                dailySpendingRate={data.dailySpendingRate}
                budgetAmount={overallBudget?.budget}
                daysRemaining={daysRemaining}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategoryDonut data={data.byCategory} />
              <MerchantBarChart data={data.topMerchants} />
            </div>

            {Object.keys(data.categoryTrends).length > 0 && (
              <CategoryTrendChart categoryTrends={data.categoryTrends} months={trendMonths} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TopExpensesTable expenses={data.topExpenses} />
              <BudgetProgress budgets={data.budgetTracking} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecurringTransactions charges={data.recurring} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
