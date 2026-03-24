import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Delete in order respecting foreign keys
    await supabase.from("transaction_groups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("emails").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Reset sync state — separate calls so one failing field can't break the other
    await supabase.from("sync_state").update({ last_sync_at: null }).eq("id", 1);
    await supabase.from("sync_state").update({ syncing: false, syncing_started_at: null }).eq("id", 1);

    return NextResponse.json({ success: true, message: "All data cleared. Next sync will be a fresh first scan." });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Reset failed" }, { status: 500 });
  }
}
