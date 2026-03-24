import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getGmailClient, searchEmails, readEmail } from "@/lib/gmail";
import { routeEmail } from "@/lib/parsers/router";
import { findGroups, TransactionWithEmail } from "@/lib/grouping";
import { EmailInput } from "@/lib/parsers/types";
import { loadUserCategoryRules } from "@/lib/categories";

const SEARCH_QUERY = [
  "from:SMSBanking.BD@sc.com",
  "from:iBanking.Bangladesh@sc.com",
  "from:noreply@citybankplc.com",
  "from:citytouch@thecitybank.com",
  "from:info@mail.foodpanda.com.bd",
  "from:noreply@uber.com",
  "from:uberone@uber.com",
  "from:no-reply@spotify.com",
  "from:invoice+statements@mail.anthropic.com",
  "from:googleplay-noreply@google.com",
  "from:BD.ebilling@dhl.com",
].join(" OR ");

export async function GET() {
  const { data: syncState } = await supabase
    .from("sync_state").select("*").eq("id", 1).single();

  // Auto-clear stale locks older than 5 minutes
  let syncing = syncState?.syncing || false;
  if (syncing && syncState?.syncing_started_at) {
    const elapsed = Date.now() - new Date(syncState.syncing_started_at).getTime();
    if (elapsed > 5 * 60 * 1000) {
      await supabase.from("sync_state").update({ syncing: false }).eq("id", 1);
      syncing = false;
    }
  }

  return NextResponse.json({
    syncing,
    lastSyncAt: syncState?.last_sync_at,
  });
}

export async function POST() {
  try {
    // 0. Check if already syncing (server-side lock)
    const { data: syncState } = await supabase
      .from("sync_state").select("*").eq("id", 1).single();

    // Auto-clear stale locks older than 5 minutes
    if (syncState?.syncing && syncState?.syncing_started_at) {
      const elapsed = Date.now() - new Date(syncState.syncing_started_at).getTime();
      if (elapsed <= 5 * 60 * 1000) {
        return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
      }
      // Stale lock — clear it and proceed
    } else if (syncState?.syncing) {
      return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
    }

    // Mark as syncing with timestamp
    await supabase.from("sync_state").update({ syncing: true, syncing_started_at: new Date().toISOString() }).eq("id", 1);

    // 0b. Load user category rules
    await loadUserCategoryRules();

    const lastSyncAt = syncState?.last_sync_at;

    // 2. Build query with date filter
    let query = `{${SEARCH_QUERY}}`;
    if (lastSyncAt) {
      const date = new Date(lastSyncAt);
      const after = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
      query += ` after:${after}`;
    }

    // 3. Fetch emails from Gmail
    const gmail = await getGmailClient();
    // Limit batch size to fit within Vercel's 60s function timeout
    // ~100 emails per sync; user can sync multiple times to catch up
    const messageRefs = await searchEmails(gmail, query, 100);
    if (messageRefs.length === 0) {
      return NextResponse.json({ synced: 0, grouped: 0, skipped: 0 });
    }

    // 4. Filter already-processed
    const messageIds = messageRefs.map((m) => m.id!);
    const { data: existingEmails } = await supabase
      .from("emails").select("gmail_message_id").in("gmail_message_id", messageIds);
    const existingIds = new Set((existingEmails || []).map((e) => e.gmail_message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));
    if (newMessageIds.length === 0) {
      return NextResponse.json({ synced: 0, grouped: 0, skipped: 0 });
    }

    // 5. Read and parse each email
    const parsedResults: { email: EmailInput; tx: TransactionWithEmail; parserUsed: string }[] = [];
    let skipped = 0;

    for (const msgId of newMessageIds) {
      const emailData = await readEmail(gmail, msgId);
      const emailInput: EmailInput = {
        messageId: emailData.messageId, threadId: emailData.threadId,
        from: emailData.from, subject: emailData.subject,
        body: emailData.body, snippet: emailData.snippet,
        date: emailData.date, internalDate: emailData.internalDate,
      };

      const { parser, parse } = routeEmail(emailInput);

      if (parser === "skip") {
        skipped++;
        await supabase.from("emails").insert({
          gmail_message_id: emailData.messageId, sender: emailData.from,
          subject: emailData.subject, snippet: emailData.snippet,
          email_date: emailData.internalDate.toISOString(), parser_used: "skip",
        });
        continue;
      }

      const result = await parse();
      if (result.status === "skip") {
        skipped++;
        await supabase.from("emails").insert({
          gmail_message_id: emailData.messageId, sender: emailData.from,
          subject: emailData.subject, snippet: emailData.snippet,
          email_date: emailData.internalDate.toISOString(), parser_used: parser,
        });
        continue;
      }

      parsedResults.push({
        email: emailInput,
        tx: { ...result.transaction, _emailId: emailData.messageId },
        parserUsed: parser,
      });
    }

    // 6. Run grouping
    const allTxs = parsedResults.map((r) => r.tx);
    const groups = findGroups(allTxs);

    // 7. Insert transactions and emails
    const emailIdToTxId: Record<string, string> = {};
    for (const { email, tx, parserUsed } of parsedResults) {
      const { data: txRow } = await supabase.from("transactions").insert({
        amount: tx.amount, currency: tx.currency, type: tx.type,
        category: tx.category, merchant: tx.merchant, description: tx.description,
        transaction_date: tx.transactionDate.toISOString(), source: tx.source,
        raw_data: tx.rawData,
      }).select("id").single();

      const txId = txRow?.id;
      if (txId) emailIdToTxId[tx._emailId] = txId;

      await supabase.from("emails").insert({
        gmail_message_id: email.messageId, transaction_id: txId || null,
        sender: email.from, subject: email.subject, snippet: email.snippet,
        email_date: email.internalDate.toISOString(), parser_used: parserUsed,
      });
    }

    // 8. Insert groups
    for (const group of groups) {
      const primaryTxId = emailIdToTxId[group.primaryEmailId];
      const linkedTxId = emailIdToTxId[group.linkedEmailId];
      if (primaryTxId && linkedTxId) {
        await supabase.from("transaction_groups").insert({
          primary_transaction_id: primaryTxId,
          linked_transaction_id: linkedTxId,
          group_reason: group.reason,
        });
      }
    }

    // 9. Update sync state and clear lock
    // On first sync (no lastSyncAt), only set last_sync_at once the full backlog
    // is processed (fetched < 100). This lets repeated syncs catch up on history.
    const allCaughtUp = lastSyncAt || messageRefs.length < 100;
    await supabase.from("sync_state")
      .update({
        last_sync_at: allCaughtUp ? new Date().toISOString() : null,
        syncing: false,
        syncing_started_at: null,
      }).eq("id", 1);

    const hasMore = !lastSyncAt && messageRefs.length >= 100;
    return NextResponse.json({ synced: parsedResults.length, grouped: groups.length, skipped, hasMore });
  } catch (error) {
    // Clear lock on failure
    await supabase.from("sync_state").update({ syncing: false, syncing_started_at: null }).eq("id", 1);
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
