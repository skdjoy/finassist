import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST() {
  try {
    // Add syncing column to sync_state if it doesn't exist
    // We use a simple approach: try to update, if the column doesn't exist, use rpc
    const { error } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS syncing boolean DEFAULT false;",
    });

    if (error) {
      // Fallback: try direct update to check if column exists
      const { error: updateErr } = await supabase
        .from("sync_state").update({ syncing: false }).eq("id", 1);
      if (updateErr) {
        return NextResponse.json({ error: `Column may not exist: ${updateErr.message}. Run manually: ALTER TABLE sync_state ADD COLUMN syncing boolean DEFAULT false;` }, { status: 500 });
      }
      return NextResponse.json({ message: "Column already exists" });
    }

    return NextResponse.json({ success: true, message: "Migration complete: added syncing column" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Migration failed" }, { status: 500 });
  }
}
