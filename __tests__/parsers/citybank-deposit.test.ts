import { describe, it, expect } from "vitest";
import { parseCitybankDeposit } from "@/lib/parsers/citybank-deposit";
import { EmailInput } from "@/lib/parsers/types";

describe("parseCitybankDeposit", () => {
  it("parses deposit alert from subject and snippet", () => {
    const email: EmailInput = {
      messageId: "msg4", threadId: "t4", from: "City Bank PLC <noreply@citybankplc.com>",
      subject: "BDT 7,000.00 Deposited to A/C 28035******001",
      date: "Fri, 20 Mar 2026 19:30:24 +0600",
      snippet: "Deposit Alert You received BDT 7000.00 as Deposit Account 28035******001 HIGH VALUE SAVINGS A/C Date 20-MAR-2026 07:17 PM Amount BDT 7000.00 Available Balance BDT 7870.59",
      internalDate: new Date("2026-03-20T13:30:24Z"),
      body: "To view the message, please use an HTML compatible email viewer!",
    };
    const result = parseCitybankDeposit(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("income");
      expect(result.transaction.category).toBe("income");
      expect(result.transaction.rawData).toHaveProperty("account", "28035******001");
      expect(result.transaction.rawData).toHaveProperty("balance", 7870.59);
    }
  });
});
