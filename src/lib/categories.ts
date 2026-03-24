import { supabase } from "./supabase";

const DEFAULT_RULES: [RegExp, string][] = [
  [/foodpanda|kfc|fish\s*&?\s*co|madchef|herfy|iftarwala|gloria.*jean|peyala|cafe|coffee|restaurant|pizza|burger|bakery/i, "food"],
  [/uber(?!.*one)/i, "transport"],
  [/spotify|anthropic|claude\.ai|google\s*play|uber\s*one|trackingmore|microsoft/i, "subscription"],
  [/shwapno/i, "groceries"],
  [/pharmacy|ramna/i, "health"],
  [/dhl/i, "shipping"],
  [/axaro|white\s*tailor|daraz|amazon|chaldal/i, "shopping"],
  [/persona|renaissance|hotel|radisson/i, "lifestyle"],
];

let userRulesCache: { pattern: string; category: string }[] | null = null;

export async function loadUserCategoryRules() {
  const { data } = await supabase.from("category_rules").select("*");
  userRulesCache = data || [];
}

export function autoAssignCategory(merchant: string | null): string {
  if (!merchant) return "other";

  if (userRulesCache) {
    const normalized = merchant.toLowerCase();
    for (const rule of userRulesCache) {
      if (normalized.includes(rule.pattern)) return rule.category;
    }
  }

  for (const [pattern, category] of DEFAULT_RULES) {
    if (pattern.test(merchant)) return category;
  }

  return "other";
}
