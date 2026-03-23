import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /(?:Debit Amount|Transaction Amount)([\d,.]+)/i;
const CARD_PATTERN = /Card Number\w*(\d{4})/i;
const ACCOUNT_PATTERN = /Debit Account Number\w*(\d{4})/i;
const REFERENCE_PATTERN = /Reference No(\d+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseScbCcPayment(email: EmailInput): ParserResult {
  const body = email.body;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "scb_cc_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const card = body.match(CARD_PATTERN)?.[1] || "";
  const account = body.match(ACCOUNT_PATTERN)?.[1] || "";
  const reference = body.match(REFERENCE_PATTERN)?.[1] || "";

  return {
    status: "parsed",
    transaction: {
      amount, currency: "BDT", type: "transfer", category: "transfer",
      merchant: "Standard Chartered Credit Card",
      description: `Credit card payment - card ending ${card}`,
      transactionDate: email.internalDate, source: "scb_cc_payment",
      rawData: { card, account, reference },
    },
  };
}
