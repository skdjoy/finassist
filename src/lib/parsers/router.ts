import { EmailInput, ParserResult } from "./types";
import { parseScbCard } from "./scb-card";
import { parseScbTransfer } from "./scb-transfer";
import { parseScbCcPayment } from "./scb-cc-payment";
import { parseCitybankDeposit } from "./citybank-deposit";
import { parseCitytouchBkash } from "./citytouch-bkash";
import { parseLlmService } from "./llm-service";

const SKIP_SENDERS = [
  "promotions@citybankplc.com",
  "citytouchpromotion@thecitybank.com",
  "digitalbanking.bd@sc.com",
];

const SERVICE_SENDERS = [
  "info@mail.foodpanda.com.bd",
  "noreply@uber.com",
  "uberone@uber.com",
  "no-reply@spotify.com",
  "invoice+statements@mail.anthropic.com",
  "googleplay-noreply@google.com",
  "bd.ebilling@dhl.com",
];

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

export function routeEmail(
  email: EmailInput
): { parser: string; parse: () => Promise<ParserResult> | ParserResult; allowLlmFallback?: boolean } {
  const sender = extractEmail(email.from);
  const subject = email.subject.toLowerCase();

  if (SKIP_SENDERS.includes(sender)) {
    return { parser: "skip", parse: () => ({ status: "skip", reason: "promotional" }) };
  }

  if (sender === "ibanking.bangladesh@sc.com" && subject.includes("etac")) {
    return { parser: "skip", parse: () => ({ status: "skip", reason: "otp_email" }) };
  }

  if (sender === "smsbanking.bd@sc.com") {
    return { parser: "scb_card", parse: () => parseScbCard(email), allowLlmFallback: true };
  }

  if (sender === "ibanking.bangladesh@sc.com") {
    if (subject.includes("domestic transfer")) {
      return { parser: "scb_transfer", parse: () => parseScbTransfer(email), allowLlmFallback: true };
    }
    if (subject.includes("credit card payment")) {
      return { parser: "scb_cc_payment", parse: () => parseScbCcPayment(email), allowLlmFallback: true };
    }
  }

  if (sender === "noreply@citybankplc.com" && subject.includes("deposited")) {
    return { parser: "citybank_deposit", parse: () => parseCitybankDeposit(email), allowLlmFallback: true };
  }

  if (sender === "citytouch@thecitybank.com" && subject.includes("mobile wallet transfer")) {
    return { parser: "citytouch_bkash", parse: () => parseCitytouchBkash(email), allowLlmFallback: true };
  }

  if (SERVICE_SENDERS.includes(sender)) {
    return { parser: "llm_service", parse: () => parseLlmService(email) };
  }

  return { parser: "skip", parse: () => ({ status: "skip", reason: "unrecognized_sender" }) };
}
