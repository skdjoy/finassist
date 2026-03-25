import { supabase } from "./supabase";

const DEFAULT_RULES: [RegExp, string][] = [
  [/dining|dine|brunch|lunch|dinner|steakhouse|sushi|thai\s*food|chinese\s*food|indian\s*food|italian\s*food/i, "dining"],
  [/foodpanda|kfc|fish\s*&?\s*co|madchef|herfy|iftarwala|gloria.*jean|peyala|cafe|coffee|restaurant|pizza|burger|bakery/i, "food"],
  [/entertainment|cinema|movie|netflix|youtube\s*premium|gaming|steam|playstation/i, "entertainment"],
  [/electric|electricity|water\s*bill|gas\s*bill|internet|broadband|phone\s*bill|airtime|grameenphone|robi|banglalink|teletalk/i, "utilities"],
  [/education|tuition|course|udemy|coursera|school|university/i, "education"],
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
