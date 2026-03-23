import { EmailInput, ParserResult } from "./types";
import { autoAssignCategory } from "../categories";

const LOCAL_PATTERN = /A local (?:e-)?transaction of BDT ([\d,.]+) was made using your card ending with (\d+) at (.+?) on (\d{2}-\w{3}-\d{2})/i;
const INTL_PATTERN = /An international e-transaction equivalent to BDT ([\d,.]+) was made using your card ending with (\d+) at (.+?) on (\d{2}-\w{3}-\d{2})/i;
const WITHDRAWAL_PATTERN = /BDT ([\d,.]+) was withdrawn from Acc\. ending (?:\w+?)(\d{4}) on (\d{2}-\w{3}-\d{2})/i;
const CREDIT_LIMIT_PATTERN = /available credit limit is now BDT ([\d,.]+)/i;
const BALANCE_PATTERN = /available balance is now BDT ([\d,.]+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

function parseDate(dateStr: string): Date {
  const parts = dateStr.split("-");
  const year = parseInt(parts[2]) < 50 ? `20${parts[2]}` : `19${parts[2]}`;
  return new Date(`${parts[0]}-${parts[1]}-${year}`);
}

export function parseScbCard(email: EmailInput): ParserResult {
  const body = email.body;

  let match = body.match(LOCAL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const card = match[2];
    const merchant = match[3].trim();
    const date = parseDate(match[4]);
    const creditMatch = body.match(CREDIT_LIMIT_PATTERN);
    return {
      status: "parsed",
      transaction: {
        amount, currency: "BDT", type: "expense",
        category: autoAssignCategory(merchant), merchant,
        description: `Card purchase at ${merchant}`,
        transactionDate: date, source: "scb_card",
        rawData: { card, international: false, availableCredit: creditMatch ? parseAmount(creditMatch[1]) : null },
      },
    };
  }

  match = body.match(INTL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const card = match[2];
    const merchant = match[3].trim();
    const date = parseDate(match[4]);
    const creditMatch = body.match(CREDIT_LIMIT_PATTERN);
    return {
      status: "parsed",
      transaction: {
        amount, currency: "BDT", type: "expense",
        category: autoAssignCategory(merchant), merchant,
        description: `International purchase at ${merchant}`,
        transactionDate: date, source: "scb_card",
        rawData: { card, international: true, availableCredit: creditMatch ? parseAmount(creditMatch[1]) : null },
      },
    };
  }

  match = body.match(WITHDRAWAL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const account = match[2];
    const date = parseDate(match[3]);
    const balanceMatch = body.match(BALANCE_PATTERN);
    return {
      status: "parsed",
      transaction: {
        amount, currency: "BDT", type: "transfer", category: "transfer",
        merchant: null, description: `Withdrawal from account ending ${account}`,
        transactionDate: date, source: "scb_card",
        rawData: { account, availableBalance: balanceMatch ? parseAmount(balanceMatch[1]) : null },
      },
    };
  }

  return { status: "skip", reason: "scb_card_no_pattern_match" };
}
