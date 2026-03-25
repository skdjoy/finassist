import Anthropic from "@anthropic-ai/sdk";
import { EmailInput, ParserResult } from "./types";
import { autoAssignCategory } from "../categories";
import { normalizeMerchant } from "../merchant-utils";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM_PROMPT = `You are a transaction data extractor. Given an email body, extract the financial transaction details. Return ONLY valid JSON with no extra text.

Required fields:
{
  "amount": <number in BDT>,
  "original_currency": "BDT" or "USD",
  "original_amount": <number in original currency, same as amount if BDT>,
  "merchant": "<merchant/service name>",
  "items": [{"name": "<string>", "quantity": <number>, "price": <number>}] or [],
  "date": "<ISO 8601 date string>",
  "description": "<one-line summary>",
  "type": "expense" or "income" or "transfer" or "top_up" or "withdrawal"
}

If you cannot determine the amount, return {"error": "no_amount_found"}.`;

const BANK_FALLBACK_CONTEXT = `
This email is from a bank and a regex parser failed to extract the data. Look carefully for:
- Transaction amounts (BDT followed by numbers, or numbers followed by BDT)
- Merchant names, beneficiary names, or account descriptions
- Transaction dates in various formats (dd-MMM-yy, dd-MMM-yyyy, dd/MM/yyyy)
- Transaction type: card purchases are "expense", deposits are "income", inter-bank transfers are "transfer", ATM withdrawals are "withdrawal", mobile wallet top-ups are "top_up"
Parse the email even if the format is unusual or slightly different from expected templates.`;

export async function parseLlmService(
  email: EmailInput,
  context?: { failedParser?: string }
): Promise<ParserResult> {
  try {
    const systemPrompt = context?.failedParser
      ? `${BASE_SYSTEM_PROMPT}\n${BANK_FALLBACK_CONTEXT}`
      : BASE_SYSTEM_PROMPT;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Extract transaction data from this email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\nBody:\n${email.body.slice(0, 3000)}`,
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const data = JSON.parse(text);

    if (data.error) {
      return { status: "skip", reason: `llm_error: ${data.error}` };
    }

    const merchant = normalizeMerchant(data.merchant || "Unknown Service");
    const validTypes = ["expense", "income", "transfer", "top_up", "withdrawal"] as const;
    const txType = validTypes.includes(data.type) ? data.type : "expense";

    return {
      status: "parsed",
      transaction: {
        amount: data.amount, currency: "BDT", type: txType,
        category: txType === "income" ? "income" : txType === "transfer" ? "transfer" : txType === "withdrawal" ? "withdrawal" : txType === "top_up" ? "top_up" : autoAssignCategory(merchant),
        merchant,
        description: data.description || `Purchase from ${merchant}`,
        transactionDate: data.date ? new Date(data.date) : email.internalDate,
        source: context?.failedParser ? "llm_fallback" : "llm_service",
        rawData: { items: data.items || [], originalCurrency: data.original_currency, originalAmount: data.original_amount },
      },
    };
  } catch (error) {
    console.error("LLM parser error:", error);
    return { status: "skip", reason: "llm_parse_failed" };
  }
}
