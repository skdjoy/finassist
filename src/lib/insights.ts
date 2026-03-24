interface InsightData {
  totalExpenses: number;
  totalIncome: number;
  prevExpenses: number;
  byCategory: Record<string, number>;
  prevByCategory: Record<string, number>;
  budgetTracking: { category: string; budget: number; spent: number; percentage: number }[];
  topExpense: { merchant: string; amount: number } | null;
  daysRemaining: number;
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

  // Category changes vs last month
  for (const [cat, amount] of Object.entries(data.byCategory)) {
    const prev = data.prevByCategory[cat] || 0;
    if (prev > 0 && amount > prev * 1.5 && amount > 1000) {
      insights.push({ type: "warning", message: `${capitalize(cat)} spending is ${((amount / prev - 1) * 100).toFixed(0)}% higher than last month` });
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

  // Net savings
  if (data.totalIncome > 0) {
    const savings = data.totalIncome - data.totalExpenses;
    if (savings > 0) {
      insights.push({ type: "info", message: `Net savings this month: ৳${savings.toLocaleString()}` });
    } else {
      insights.push({ type: "alert", message: `Spending exceeds income by ৳${Math.abs(savings).toLocaleString()}` });
    }
  }

  return insights.slice(0, 4);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
}
