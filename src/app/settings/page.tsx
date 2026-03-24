"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/50 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [gmailStatus, setGmailStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("gmail") === "connected") { setGmailStatus("connected"); return; }
    if (searchParams.get("error")) { setGmailStatus("disconnected"); return; }
    // Check Gmail connection by trying a lightweight API call
    fetch("/api/dashboard?month=2000-01").then((r) => {
      setGmailStatus(r.ok ? "connected" : "disconnected");
    }).catch(() => setGmailStatus("disconnected"));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-muted/50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Gmail Connection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Google Gmail</p>
                <p className="text-sm text-muted-foreground">Read-only access to parse transaction emails</p>
              </div>
              <div className="flex items-center gap-3">
                {gmailStatus === "connected" ? <Badge className="bg-green-100 text-green-700">Connected</Badge>
                  : gmailStatus === "disconnected" ? <Badge variant="destructive">Not connected</Badge>
                  : <Badge variant="secondary">Checking...</Badge>}
                <Button size="sm" onClick={() => window.location.href = "/api/gmail/connect"}>
                  {gmailStatus === "connected" ? "Reconnect" : "Connect Gmail"}
                </Button>
              </div>
            </div>
            {searchParams.get("error") && <p className="text-sm text-red-500">OAuth failed: {searchParams.get("error")}. Please try again.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>About</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">FinAssist reads transaction emails from Standard Chartered Bank, City Bank, bKash, and various services to track your personal finances.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
