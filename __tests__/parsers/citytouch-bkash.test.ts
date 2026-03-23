import { describe, it, expect } from "vitest";
import { parseCitytouchBkash } from "@/lib/parsers/citytouch-bkash";
import { EmailInput } from "@/lib/parsers/types";

describe("parseCitytouchBkash", () => {
  it("parses bKash wallet transfer", () => {
    const email: EmailInput = {
      messageId: "msg5", threadId: "t5", from: "Citytouch <citytouch@thecitybank.com>",
      subject: "You made a Mobile Wallet Transfer",
      date: "Fri, 20 Mar 2026 19:22:13 +0600",
      snippet: "Transaction Alert You have transferred BDT 7000.00 to 013002*3574",
      internalDate: new Date("2026-03-20T13:22:13Z"),
      body: "Email Template Transaction Alert You have transferred BDT 7,000.00 to 013002*3574 Transaction Type bKash Transfer Transferred Amount BDT 7,000.00 Service Charge BDT 0.00 VAT BDT 0.00 Total Amount BDT 7,000.00 Remarks From Account/Card 280352***8001 Beneficiary Wallet Number 013002*3574 Date and Time 20-MAR-2026 07:21 PM Reference Number CT79081497",
    };
    const result = parseCitytouchBkash(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("top_up");
      expect(result.transaction.rawData).toHaveProperty("walletNumber", "013002*3574");
      expect(result.transaction.rawData).toHaveProperty("referenceNumber", "CT79081497");
    }
  });
});
