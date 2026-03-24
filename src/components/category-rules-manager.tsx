"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["food", "transport", "subscription", "shopping", "health", "groceries", "transfer", "top_up", "lifestyle", "shipping", "other"];

interface Rule { id: string; pattern: string; category: string; created_at: string }

export function CategoryRulesManager() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchRules() {
    try {
      const res = await fetch("/api/category-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(Array.isArray(data) ? data : []);
      }
    } catch {
      // API error - leave rules empty
    }
    setLoading(false);
  }

  useEffect(() => { fetchRules(); }, []);

  async function handleAdd() {
    if (!pattern.trim() || !category) {
      toast.error("Enter a merchant pattern and select a category");
      return;
    }
    const res = await fetch("/api/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pattern: pattern.trim(), category }),
    });
    if (res.ok) {
      toast.success(`Rule added: "${pattern}" → ${category}`);
      setPattern("");
      setCategory("");
      fetchRules();
    } else {
      toast.error("Failed to add rule");
    }
  }

  async function handleDelete(id: string, ruleName: string) {
    const res = await fetch(`/api/category-rules?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`Rule "${ruleName}" deleted`);
      fetchRules();
    } else {
      toast.error("Failed to delete rule");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Category Rules</CardTitle>
        <p className="text-sm text-muted-foreground">Map merchant name patterns to categories. These override default rules on next sync.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="Merchant pattern (e.g. starbucks)" value={pattern} onChange={(e) => setPattern(e.target.value)} className="flex-1" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom rules yet. Category assignments use built-in defaults.</p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <code className="text-sm bg-card px-2 py-0.5 rounded border">{rule.pattern}</code>
                  <span className="text-muted-foreground">&rarr;</span>
                  <Badge variant="outline">{rule.category.replace("_", " ")}</Badge>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(rule.id, rule.pattern)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
