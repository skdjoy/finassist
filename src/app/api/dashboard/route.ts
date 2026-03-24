import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 1).toISOString();
  const trendStart = new Date(year, mon - 6, 1).toISOString();
  const prevStart = new Date(year, mon - 2, 1).toISOString();
  const prevEnd = startDate;

  const { data: linkedRows } = await supabase
    .from("transaction_groups").select("linked_transaction_id");
  const linkedIds = new Set((linkedRows || []).map((r) => r.linked_transaction_id));

  const { data: transactions } = await supabase
    .from("transactions").select("*")
    .gte("transaction_date", startDate).lt("transaction_date", endDate);
  const filtered = (transactions || []).filter((t) => !linkedIds.has(t.id));

  const { data: prevTransactions } = await supabase
    .from("transactions").select("amount, type, id")
    .gte("transaction_date", prevStart).lt("transaction_date", prevEnd);
  const prevFiltered = (prevTransactions || []).filter((t) => !linkedIds.has(t.id));

  // 6-month trend
  const { data: trendTransactions } = await supabase
    .from("transactions").select("amount, type, transaction_date, id")
    .gte("transaction_date", trendStart).lt("transaction_date", endDate);
  const trendFiltered = (trendTransactions || []).filter((t) => !linkedIds.has(t.id));
  // Pre-fill all 6 months so chart always shows complete range
  const monthlyTrend: Record<string, { income: number; expenses: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, mon - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrend[key] = { income: 0, expenses: 0 };
  }
  for (const t of trendFiltered) {
    const m = t.transaction_date.slice(0, 7);
    if (!monthlyTrend[m]) monthlyTrend[m] = { income: 0, expenses: 0 };
    if (t.type === "income") monthlyTrend[m].income += Number(t.amount);
    if (t.type === "expense") monthlyTrend[m].expenses += Number(t.amount);
  }
  const incomeExpenseTrend = Object.entries(monthlyTrend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: m, ...v }));

  const totalExpenses = filtered.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalIncome = filtered.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const prevExpenses = prevFiltered.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);

  const byCategory: Record<string, number> = {};
  for (const t of filtered.filter((t) => t.type === "expense")) {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
  }

  const byMerchant: Record<string, number> = {};
  for (const t of filtered.filter((t) => t.type === "expense")) {
    const key = t.merchant || "Unknown";
    byMerchant[key] = (byMerchant[key] || 0) + Number(t.amount);
  }
  const topMerchants = Object.entries(byMerchant)
    .sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([merchant, amount]) => ({ merchant, amount }));

  const topExpenses = filtered.filter((t) => t.type === "expense")
    .sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 10)
    .map((t) => ({ id: t.id, merchant: t.merchant, amount: Number(t.amount), category: t.category, date: t.transaction_date, source: t.source }));

  const { data: budgets } = await supabase.from("budgets").select("*")
    .eq("month", `${year}-${String(mon).padStart(2, "0")}-01`);
  const budgetTracking = (budgets || []).map((b) => {
    const spent = b.category ? byCategory[b.category] || 0 : totalExpenses;
    return { category: b.category || "overall", budget: Number(b.amount), spent, percentage: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0 };
  });

  return NextResponse.json({
    totalExpenses, totalIncome,
    expenseChange: prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0,
    byCategory, topMerchants, topExpenses, budgetTracking, incomeExpenseTrend,
  });
}
