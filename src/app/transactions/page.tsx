"use client";
import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { TransactionTable } from "@/components/transaction-table";
import { TransactionFilters } from "@/components/transaction-filters";

export default function TransactionsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [transactions, setTransactions] = useState([]);
  const [groupedIds, setGroupedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (search) params.set("search", search);
    if (category !== "all") params.set("category", category);
    if (type !== "all") params.set("type", type);
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    const gIds = new Set<string>();
    for (const g of data.groups || []) { gIds.add(g.primary_transaction_id); gIds.add(g.linked_transaction_id); }
    setGroupedIds(gIds);
    setLoading(false);
  }, [month, search, category, type]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  async function handleCategoryChange(id: string, newCategory: string) {
    await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: newCategory }) });
    fetchTransactions();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <TransactionFilters search={search} onSearchChange={setSearch} category={category} onCategoryChange={setCategory} type={type} onTypeChange={setType} />
        {loading ? <p className="text-gray-500">Loading...</p> : <TransactionTable transactions={transactions} groupedIds={groupedIds} onCategoryChange={handleCategoryChange} />}
      </main>
    </div>
  );
}
