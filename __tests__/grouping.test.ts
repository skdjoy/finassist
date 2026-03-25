import { describe, it, expect } from "vitest";
import { findGroups, TransactionWithEmail } from "@/lib/grouping";

function makeTx(overrides: Partial<TransactionWithEmail>): TransactionWithEmail {
  return {
    _emailId: "e1", amount: 0, currency: "BDT", type: "expense",
    category: "other", merchant: null, description: "",
    transactionDate: new Date("2026-03-20T12:00:00Z"),
    source: "scb_card", rawData: {}, ...overrides,
  };
}

describe("findGroups", () => {
  it("groups SCB submitted + successful by reference number", () => {
    const txs = [
      makeTx({ _emailId: "e1", source: "scb_transfer", amount: 7000, rawData: { referenceNumber: "ref123", status: "Submitted" } }),
      makeTx({ _emailId: "e2", source: "scb_transfer", amount: 7000, rawData: { referenceNumber: "ref123", status: "Successful" } }),
    ];
    const groups = findGroups(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0].primaryEmailId).toBe("e2");
    expect(groups[0].linkedEmailId).toBe("e1");
    expect(groups[0].reason).toBe("scb_transfer_pair");
  });

  it("groups SCB transfer + City Bank deposit by amount and time", () => {
    const txs = [
      makeTx({ _emailId: "e1", source: "scb_transfer", amount: 7000, transactionDate: new Date("2026-03-20T12:00:00Z"), rawData: { status: "Successful" } }),
      makeTx({ _emailId: "e2", source: "citybank_deposit", amount: 7000, transactionDate: new Date("2026-03-20T12:10:00Z") }),
    ];
    const groups = findGroups(txs);
    expect(groups.some((g) => g.reason === "scb_citybank_transfer_pair")).toBe(true);
  });

  it("groups bank alert + service email by amount and time window", () => {
    const txs = [
      makeTx({ _emailId: "e1", source: "scb_card", amount: 313, merchant: "Foodpanda Bangladesh", transactionDate: new Date("2026-03-22T15:55:00Z") }),
      makeTx({ _emailId: "e2", source: "llm_service", amount: 313, merchant: "Foodpanda", transactionDate: new Date("2026-03-22T15:53:00Z") }),
    ];
    const groups = findGroups(txs);
    expect(groups.some((g) => g.reason === "bank_plus_merchant")).toBe(true);
    expect(groups[0].primaryEmailId).toBe("e2");
  });

  it("fuzzy matches merchants with Levenshtein similarity", () => {
    const txs = [
      makeTx({ _emailId: "e1", source: "scb_card", amount: 500, merchant: "McDonalds Gulshan", transactionDate: new Date("2026-03-22T15:55:00Z") }),
      makeTx({ _emailId: "e2", source: "llm_service", amount: 502, merchant: "McDonald's", transactionDate: new Date("2026-03-22T15:53:00Z") }),
    ];
    const groups = findGroups(txs);
    expect(groups.some((g) => g.reason === "bank_plus_merchant")).toBe(true);
  });
});
