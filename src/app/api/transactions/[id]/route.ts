import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { category } = body;

  const { data, error } = await supabase.from("transactions")
    .update({ category }).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (data?.merchant) {
    await supabase.from("category_rules").upsert(
      { merchant_pattern: data.merchant.toLowerCase(), category },
      { onConflict: "merchant_pattern" }
    );
  }

  return NextResponse.json(data);
}
