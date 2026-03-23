import { EmailInput, ParserResult } from "./types";

const SUBJECT_AMOUNT_PATTERN = /BDT\s*([\d,.]+)\s*Deposited to A\/C\s*(\S+)/i;
const SNIPPET_DATE_PATTERN = /Date\s*(\d{2}-\w{3}-\d{4}\s*\d{2}:\d{2}\s*(?:AM|PM))/i;
const SNIPPET_BALANCE_PATTERN = /Available Balance\s*BDT\s*([\d,.]+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseCitybankDeposit(email: EmailInput): ParserResult {
  const subjectMatch = email.subject.match(SUBJECT_AMOUNT_PATTERN);
  if (!subjectMatch) return { status: "skip", reason: "citybank_no_subject_match" };

  const amount = parseAmount(subjectMatch[1]);
  const account = subjectMatch[2];

  const dateMatch = email.snippet.match(SNIPPET_DATE_PATTERN);
  const balanceMatch = email.snippet.match(SNIPPET_BALANCE_PATTERN);

  let transactionDate = email.internalDate;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) transactionDate = parsed;
  }

  return {
    status: "parsed",
    transaction: {
      amount, currency: "BDT", type: "income", category: "transfer",
      merchant: "City Bank",
      description: `Deposit to account ${account}`,
      transactionDate, source: "citybank_deposit",
      rawData: { account, balance: balanceMatch ? parseAmount(balanceMatch[1]) : null },
    },
  };
}
