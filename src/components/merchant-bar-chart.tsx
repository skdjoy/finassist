"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MerchantBarChartProps { data: { merchant: string; amount: number }[] }

export function MerchantBarChart({ data }: MerchantBarChartProps) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Top Merchants</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="merchant" type="category" width={120} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
            <Bar dataKey="amount" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
