"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Mail, Link2, ArrowRight } from "lucide-react";

const TYPE_COLORS: Record<string, string> = {
  expense: "bg-red-500/10 text-red-500", income: "bg-emerald-500/10 text-emerald-500",
  transfer: "bg-blue-500/10 text-blue-500", top_up: "bg-violet-500/10 text-violet-500",
  withdrawal: "bg-amber-500/10 text-amber-500",
};

interface Transaction {
  id: string; amount: number; type: string; category: string;
  merchant: string | null; description: string; transaction_date: string; source: string;
  emails?: { gmail_message_id: string; sender: string; subject: string }[];
}

interface GroupInfo {
  primary_transaction_id: string;
  linked_transaction_id: string;
  linkedMerchant?: string;
  linkedAmount?: number;
  reason?: string;
}

const REASON_LABELS: Record<string, string> = {
  scb_transfer_pair: "SCB Transfer Pair (Submitted + Successful)",
  scb_citybank_transfer_pair: "Inter-Bank Transfer (SCB → City Bank)",
  bank_plus_merchant: "Bank Alert + Merchant Receipt",
  bkash_topup_pair: "bKash Top-up + Bank Deposit",
};

export function TransactionDetail({
  tx, group, open, onClose,
}: {
  tx: Transaction | null; group?: GroupInfo | null; open: boolean; onClose: () => void;
}) {
  if (!tx) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-lg">{tx.merchant || tx.description}</span>
            <Badge className={TYPE_COLORS[tx.type] || ""}>{tx.type}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Amount */}
          <div className="text-center py-4">
            <p className={`text-3xl font-bold ${tx.type === "income" ? "text-emerald-500" : tx.type === "expense" ? "text-red-500" : "text-foreground"}`}>
              {tx.type === "income" ? "+" : "-"}৳{tx.amount.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(tx.transaction_date), "EEEE, MMMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailItem label="Category" value={tx.category} />
            <DetailItem label="Source" value={tx.source.replace(/_/g, " ")} />
            {tx.merchant && <DetailItem label="Merchant" value={tx.merchant} />}
            {tx.description && tx.description !== tx.merchant && (
              <DetailItem label="Description" value={tx.description} />
            )}
          </div>

          {/* Linked emails */}
          {tx.emails && tx.emails.length > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Source Emails
                </p>
                {tx.emails.map((email) => (
                  <div key={email.gmail_message_id} className="text-sm py-1.5 border-b last:border-0">
                    <p className="font-medium truncate">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">{email.sender}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Group info */}
          {group && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5" /> Linked Transaction
                </p>
                <p className="text-sm">{REASON_LABELS[group.reason || ""] || "Related transaction"}</p>
                {group.linkedMerchant && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <span>{tx.merchant || "Transaction"}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                    <span>{group.linkedMerchant}</span>
                    {group.linkedAmount && <span className="font-medium">৳{group.linkedAmount.toLocaleString()}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
