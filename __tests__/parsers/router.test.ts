import { describe, it, expect } from "vitest";
import { routeEmail } from "@/lib/parsers/router";
import { EmailInput } from "@/lib/parsers/types";

function makeEmail(overrides: Partial<EmailInput>): EmailInput {
  return { messageId: "test-id", threadId: "test-thread", from: "", subject: "", body: "", snippet: "", date: "", internalDate: new Date(), ...overrides };
}

describe("routeEmail", () => {
  it("routes SCB card alerts", () => {
    expect(routeEmail(makeEmail({ from: "<SMSBanking.BD@sc.com>", subject: "Standard Chartered Transaction Alert" })).parser).toBe("scb_card");
  });
  it("routes SCB domestic transfer", () => {
    expect(routeEmail(makeEmail({ from: "<iBanking.Bangladesh@sc.com>", subject: "Domestic Transfer - NPS -Successful" })).parser).toBe("scb_transfer");
  });
  it("routes SCB credit card payment", () => {
    expect(routeEmail(makeEmail({ from: "<iBanking.Bangladesh@sc.com>", subject: "Credit Card Payment Confirmation" })).parser).toBe("scb_cc_payment");
  });
  it("routes City Bank deposit", () => {
    expect(routeEmail(makeEmail({ from: "City Bank PLC <noreply@citybankplc.com>", subject: "BDT 7,000.00 Deposited to A/C 28035******001" })).parser).toBe("citybank_deposit");
  });
  it("routes Citytouch bKash", () => {
    expect(routeEmail(makeEmail({ from: "Citytouch <citytouch@thecitybank.com>", subject: "You made a Mobile Wallet Transfer" })).parser).toBe("citytouch_bkash");
  });
  it("routes Foodpanda to llm_service", () => {
    expect(routeEmail(makeEmail({ from: "foodpanda <info@mail.foodpanda.com.bd>", subject: "Your order has been placed." })).parser).toBe("llm_service");
  });
  it("skips promotional emails", () => {
    expect(routeEmail(makeEmail({ from: "promotions@citybankplc.com", subject: "Special offer!" })).parser).toBe("skip");
  });
  it("skips ETAC emails", () => {
    expect(routeEmail(makeEmail({ from: "<iBanking.Bangladesh@sc.com>", subject: "Standard Chartered Bank - ETAC Generation" })).parser).toBe("skip");
  });
  it("skips unrecognized senders", () => {
    expect(routeEmail(makeEmail({ from: "random@example.com", subject: "Hello" })).parser).toBe("skip");
  });
});
