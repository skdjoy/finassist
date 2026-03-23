import { ParsedTransaction } from "./parsers/types";

export interface TransactionWithEmail extends ParsedTransaction {
  _emailId: string;
}

export interface GroupMatch {
  primaryEmailId: string;
  linkedEmailId: string;
  reason: string;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

function amountClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function timeClose(a: Date, b: Date, windowMs: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= windowMs;
}

function merchantFuzzyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return na.includes(nb) || nb.includes(na);
}

export function findGroups(txs: TransactionWithEmail[]): GroupMatch[] {
  const groups: GroupMatch[] = [];
  const linked = new Set<string>();

  // Rule 1: SCB Transfer Pair (Submitted + Successful)
  const scbTransfers = txs.filter((t) => t.source === "scb_transfer");
  for (const tx of scbTransfers) {
    if (linked.has(tx._emailId)) continue;
    if (tx.rawData?.status !== "Successful") continue;
    const match = scbTransfers.find(
      (other) => other._emailId !== tx._emailId && !linked.has(other._emailId) &&
        other.rawData?.status === "Submitted" && other.rawData?.referenceNumber === tx.rawData?.referenceNumber
    );
    if (match) {
      groups.push({ primaryEmailId: tx._emailId, linkedEmailId: match._emailId, reason: "scb_transfer_pair" });
      linked.add(match._emailId);
    }
  }

  // Rule 2: SCB Transfer + City Bank Deposit
  const successfulTransfers = scbTransfers.filter((t) => t.rawData?.status === "Successful" && !linked.has(t._emailId));
  const cityDeposits = txs.filter((t) => t.source === "citybank_deposit" && !linked.has(t._emailId));
  for (const transfer of successfulTransfers) {
    const match = cityDeposits.find(
      (dep) => !linked.has(dep._emailId) && amountClose(transfer.amount, dep.amount, 1) &&
        timeClose(transfer.transactionDate, dep.transactionDate, THIRTY_MINUTES_MS)
    );
    if (match) {
      groups.push({ primaryEmailId: transfer._emailId, linkedEmailId: match._emailId, reason: "scb_citybank_transfer_pair" });
      linked.add(match._emailId);
    }
  }

  // Rule 3: Bank Alert + Service Email
  const bankAlerts = txs.filter((t) => t.source === "scb_card" && !linked.has(t._emailId));
  const serviceEmails = txs.filter((t) => t.source === "llm_service" && !linked.has(t._emailId));
  for (const service of serviceEmails) {
    const match = bankAlerts.find(
      (alert) => !linked.has(alert._emailId) && amountClose(service.amount, alert.amount, 5) &&
        timeClose(service.transactionDate, alert.transactionDate, SIXTY_MINUTES_MS) &&
        merchantFuzzyMatch(service.merchant, alert.merchant)
    );
    if (match) {
      groups.push({ primaryEmailId: service._emailId, linkedEmailId: match._emailId, reason: "bank_plus_merchant" });
      linked.add(match._emailId);
    }
  }

  // Rule 4: bKash Top-up Chain
  const bkashTransfers = txs.filter((t) => t.source === "citytouch_bkash" && !linked.has(t._emailId));
  const remainingDeposits = cityDeposits.filter((t) => !linked.has(t._emailId));
  for (const bkash of bkashTransfers) {
    const match = remainingDeposits.find(
      (dep) => !linked.has(dep._emailId) && amountClose(bkash.amount, dep.amount, 1) &&
        timeClose(bkash.transactionDate, dep.transactionDate, THIRTY_MINUTES_MS)
    );
    if (match) {
      groups.push({ primaryEmailId: bkash._emailId, linkedEmailId: match._emailId, reason: "bkash_topup_pair" });
      linked.add(match._emailId);
    }
  }

  return groups;
}
