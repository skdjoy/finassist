import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const { data: usernameRow } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "username")
    .single();

  const { data: hashRow } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "password_hash")
    .single();

  if (!usernameRow || !hashRow) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (username !== usernameRow.value || !(await verifyPassword(password, hashRow.value))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createToken(username);
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
