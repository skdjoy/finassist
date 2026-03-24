import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { normalizeMerchant } from "@/lib/merchant-utils";
import { autoAssignCategory, loadUserCategoryRules } from "@/lib/categories";

export async function POST() {
  try {
    await loadUserCategoryRules();

    // Fetch all transactions
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

    return NextResponse.json({ updated, total: transactions.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Cleanup failed" }, { status: 500 });
  }
}
