import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /Payment Amount\s*BDT\s*([\d,.]+)/i;
const REFERENCE_PATTERN = /Payment Reference Number\s*(\w+)/i;
const TRANSFER_TO_PATTERN = /Transfer To\s*(\S+)/i;
const TRANSFER_FROM_PATTERN = /Transfer From\s*(\S+)/i;
const BENEFICIARY_NAME_PATTERN = /Beneficiary Name\s*(.+?)(?=Beneficiary Type)/i;
const BENEFICIARY_BANK_PATTERN = /Beneficiary Bank Name\s*(.+?)(?=(?:Status|Please))/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseScbTransfer(email: EmailInput): ParserResult {
  const body = email.body;
  const subject = email.subject;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "scb_transfer_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const reference = body.match(REFERENCE_PATTERN)?.[1] || "";
  const transferTo = body.match(TRANSFER_TO_PATTERN)?.[1] || "";
  const transferFrom = body.match(TRANSFER_FROM_PATTERN)?.[1] || "";
  const beneficiaryName = body.match(BENEFICIARY_NAME_PATTERN)?.[1]?.trim() || "";
  const beneficiaryBank = body.match(BENEFICIARY_BANK_PATTERN)?.[1]?.trim() || "";

  const isSubmitted = subject.toLowerCase().includes("submitted");
  const status = isSubmitted ? "Submitted" : "Successful";

  return {
    status: "parsed",
    transaction: {
      amount, currency: "BDT", type: "transfer", category: "transfer",
      merchant: beneficiaryBank || null,
      description: `Transfer to ${beneficiaryName || transferTo}`,
      transactionDate: email.internalDate, source: "scb_transfer",
      rawData: { referenceNumber: reference, transferTo, transferFrom, beneficiaryName, beneficiaryBank, status },
    },
  };
}
