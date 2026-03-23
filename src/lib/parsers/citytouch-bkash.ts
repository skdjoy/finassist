import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /Transferred Amount\s*BDT\s*([\d,.]+)/i;
const TOTAL_PATTERN = /Total Amount\s*BDT\s*([\d,.]+)/i;
const CHARGE_PATTERN = /Service Charge\s*BDT\s*([\d,.]+)/i;
const VAT_PATTERN = /VAT\s*BDT\s*([\d,.]+)/i;
const WALLET_PATTERN = /Beneficiary Wallet Number\s*(\S+)/i;
const ACCOUNT_PATTERN = /From Account\/Card\s*(\S+)/i;
const REFERENCE_PATTERN = /Reference Number\s*(\S+)/i;
const DATE_PATTERN = /Date and Time\s*(\d{2}-\w{3}-\d{4}\s*\d{2}:\d{2}\s*(?:AM|PM))/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseCitytouchBkash(email: EmailInput): ParserResult {
  const body = email.body;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "bkash_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const totalMatch = body.match(TOTAL_PATTERN);
  const chargeMatch = body.match(CHARGE_PATTERN);
  const vatMatch = body.match(VAT_PATTERN);
  const walletMatch = body.match(WALLET_PATTERN);
  const accountMatch = body.match(ACCOUNT_PATTERN);
  const referenceMatch = body.match(REFERENCE_PATTERN);
  const dateMatch = body.match(DATE_PATTERN);

  let transactionDate = email.internalDate;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) transactionDate = parsed;
  }

  return {
    status: "parsed",
    transaction: {
      amount, currency: "BDT", type: "top_up", category: "top_up",
      merchant: "bKash",
      description: `bKash transfer to ${walletMatch?.[1] || "wallet"}`,
      transactionDate, source: "citytouch_bkash",
      rawData: {
        totalAmount: totalMatch ? parseAmount(totalMatch[1]) : amount,
        serviceCharge: chargeMatch ? parseAmount(chargeMatch[1]) : 0,
        vat: vatMatch ? parseAmount(vatMatch[1]) : 0,
        walletNumber: walletMatch?.[1] || null,
        fromAccount: accountMatch?.[1] || null,
        referenceNumber: referenceMatch?.[1] || null,
      },
    },
  };
}
