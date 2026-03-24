import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Delete in order respecting foreign keys
    await supabase.from("transaction_groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("emails").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Reset sync state — separate calls, capture errors for debugging
    const { error: e1 } = await supabase.from("sync_state").update({ last_sync_at: null }).eq("id", 1);
    const { error: e2 } = await supabase.from("sync_state").update({ syncing: false }).eq("id", 1);
    const { error: e3 } = await supabase.from("sync_state").update({ syncing_started_at: null }).eq("id", 1);

    // Read back to confirm
    const { data: state } = await supabase.from("sync_state").select("*").eq("id", 1).single();

    return NextResponse.json({
      success: true,
      message: "All data cleared. Next sync will be a fresh first scan.",
      debug: {
        updateErrors: { last_sync_at: e1?.message || null, syncing: e2?.message || null, syncing_started_at: e3?.message || null },
        stateAfterReset: state,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 500 });
  }
}
