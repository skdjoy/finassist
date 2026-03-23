import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/settings?error=no_code", req.url));
  }

  try {
    await handleCallback(code);
    return NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
  } catch (error) {
    console.error("Gmail OAuth error:", error);
    return NextResponse.redirect(new URL("/settings?error=oauth_failed", req.url));
  }
}
