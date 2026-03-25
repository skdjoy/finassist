import { describe, it, expect } from "vitest";
import { autoAssignCategory } from "@/lib/categories";

describe("autoAssignCategory", () => {
  const cases: [string, string][] = [
    // Food
    ["Foodpanda Bangladesh Limi+880168152343BD", "food"],
    ["KFC Gulshan 412 Dhaka BD", "food"],
    ["Fish & Co. Bangladesh Dhaka BD", "food"],
    ["GLORIA JEAN'S COFFEES DHAKA BD", "food"],
    ["PEYALA CAFE GULSHAN ModelBD", "food"],
    ["Madchef Banani", "food"],
    // Transport
    ["Uber BV Trip", "transport"],
    // Subscription
    ["Spotify Stockholm SE", "subscription"],
    ["ANTHROPIC +14152360599 US", "subscription"],
    ["CLAUDE.AI SUBSCRIPTION +14152360599 US", "subscription"],
    ["Google Play Apps", "subscription"],
    ["Uber One Membership", "subscription"],
    ["Microsoft*Store Singapore SG", "subscription"],
    // Groceries
    ["SHWAPNO-GULSHAN- 1 DHAKA BD", "groceries"],
    ["SHWAPNO(GULSHAN1) DHAKA BD", "groceries"],
    // Health
    ["Pharmacy Plus Gulshan", "health"],
    // Shipping
    ["DHL Express BD", "shipping"],
    // Shopping
    ["Axaro Online Store", "shopping"],
    ["Amazon US Order", "shopping"],
    ["Daraz BD", "shopping"],
    // Lifestyle
    ["Persona(gulshan-2) Dhaka BD", "lifestyle"],
    ["RENAISSANCE DHAKA GULSHANDHAKA BD", "lifestyle"],
    ["Radisson Blu Chattogram", "lifestyle"],
    // Dining
    ["Steakhouse Grill Banani", "dining"],
    ["Sushi Bar Gulshan", "dining"],
    // Entertainment
    ["Netflix Monthly", "entertainment"],
    ["Cinema Star Dhanmondi", "entertainment"],
    // Utilities
    ["Grameenphone Bill", "utilities"],
    ["Electricity Board Payment", "utilities"],
    ["Internet Broadband Link3", "utilities"],
    // Education
    ["Udemy Course Purchase", "education"],
    ["Coursera Subscription", "education"],
    // Fallback
    ["Random Unknown Merchant", "other"],
    ["ONE MANAGEMENT LTD Gulshan ModelBD", "other"],
  ];

  it.each(cases)("categorizes '%s' as '%s'", (merchant, expected) => {
    expect(autoAssignCategory(merchant)).toBe(expected);
  });
});
