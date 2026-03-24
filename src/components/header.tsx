"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "./month-selector";
import { Loader2 } from "lucide-react";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function Header({ month, onMonthChange }: HeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if a sync is already in progress on mount
  useEffect(() => {
    fetch("/api/sync").then((r) => r.json()).then((data) => {
      if (data.syncing) {
        setSyncing(true);
        startPolling();
      }
    }).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync");
        const data = await res.json();
        if (!data.syncing) {
          setSyncing(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          toast.success("Sync complete");
          router.refresh();
        }
      } catch {}
    }, 5000);
  }

  async function handleSync() {
    setSyncing(true);
    let totalSynced = 0;
    let batch = 0;
    const maxBatches = 10; // 10 x 100 = 1000 emails max for initial backlog
    try {
      while (batch < maxBatches) {
        batch++;
        const res = await fetch("/api/sync", { method: "POST" });
        const data = await res.json();
        if (res.status === 409) {
          toast.info("Sync already in progress");
          startPolling();
          return;
        }
        if (!res.ok) {
          toast.error(`Error: ${data.error}`);
          break;
        }
        totalSynced += data.synced;
        if (data.hasMore) {
          toast.info(`Batch ${batch}: synced ${data.synced} transactions, fetching more...`);
        } else {
          toast.success(`Synced ${totalSynced} transactions total (${batch} batch${batch > 1 ? "es" : ""})`);
          break;
        }
      }
      router.refresh();
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
            {syncing ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Syncing...</> : "Sync"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}>Logout</Button>
        </div>
      </div>
    </header>
  );
}
