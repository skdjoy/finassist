"use client";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { TransactionTable } from "@/components/transaction-table";
import { TransactionFilters } from "@/components/transaction-filters";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function TransactionsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [groupedIds, setGroupedIds] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month, page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (category !== "all") params.set("category", category);
    if (type !== "all") params.set("type", type);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setTotal(data.total || 0);
    const rawGroups = data.groups || [];
    setGroups(rawGroups);
    const gIds = new Set<string>();
    for (const g of rawGroups) { gIds.add(g.primary_transaction_id); gIds.add(g.linked_transaction_id); }
    setGroupedIds(gIds);
    setLoading(false);
  }, [month, search, category, type, page]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [month, search, category, type]);

  async function handleCategoryChange(id: string, newCategory: string) {
    await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: newCategory }) });
    fetchTransactions();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-muted/50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <TransactionFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} type={type} onTypeChange={setType} />
        {loading ? (
          <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <>
            <TransactionTable transactions={transactions} groupedIds={groupedIds} groups={groups} onCategoryChange={handleCategoryChange} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">{total} transactions</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
