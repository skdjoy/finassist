import Anthropic from "@anthropic-ai/sdk";
import { EmailInput, ParserResult } from "./types";
import { autoAssignCategory } from "../categories";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a transaction data extractor. Given an email body, extract the financial transaction details. Return ONLY valid JSON with no extra text.

Required fields:
{
  "amount": <number in BDT>,
  "original_currency": "BDT" or "USD",
  "original_amount": <number in original currency, same as amount if BDT>,
  "merchant": "<merchant/service name>",
  "items": [{"name": "<string>", "quantity": <number>, "price": <number>}] or [],
  "date": "<ISO 8601 date string>",
  "description": "<one-line summary>"
}

If you cannot determine the amount, return {"error": "no_amount_found"}.`;

export async function parseLlmService(email: EmailInput): Promise<ParserResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
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

    const merchant = data.merchant || "Unknown Service";

    return {
      status: "parsed",
      transaction: {
        amount: data.amount, currency: "BDT", type: "expense",
        category: autoAssignCategory(merchant), merchant,
        description: data.description || `Purchase from ${merchant}`,
        transactionDate: data.date ? new Date(data.date) : email.internalDate,
        source: "llm_service",
        rawData: { items: data.items || [], originalCurrency: data.original_currency, originalAmount: data.original_amount },
      },
    };
  } catch (error) {
    console.error("LLM parser error:", error);
    return { status: "skip", reason: "llm_parse_failed" };
  }
}
