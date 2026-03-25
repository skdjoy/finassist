interface InsightData {
  totalExpenses: number;
  totalIncome: number;
  prevExpenses: number;
  byCategory: Record<string, number>;
  prevByCategory: Record<string, number>;
  budgetTracking: { category: string; budget: number; spent: number; percentage: number }[];
  topExpense: { merchant: string; amount: number } | null;
  daysRemaining: number;
  savingsRate?: number;
  dailySpendingRate?: number;
  projectedMonthEnd?: number;
  totalWithdrawals?: number;
}

export interface Insight {
  type: "info" | "warning" | "alert";
  message: string;
}

export function generateInsights(data: InsightData): Insight[] {
  const insights: Insight[] = [];

  // Spending change vs last month
  if (data.prevExpenses > 0) {
    const change = ((data.totalExpenses - data.prevExpenses) / data.prevExpenses) * 100;
    if (change > 30) {
      insights.push({ type: "warning", message: `Spending is ${change.toFixed(0)}% higher than last month` });
    } else if (change < -20) {
      insights.push({ type: "info", message: `Spending is down ${Math.abs(change).toFixed(0)}% from last month` });
    }
  }

  // Projected overspend alert
  if (data.projectedMonthEnd && data.daysRemaining > 3) {
    const overallBudget = data.budgetTracking.find((b) => b.category === "overall");
    if (overallBudget && data.projectedMonthEnd > overallBudget.budget) {
      const overBy = Math.round(data.projectedMonthEnd - overallBudget.budget);
      insights.push({ type: "alert", message: `On pace to exceed budget by ৳${overBy.toLocaleString()} this month` });
    }
  }

  // Daily spending rate
  if (data.dailySpendingRate && data.dailySpendingRate > 0) {
    insights.push({ type: "info", message: `Averaging ৳${Math.round(data.dailySpendingRate).toLocaleString()} per day in spending` });
  }

  // Category changes vs last month
  for (const [cat, amount] of Object.entries(data.byCategory)) {
    const prev = data.prevByCategory[cat] || 0;
    if (prev > 0 && amount > prev * 1.5 && amount > 1000) {
      insights.push({ type: "warning", message: `${capitalize(cat)} spending is ${((amount / prev - 1) * 100).toFixed(0)}% higher than last month` });
    }
  }

  // New category detection (spending in category that didn't exist last month)
  for (const [cat, amount] of Object.entries(data.byCategory)) {
    if (amount > 500 && !data.prevByCategory[cat]) {
      insights.push({ type: "info", message: `New spending category: ${capitalize(cat)} — ৳${amount.toLocaleString()} this month` });
    }
  }

  // Category concentration warning
  if (data.totalExpenses > 0) {
    for (const [cat, amount] of Object.entries(data.byCategory)) {
      const share = (amount / data.totalExpenses) * 100;
      if (share > 50 && cat !== "other") {
        insights.push({ type: "warning", message: `${capitalize(cat)} accounts for ${share.toFixed(0)}% of all spending` });
      }
    }
  }

  // Budget alerts
  for (const b of data.budgetTracking) {
    if (b.percentage >= 90 && data.daysRemaining > 5) {
      insights.push({ type: "alert", message: `You're at ${b.percentage.toFixed(0)}% of your ${b.category} budget with ${data.daysRemaining} days remaining` });
    } else if (b.percentage >= 75 && b.percentage < 90) {
      insights.push({ type: "warning", message: `${capitalize(b.category)} budget is ${b.percentage.toFixed(0)}% used` });
    }
  }

  // Largest expense
  if (data.topExpense && data.topExpense.amount > 5000) {
    insights.push({ type: "info", message: `Largest expense: ${data.topExpense.merchant || "Unknown"} — ৳${data.topExpense.amount.toLocaleString()}` });
  }

  // Net savings / deficit
  if (data.totalIncome > 0) {
    const savings = data.totalIncome - data.totalExpenses;
    if (savings > 0) {
      const rate = data.savingsRate ?? ((savings / data.totalIncome) * 100);
      insights.push({ type: "info", message: `Saving ${rate.toFixed(0)}% of income — ৳${savings.toLocaleString()} this month` });
    } else {
      insights.push({ type: "alert", message: `Spending exceeds income by ৳${Math.abs(savings).toLocaleString()}` });
    }
  }

  // Withdrawals notice
  if (data.totalWithdrawals && data.totalWithdrawals > 0) {
    insights.push({ type: "info", message: `৳${data.totalWithdrawals.toLocaleString()} withdrawn in cash this month` });
  }

  // Sort by severity (alerts first, then warnings, then info), limit to 8
  const order = { alert: 0, warning: 1, info: 2 };
  return insights.sort((a, b) => order[a.type] - order[b.type]).slice(0, 8);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}
