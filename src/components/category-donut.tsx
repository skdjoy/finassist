"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#8b5cf6", "#3b82f6", "#22c55e", "#eab308", "#ef4444", "#f97316", "#06b6d4", "#ec4899", "#6366f1", "#14b8a6"];

interface CategoryDonutProps { data: Record<string, number> }

export function CategoryDonut({ data }: CategoryDonutProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Spending by Category</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
            </Pie>
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
