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

interface SyncError {
  messageId: string;
  sender?: string;
  subject?: string;
  error: string;
}

async function updateLastSyncAt() {
  await supabase.from("sync_state").update({
    last_sync_at: new Date().toISOString(),
    syncing: false,
    syncing_started_at: null,
  }).eq("id", 1);
}

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
    const messageRefs = await searchEmails(gmail, query, 100);
    if (messageRefs.length === 0) {
      // BUG 1 FIX: Clear lock before early return
      await updateLastSyncAt();
      return NextResponse.json({
        synced: 0, grouped: 0, skipped: 0, errors: [],
        hasMore: false, lastSyncAt: new Date().toISOString(),
        breakdown: { byParser: {}, byType: {} },
      });
    }

    // 4. Filter already-processed
    const messageIds = messageRefs.map((m) => m.id!);
    const { data: existingEmails } = await supabase
      .from("emails").select("gmail_message_id").in("gmail_message_id", messageIds);
    const existingIds = new Set((existingEmails || []).map((e) => e.gmail_message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));
    if (newMessageIds.length === 0) {
      // BUG 1 FIX: Clear lock before early return
      await updateLastSyncAt();
      return NextResponse.json({
        synced: 0, grouped: 0, skipped: 0, errors: [],
        hasMore: false, lastSyncAt: new Date().toISOString(),
        breakdown: { byParser: {}, byType: {} },
      });
    }

    // 5. Read and parse each email — BUG 2 FIX: per-email try-catch
    const parsedResults: { email: EmailInput; tx: TransactionWithEmail; parserUsed: string }[] = [];
    let skipped = 0;
    const errors: SyncError[] = [];

    for (const msgId of newMessageIds) {
      try {
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
      } catch (err) {
        console.error(`Error processing email ${msgId}:`, err);
        errors.push({
          messageId: msgId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        // Insert error record so this email gets deduped on next sync
        try {
          await supabase.from("emails").insert({
            gmail_message_id: msgId,
            sender: "unknown",
            email_date: new Date().toISOString(),
            parser_used: "error",
          });
        } catch { /* ignore duplicate insert failures */ }
      }
    }

    // 6. Run grouping
    const allTxs = parsedResults.map((r) => r.tx);
    const groups = findGroups(allTxs);

    // 7. Insert transactions and emails — BUG 4 FIX: check insert errors
    const emailIdToTxId: Record<string, string> = {};
    for (const { email, tx, parserUsed } of parsedResults) {
      const { data: txRow, error: txError } = await supabase.from("transactions").insert({
        amount: tx.amount, currency: tx.currency, type: tx.type,
        category: tx.category, merchant: tx.merchant, description: tx.description,
        transaction_date: tx.transactionDate.toISOString(), source: tx.source,
        raw_data: tx.rawData,
      }).select("id").single();

      if (txError || !txRow?.id) {
        errors.push({
          messageId: tx._emailId,
          sender: email.from,
          subject: email.subject,
          error: `Transaction insert failed: ${txError?.message || "no id returned"}`,
        });
        // Still insert email for dedup
        await supabase.from("emails").insert({
          gmail_message_id: email.messageId, sender: email.from,
          subject: email.subject, snippet: email.snippet,
          email_date: email.internalDate.toISOString(), parser_used: parserUsed,
        });
        continue;
      }

      emailIdToTxId[tx._emailId] = txRow.id;

      await supabase.from("emails").insert({
        gmail_message_id: email.messageId, transaction_id: txRow.id,
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

    // 9. Build breakdown for response
    const byParser: Record<string, number> = {};
    const byType: Record<string, number> = {};
    for (const { parserUsed, tx } of parsedResults) {
      byParser[parserUsed] = (byParser[parserUsed] || 0) + 1;
      byType[tx.type] = (byType[tx.type] || 0) + 1;
    }

    // 10. Update sync state and clear lock
    // BUG 3 FIX: Guard hasMore with processedNew > 0 to prevent infinite loop
    const processedNew = parsedResults.length + skipped + errors.length;
    const hasMore = !lastSyncAt && messageRefs.length >= 100 && processedNew > 0;
    const allCaughtUp = !hasMore;
    const now = new Date().toISOString();
    await supabase.from("sync_state")
      .update({
        last_sync_at: allCaughtUp ? now : null,
        syncing: hasMore,
        syncing_started_at: hasMore ? syncState?.syncing_started_at : null,
      }).eq("id", 1);

    return NextResponse.json({
      synced: parsedResults.length,
      grouped: groups.length,
      skipped,
      errors,
      hasMore,
      lastSyncAt: allCaughtUp ? now : null,
      breakdown: { byParser, byType },
    });
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
