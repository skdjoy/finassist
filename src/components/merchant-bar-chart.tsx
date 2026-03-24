"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { normalizeMerchant } from "@/lib/merchant-utils";

interface MerchantBarChartProps { data: { merchant: string; amount: number }[] }

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}

export function MerchantBarChart({ data }: MerchantBarChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: truncate(normalizeMerchant(d.merchant), 20),
    displayAmount: `৳${d.amount.toLocaleString()}`,
  }));
  const chartHeight = Math.max(300, data.length * 35);

  return (
    <Card className="shadow-sm">
      <CardHeader><CardTitle className="text-base">Top Merchants</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={formatted} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" tickFormatter={(v) => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="label" type="category" width={140} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
            <Bar dataKey="amount" fill="#3b82f6" radius={[0, 4, 4, 0]}>
              <LabelList dataKey="displayAmount" position="right" style={{ fontSize: 11, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
