"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CategoryTrendChartProps {
  categoryTrends: Record<string, Record<string, number>>;
  months: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "#ef4444", dining: "#f97316", transport: "#3b82f6", subscription: "#8b5cf6",
  shopping: "#ec4899", health: "#14b8a6", groceries: "#22c55e", entertainment: "#f59e0b",
  utilities: "#6366f1", education: "#06b6d4", lifestyle: "#a855f7", shipping: "#64748b",
  other: "#94a3b8",
};

function formatMonth(month: string): string {
  const [, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[parseInt(m) - 1] || month;
}

export function CategoryTrendChart({ categoryTrends, months }: CategoryTrendChartProps) {
  // Only show categories with meaningful spending (>500 total across all months)
  const significantCategories = Object.entries(categoryTrends)
    .filter(([, monthData]) => Object.values(monthData).reduce((s, v) => s + v, 0) > 500)
    .sort(([, a], [, b]) => {
      const totalA = Object.values(a).reduce((s, v) => s + v, 0);
      const totalB = Object.values(b).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    })
    .slice(0, 6) // Top 6 categories for readability
    .map(([cat]) => cat);

  if (significantCategories.length === 0) return null;

  const chartData = months.map((m) => {
    const point: Record<string, number | string> = { month: formatMonth(m) };
    for (const cat of significantCategories) {
      point[cat] = categoryTrends[cat]?.[m] || 0;
    }
    return point;
  });

  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="text-base">Spending Trends by Category</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
            <Legend />
            {significantCategories.map((cat) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={CATEGORY_COLORS[cat] || "#94a3b8"}
                name={cat.charAt(0).toUpperCase() + cat.slice(1).replace("_", " ")}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
