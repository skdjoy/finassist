export interface EmailInput {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  snippet: string;
  date: string;
  internalDate: Date;
}

export interface ParsedTransaction {
  amount: number;
  currency: string;
  type: "expense" | "income" | "transfer" | "top_up" | "withdrawal";
  category: string;
  merchant: string | null;
  description: string;
  transactionDate: Date;
  source: string;
  rawData: Record<string, unknown>;
}

export type ParserResult =
  | { status: "parsed"; transaction: ParsedTransaction }
  | { status: "skip"; reason: string };

export type Parser = (email: EmailInput) => ParserResult;
