import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const month = params.get("month");
  const category = params.get("category");
  const type = params.get("type");
  const search = params.get("search");
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "50");

  let query = supabase.from("transactions")
    .select("*, emails(gmail_message_id, sender, subject)", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1).toISOString();
    const end = new Date(year, mon, 1).toISOString();
    query = query.gte("transaction_date", start).lt("transaction_date", end);
  }
  if (category) query = query.eq("category", category);
  if (type) query = query.eq("type", type);
  if (search) query = query.or(`merchant.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get grouped info
  const txIds = (data || []).map((t) => t.id);
  let groupData: { primary_transaction_id: string; linked_transaction_id: string }[] = [];
  if (txIds.length > 0) {
    const { data: groups } = await supabase.from("transaction_groups").select("*")
      .or(`primary_transaction_id.in.(${txIds.join(",")}),linked_transaction_id.in.(${txIds.join(",")})`);
    groupData = groups || [];
  }

  return NextResponse.json({ transactions: data || [], groups: groupData, total: count || 0, page, limit });
}
