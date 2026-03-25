"use client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FiltersProps {
  search: string; onSearchChange: (v: string) => void;
  category: string; onCategoryChange: (v: string) => void;
  type: string; onTypeChange: (v: string) => void;
}

const CATEGORIES = ["all","food","dining","transport","subscription","shopping","health","groceries","transfer","top_up","withdrawal","lifestyle","shipping","entertainment","utilities","education","income","other"];
const TYPES = ["all","expense","income","transfer","top_up","withdrawal"];

export function TransactionFilters({ search, onSearchChange, category, onCategoryChange, type, onTypeChange }: FiltersProps) {
  return (
    <div className="flex gap-3">
      <Input placeholder="Search merchant..." value={search} onChange={(e) => onSearchChange(e.target.value)} className="w-64" />
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1).replace("_"," ")}</SelectItem>))}
        </SelectContent>
      </Select>
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          {TYPES.map((t) => (<SelectItem key={t} value={t}>{t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1).replace("_"," ")}</SelectItem>))}
        </SelectContent>
      </Select>
    </div>
  );
}
