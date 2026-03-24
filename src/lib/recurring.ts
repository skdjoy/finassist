interface Transaction {
  id: string;
  amount: number;
  merchant: string | null;
  type: string;
  transaction_date: string;
}

export interface RecurringCharge {
  merchant: string;
  frequency: "weekly" | "monthly" | "irregular";
  avgAmount: number;
  count: number;
  lastDate: string;
  monthlyEstimate: number;
}

export function detectRecurring(transactions: Transaction[]): RecurringCharge[] {
  // Group by normalized merchant
  const groups: Record<string, { amounts: number[]; dates: Date[] }> = {};
  for (const tx of transactions) {
    if (!tx.merchant || tx.type !== "expense") continue;
    const key = tx.merchant.toLowerCase().replace(/\s+/g, " ").trim();
    if (!groups[key]) groups[key] = { amounts: [], dates: [] };
    groups[key].amounts.push(Number(tx.amount));
    groups[key].dates.push(new Date(tx.transaction_date));
  }

  const results: RecurringCharge[] = [];
  for (const [merchant, { amounts, dates }] of Object.entries(groups)) {
    if (amounts.length < 2) continue;

    // Check amount consistency (within 10%)
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const consistent = amounts.every((a) => Math.abs(a - avg) / avg < 0.1);
    if (!consistent) continue;

    // Check interval regularity
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24));
    }
    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;

    let frequency: "weekly" | "monthly" | "irregular";
    let monthlyEstimate: number;
    if (avgInterval >= 5 && avgInterval <= 10) {
      frequency = "weekly";
      monthlyEstimate = avg * 4.3;
    } else if (avgInterval >= 20 && avgInterval <= 40) {
      frequency = "monthly";
      monthlyEstimate = avg;
    } else {
      continue; // Skip irregular patterns
    }

    results.push({
      merchant: transactions.find((t) => t.merchant?.toLowerCase().replace(/\s+/g, " ").trim() === merchant)?.merchant || merchant,
      frequency,
      avgAmount: Math.round(avg * 100) / 100,
      count: amounts.length,
      lastDate: sorted[sorted.length - 1].toISOString(),
      monthlyEstimate: Math.round(monthlyEstimate),
    });
  }

  return results.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}
