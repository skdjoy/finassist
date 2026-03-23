import { describe, it, expect } from "vitest";
import { parseScbTransfer } from "@/lib/parsers/scb-transfer";
import { EmailInput } from "@/lib/parsers/types";

describe("parseScbTransfer", () => {
  it("parses successful domestic transfer", () => {
    const email: EmailInput = {
      messageId: "msg2", threadId: "t2", from: "<iBanking.Bangladesh@sc.com>",
      subject: "Domestic Transfer - NPS -Successful",
      date: "Fri, 20 Mar 2026 21:19:12 +0800", snippet: "",
      internalDate: new Date("2026-03-20T13:19:12Z"),
      body: "Dear Customer,Your NPS Fund Transfer request has been processed successfully. Transfer To XXXXXXXXX8001 Payment Reference Number fte965d26e137e69 Payment Reference Domestic Transfer Online Banking - NPS Payment Amount BDT 7,000.00 Transfer From XXXXXXX8501 From Currency BDT Beneficiary Name Sowvik Kanti Das Beneficiary Type Account Beneficiary Bank Name THE CITY BANK LTD. Status Successful Please call Phone Banking on 16233.",
    };
    const result = parseScbTransfer(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("transfer");
      expect(result.transaction.rawData).toHaveProperty("referenceNumber", "fte965d26e137e69");
      expect(result.transaction.rawData).toHaveProperty("beneficiaryBank", "THE CITY BANK LTD.");
      expect(result.transaction.rawData).toHaveProperty("status", "Successful");
    }
  });
});
