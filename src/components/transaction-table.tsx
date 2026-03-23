"use client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Transaction { id: string; amount: number; type: string; category: string; merchant: string | null; description: string; transaction_date: string; source: string }

const CATEGORIES = ["food","transport","subscription","shopping","health","groceries","transfer","top_up","lifestyle","shipping","other"];
const TYPE_COLORS: Record<string, string> = {
  expense: "bg-red-100 text-red-700", income: "bg-green-100 text-green-700",
  transfer: "bg-blue-100 text-blue-700", top_up: "bg-purple-100 text-purple-700",
};

interface Props { transactions: Transaction[]; groupedIds: Set<string>; onCategoryChange: (id: string, category: string) => void }

export function TransactionTable({ transactions, groupedIds, onCategoryChange }: Props) {
  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="p-3">Date</th><th className="p-3">Merchant</th><th className="p-3">Amount</th>
            <th className="p-3">Type</th><th className="p-3">Category</th><th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-3 text-sm">{format(new Date(tx.transaction_date), "MMM d, yyyy")}</td>
              <td className="p-3 text-sm font-medium">
                {tx.merchant || tx.description}
                {groupedIds.has(tx.id) && <Badge variant="outline" className="ml-2 text-xs">grouped</Badge>}
              </td>
              <td className="p-3 text-sm font-semibold">৳{tx.amount.toLocaleString()}</td>
              <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[tx.type] || ""}`}>{tx.type}</span></td>
              <td className="p-3">
                <Select value={tx.category} onValueChange={(v) => onCategoryChange(tx.id, v)}>
                  <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="text-xs">{c.replace("_"," ")}</SelectItem>))}</SelectContent>
                </Select>
              </td>
              <td className="p-3"><Badge variant="secondary" className="text-xs">{tx.source}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
