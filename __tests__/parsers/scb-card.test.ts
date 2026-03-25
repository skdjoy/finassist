import { describe, it, expect } from "vitest";
import { parseScbCard } from "@/lib/parsers/scb-card";
import { EmailInput } from "@/lib/parsers/types";

const baseEmail: EmailInput = {
  messageId: "msg1", threadId: "t1", from: "<SMSBanking.BD@sc.com>",
  subject: "Standard Chartered Transaction Alert",
  date: "Fri, 20 Mar 2026 12:45:33 +0000", snippet: "",
  internalDate: new Date("2026-03-20T12:45:33Z"), body: "",
};

describe("parseScbCard", () => {
  it("parses local card transaction", () => {
    const email = { ...baseEmail, body: "Card Alerts Alerts March 20 2026, 06:45 PM Dear Client, A local transaction of BDT 1324.00 was made using your card ending with 5575 at KFC GULSHAN 412 DHAKA BD on 20-Mar-26. If you have not made this transaction, please immediately call 16233. Your available credit limit is now BDT 55939.90." };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(1324.0);
      expect(result.transaction.type).toBe("expense");
      expect(result.transaction.merchant).toContain("KFC");
      expect(result.transaction.rawData).toHaveProperty("card", "5575");
    }
  });

  it("parses international e-transaction", () => {
    const email = { ...baseEmail, body: "Card Alerts Alerts March 21 2026, 03:06 PM Dear Client, An international e-transaction equivalent to BDT 126.90 was made using your card ending with 5575 at Microsoft*Store Singapore SG on 21-Mar-26. Your available credit limit is now BDT 58142.00." };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(126.9);
      expect(result.transaction.merchant).toContain("Microsoft");
      expect(result.transaction.rawData).toHaveProperty("international", true);
    }
  });

  it("parses withdrawal", () => {
    const email = { ...baseEmail, body: "Alerts CASA Alerts March 20 2026, 04:47 PM Dear Client, BDT 20000.00 was withdrawn from Acc. ending xxxxxxx8501 on 24-Mar-26. Your available balance is now BDT 617,430.15" };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(20000.0);
      expect(result.transaction.type).toBe("withdrawal");
      expect(result.transaction.rawData).toHaveProperty("account", "8501");
    }
  });
});
