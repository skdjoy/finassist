"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Link2, ChevronRight } from "lucide-react";
import { TransactionDetail } from "./transaction-detail";

interface Transaction {
  id: string; amount: number; type: string; category: string;
  merchant: string | null; description: string; transaction_date: string; source: string;
  emails?: { gmail_message_id: string; sender: string; subject: string }[];
}

interface GroupInfo {
  primary_transaction_id: string;
  linked_transaction_id: string;
}

const CATEGORIES = ["food","dining","transport","subscription","shopping","health","groceries","transfer","top_up","withdrawal","lifestyle","shipping","entertainment","utilities","education","income","other"];
const TYPE_COLORS: Record<string, string> = {
  expense: "bg-red-500/10 text-red-500 dark:bg-red-500/15",
  income: "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15",
  transfer: "bg-blue-500/10 text-blue-500 dark:bg-blue-500/15",
  top_up: "bg-violet-500/10 text-violet-500 dark:bg-violet-500/15",
  withdrawal: "bg-amber-500/10 text-amber-500 dark:bg-amber-500/15",
};
const SOURCE_LABELS: Record<string, string> = {
  scb_card: "SCB Card", scb_transfer: "SCB Transfer", scb_cc_payment: "SCB CC",
  citybank_deposit: "City Bank", citytouch_bkash: "bKash", llm_service: "Service",
  llm_fallback: "LLM Fallback",
};

interface Props {
  transactions: Transaction[];
  groupedIds: Set<string>;
  groups?: GroupInfo[];
  onCategoryChange: (id: string, category: string) => void;
}

export function TransactionTable({ transactions, groupedIds, groups = [], onCategoryChange }: Props) {
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  function getGroupForTx(txId: string): GroupInfo | null {
    return groups.find((g) => g.primary_transaction_id === txId || g.linked_transaction_id === txId) || null;
  }

  return (
    <>
      <div className="bg-card rounded-xl border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wider">
              <th className="p-3 font-medium">Date</th><th className="p-3 font-medium">Merchant</th><th className="p-3 font-medium">Amount</th>
              <th className="p-3 font-medium">Type</th><th className="p-3 font-medium">Category</th><th className="p-3 font-medium">Source</th>
              <th className="p-3 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => {
              const isGrouped = groupedIds.has(tx.id);
              return (
                <tr
                  key={tx.id}
                  className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer group"
                  onClick={() => { setSelected(tx); setShowDetail(true); }}
                >
                  <td className="p-3 text-sm text-muted-foreground">{format(new Date(tx.transaction_date), "MMM d, yyyy")}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tx.merchant || tx.description}</span>
                      {isGrouped && (
                        <span className="text-primary" title="Linked transaction">
                          <Link2 className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-sm font-semibold ${tx.type === "income" ? "text-emerald-500" : tx.type === "expense" ? "text-red-500" : ""}`}>
                      {tx.type === "income" ? "+" : ""}৳{tx.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_COLORS[tx.type] || ""}`}>{tx.type.replace("_", " ")}</span></td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <Select value={tx.category} onValueChange={(v) => onCategoryChange(tx.id, v)}>
                      <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c} value={c} className="text-xs capitalize">{c.replace("_"," ")}</SelectItem>))}</SelectContent>
                    </Select>
                  </td>
                  <td className="p-3"><Badge variant="secondary" className="text-xs font-normal">{SOURCE_LABELS[tx.source] || tx.source}</Badge></td>
                  <td className="p-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TransactionDetail
        tx={selected}
        group={selected ? getGroupForTx(selected.id) : null}
        open={showDetail}
        onClose={() => setShowDetail(false)}
      />
    </>
  );
}
