"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "./month-selector";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function Header({ month, onMonthChange }: HeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Synced ${data.synced} transactions, ${data.grouped} grouped`);
        router.refresh();
      } else {
        toast.error(`Error: ${data.error}`);
      }
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/transactions", label: "Transactions" },
    { href: "/budgets", label: "Budgets" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">FinAssist</h1>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}
                className={`text-sm ${pathname === item.href ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={month} onChange={onMonthChange} />
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </header>
  );
}
