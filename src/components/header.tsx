"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { MonthSelector } from "./month-selector";
import { Loader2 } from "lucide-react";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

interface SyncError {
  messageId: string;
  sender?: string;
  subject?: string;
  error: string;
}

interface SyncResult {
  synced: number;
  grouped: number;
  skipped: number;
  errors: SyncError[];
  breakdown: { byParser: Record<string, number>; byType: Record<string, number> };
  batches: number;
}

export function Header({ month, onMonthChange }: HeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{ batch: number; totalSynced: number } | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [showResult, setShowResult] = useState(false);
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
      if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);
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
          if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);
          toast.success("Sync complete");
          router.refresh();
        }
      } catch {}
    }, 5000);
  }

  async function handleSync() {
    setSyncing(true);
    setBatchProgress(null);

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalGrouped = 0;
    const totalErrors: SyncError[] = [];
    const allByParser: Record<string, number> = {};
    const allByType: Record<string, number> = {};
    let batch = 0;
    const maxBatches = 10;

    try {
      while (batch < maxBatches) {
        batch++;
        setBatchProgress({ batch, totalSynced });

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

        totalSynced += data.synced ?? 0;
        totalSkipped += data.skipped ?? 0;
        totalGrouped += data.grouped ?? 0;
        if (data.errors?.length) totalErrors.push(...data.errors);

        // Merge breakdowns
        for (const [k, v] of Object.entries(data.breakdown?.byParser ?? {})) {
          allByParser[k] = (allByParser[k] || 0) + (v as number);
        }
        for (const [k, v] of Object.entries(data.breakdown?.byType ?? {})) {
          allByType[k] = (allByType[k] || 0) + (v as number);
        }

        if (data.lastSyncAt) setLastSyncAt(data.lastSyncAt);

        if (data.hasMore) {
          toast.info(`Batch ${batch}: ${data.synced} synced, fetching more...`);
        } else {
          break;
        }
      }

      // Build result and show dialog
      const result: SyncResult = {
        synced: totalSynced,
        grouped: totalGrouped,
        skipped: totalSkipped,
        errors: totalErrors,
        breakdown: { byParser: allByParser, byType: allByType },
        batches: batch,
      };
      setSyncResult(result);

      if (totalErrors.length > 0) {
        toast.warning(`Synced ${totalSynced} with ${totalErrors.length} error(s)`);
        setShowResult(true);
      } else if (totalSynced === 0) {
        toast.info("Already up to date");
      } else {
        toast.success(`Synced ${totalSynced} transaction${totalSynced !== 1 ? "s" : ""}`);
        setShowResult(true);
      }

      router.refresh();
    } catch {
      toast.error("Sync failed");
    }
    setSyncing(false);
    setBatchProgress(null);
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
    <>
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
            {lastSyncAt && !syncing && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
              </span>
            )}
            <Button size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  {batchProgress && batchProgress.batch > 1
                    ? `Batch ${batchProgress.batch} (${batchProgress.totalSynced} synced)...`
                    : "Syncing..."}
                </>
              ) : "Sync"}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </header>

      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync Complete</DialogTitle>
            <DialogDescription>
              {syncResult?.batches} batch{(syncResult?.batches ?? 0) > 1 ? "es" : ""} processed
            </DialogDescription>
          </DialogHeader>

          {syncResult && (
            <div className="space-y-4">
              {/* Summary counts */}
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Badge variant="default">{syncResult.synced}</Badge> synced
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{syncResult.skipped}</Badge> skipped
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">{syncResult.grouped}</Badge> grouped
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="destructive">{syncResult.errors.length}</Badge> errors
                  </div>
                )}
              </div>

              {/* Parser breakdown */}
              {Object.keys(syncResult.breakdown.byParser).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">By source</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(syncResult.breakdown.byParser).map(([parser, count]) => (
                      <Badge key={parser} variant="outline">
                        {parser.replace(/_/g, " ")}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Type breakdown */}
              {Object.keys(syncResult.breakdown.byType).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">By type</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(syncResult.breakdown.byType).map(([type, count]) => (
                      <Badge key={type} variant="outline">
                        {type}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {syncResult.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-destructive mb-1">Errors</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {syncResult.errors.map((err, i) => (
                      <div key={i} className="text-xs bg-destructive/10 rounded p-2">
                        <span className="font-medium">{err.subject || err.messageId}</span>
                        <br />
                        <span className="text-muted-foreground">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}
