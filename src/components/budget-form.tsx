"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "overall", label: "Overall" },{ value: "food", label: "Food" },{ value: "transport", label: "Transport" },
  { value: "subscription", label: "Subscription" },{ value: "shopping", label: "Shopping" },{ value: "health", label: "Health" },
  { value: "groceries", label: "Groceries" },{ value: "lifestyle", label: "Lifestyle" },{ value: "shipping", label: "Shipping" },{ value: "other", label: "Other" },
];

export function BudgetForm({ month, onSaved }: { month: string; onSaved: () => void }) {
  const [category, setCategory] = useState("overall");
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/budgets", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, category: category === "overall" ? null : category, amount: parseFloat(amount) }) });
    setAmount("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>{CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
      </Select>
      <Input type="number" placeholder="Amount (BDT)" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" required />
      <Button type="submit">Set Budget</Button>
    </form>
  );
}
