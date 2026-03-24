import { google } from "googleapis";
import { supabase } from "./supabase";

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
}

export async function handleCallback(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);

  await supabase.from("gmail_tokens").upsert({
    id: 1,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
  });

  return tokens;
}

export async function getGmailClient() {
  const { data: tokenRow } = await supabase
    .from("gmail_tokens")
    .select("*")
    .eq("id", 1)
    .single();

  if (!tokenRow || !tokenRow.refresh_token) {
    throw new Error("Gmail not connected");
  }

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    expiry_date: tokenRow.expiry ? new Date(tokenRow.expiry).getTime() : undefined,
  });

  const { credentials } = await client.refreshAccessToken();
  if (credentials.access_token !== tokenRow.access_token) {
    await supabase.from("gmail_tokens").update({
      access_token: credentials.access_token,
      expiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
    }).eq("id", 1);
  }

  return google.gmail({ version: "v1", auth: client });
}

export async function searchEmails(
  gmail: ReturnType<typeof google.gmail>,
  query: string,
  maxResults = 100
) {
  const res = await gmail.users.messages.list({ userId: "me", q: query, maxResults });
  return res.data.messages || [];
}

export async function readEmail(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });

  const headers = res.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  let body = "";
  const payload = res.data.payload;
  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload?.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    } else {
      const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
      if (htmlPart?.body?.data) {
        body = Buffer.from(htmlPart.body.data, "base64")
          .toString("utf-8")
          .replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">")
          .replace(/&quot;/gi, '"')
          .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
          .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/\s+/g, " ")
          .trim();
      }
    }
  }

  return {
    messageId: res.data.id!,
    threadId: res.data.threadId!,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    date: getHeader("Date"),
    snippet: res.data.snippet || "",
    body,
    internalDate: res.data.internalDate ? new Date(parseInt(res.data.internalDate)) : new Date(),
  };
}
