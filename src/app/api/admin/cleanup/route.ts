import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeMerchant } from "@/lib/merchant-utils";
import { autoAssignCategory, loadUserCategoryRules } from "@/lib/categories";

export async function POST() {
  try {
    await loadUserCategoryRules();

    // Fix City Bank deposits: category "transfer" -> "income"
    const { count: cityBankFixed } = await supabase
      .from("transactions")
      .update({ category: "income" }, { count: "exact" })
      .eq("source", "citybank_deposit").eq("type", "income").eq("category", "transfer");

    // Reclassify ATM withdrawals from "transfer" to "withdrawal"
    const { count: withdrawalsFixed } = await supabase
      .from("transactions")
      .update({ type: "withdrawal", category: "withdrawal" }, { count: "exact" })
      .eq("source", "scb_card").eq("type", "transfer").like("description", "Withdrawal%");

    // Fetch all transactions for merchant normalization and re-categorization
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("id, merchant, category");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!transactions) return NextResponse.json({ updated: 0 });

    let updated = 0;
    for (const tx of transactions) {
      const original = tx.merchant || "";
      const cleaned = normalizeMerchant(original);
      const newCategory = autoAssignCategory(cleaned);

      // Only update if something changed
      const merchantChanged = cleaned !== original && cleaned.length > 0;
      const categoryChanged = newCategory !== "other" && newCategory !== tx.category;

      if (merchantChanged || categoryChanged) {
        const updates: Record<string, string> = {};
        if (merchantChanged) updates.merchant = cleaned;
        if (categoryChanged) updates.category = newCategory;

        await supabase.from("transactions").update(updates).eq("id", tx.id);
        updated++;
      }
    }

    return NextResponse.json({
      updated, total: transactions.length,
      cityBankFixed: cityBankFixed || 0,
      withdrawalsFixed: withdrawalsFixed || 0,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cleanup failed" }, { status: 500 });
  }
}
