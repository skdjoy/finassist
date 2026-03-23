"use client";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { BudgetForm } from "@/components/budget-form";
import { BudgetProgress } from "@/components/budget-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Budget { id: string; month: string; category: string | null; amount: number }

export default function BudgetsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [dashboardData, setDashboardData] = useState<{ byCategory: Record<string, number>; totalExpenses: number } | null>(null);

  const fetchData = useCallback(async () => {
    const [budgetRes, dashRes] = await Promise.all([fetch(`/api/budgets?month=${month}`), fetch(`/api/dashboard?month=${month}`)]);
    setBudgets(await budgetRes.json());
    setDashboardData(await dashRes.json());
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: string) {
    await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  const budgetTracking = budgets.map((b) => {
    const cat = b.category || "overall";
    const spent = cat === "overall" ? dashboardData?.totalExpenses || 0 : dashboardData?.byCategory?.[cat] || 0;
    return { category: cat, budget: Number(b.amount), spent, percentage: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0 };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader><CardTitle>Set Budget for {format(new Date(month + "-01"), "MMMM yyyy")}</CardTitle></CardHeader>
          <CardContent><BudgetForm month={month} onSaved={fetchData} /></CardContent>
        </Card>
        <BudgetProgress budgets={budgetTracking} />
        <Card>
          <CardHeader><CardTitle className="text-base">Active Budgets</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budgets.map((b) => (
                <div key={b.id} className="flex justify-between items-center py-2 border-b">
                  <span className="capitalize">{b.category || "Overall"}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">৳{Number(b.amount).toLocaleString()}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>Remove</Button>
                  </div>
                </div>
              ))}
              {budgets.length === 0 && <p className="text-sm text-gray-500">No budgets set for this month.</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
