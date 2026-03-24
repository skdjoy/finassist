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

// Separate updates so one failing field can't break the other
// Note: last_history_id is repurposed as sync start timestamp for stale lock detection
async function clearSyncLock() {
  const { error } = await supabase.from("sync_state")
    .update({ syncing: false, last_history_id: null })
    .eq("id", 1);
  if (error) console.error("Failed to clear sync lock:", error.message);
}

async function setLastSyncAt(timestamp: string) {
  const { error } = await supabase.from("sync_state")
    .update({ last_sync_at: timestamp })
    .eq("id", 1);
  if (error) console.error("Failed to update last_sync_at:", error.message);
}

export async function GET() {
  const { data: syncState } = await supabase
    .from("sync_state").select("*").eq("id", 1).single();

  // Auto-clear stale locks older than 5 minutes
  let syncing = syncState?.syncing || false;
  if (syncing && syncState?.last_history_id) {
    const elapsed = Date.now() - new Date(syncState.last_history_id).getTime();
    if (elapsed > 5 * 60 * 1000) {
      await clearSyncLock();
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
    if (syncState?.syncing && syncState?.last_history_id) {
      const elapsed = Date.now() - new Date(syncState.last_history_id).getTime();
      if (elapsed <= 5 * 60 * 1000) {
        return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
      }
      // Stale lock — clear it and proceed
    } else if (syncState?.syncing) {
      return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
    }

    // Mark as syncing with timestamp (last_history_id repurposed as sync start time)
    const { error: lockError } = await supabase.from("sync_state")
      .update({ syncing: true, last_history_id: new Date().toISOString() })
      .eq("id", 1);
    if (lockError) console.error("Failed to set sync lock:", lockError.message);

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
      const now = new Date().toISOString();
      await setLastSyncAt(now);
      await clearSyncLock();
      return NextResponse.json({
        synced: 0, grouped: 0, skipped: 0, errors: [],
        hasMore: false, lastSyncAt: now,
        breakdown: { byParser: {}, byType: {} },
      });
    }

    // 4. Filter already-processed — abort on query error
    const messageIds = messageRefs.map((m) => m.id!);
    const { data: existingEmails, error: dedupError } = await supabase
      .from("emails").select("gmail_message_id").in("gmail_message_id", messageIds);
    if (dedupError) {
      await clearSyncLock();
      return NextResponse.json(
        { error: `Dedup check failed: ${dedupError.message}` },
        { status: 500 }
      );
    }
    const existingIds = new Set((existingEmails || []).map((e) => e.gmail_message_id));
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));
    if (newMessageIds.length === 0) {
      const now = new Date().toISOString();
      await setLastSyncAt(now);
      await clearSyncLock();
      return NextResponse.json({
        synced: 0, grouped: 0, skipped: 0, errors: [],
        hasMore: false, lastSyncAt: now,
        breakdown: { byParser: {}, byType: {} },
      });
    }

    // 5. Read and parse each email — per-email try-catch
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
        const { error: insertErr } = await supabase.from("emails").insert({
          gmail_message_id: msgId,
          sender: "unknown",
          email_date: new Date().toISOString(),
          parser_used: "error",
        });
        if (insertErr && !insertErr.message.includes("duplicate")) {
          console.error("Failed to insert error email record:", insertErr.message);
        }
      }
    }

    // 6. Run grouping
    const allTxs = parsedResults.map((r) => r.tx);
    const groups = findGroups(allTxs);

    // 7. Insert email FIRST (dedup gate via UNIQUE gmail_message_id), then transaction
    let insertedCount = 0;
    const emailIdToTxId: Record<string, string> = {};
    for (const { email, tx, parserUsed } of parsedResults) {
      // Email insert acts as the authoritative dedup — UNIQUE constraint prevents duplicates
      const { data: emailRow, error: emailError } = await supabase.from("emails").insert({
        gmail_message_id: email.messageId, sender: email.from,
        subject: email.subject, snippet: email.snippet,
        email_date: email.internalDate.toISOString(), parser_used: parserUsed,
      }).select("id").single();

      if (emailError) {
        // UNIQUE violation = already processed, skip silently
        if (!emailError.message.includes("duplicate")) {
          errors.push({
            messageId: tx._emailId, sender: email.from,
            subject: email.subject, error: `Email insert failed: ${emailError.message}`,
          });
        }
        continue; // Do NOT create transaction — email already exists
      }

      // Now insert transaction (only if email insert succeeded)
      const { data: txRow, error: txError } = await supabase.from("transactions").insert({
        amount: tx.amount, currency: tx.currency, type: tx.type,
        category: tx.category, merchant: tx.merchant, description: tx.description,
        transaction_date: tx.transactionDate.toISOString(), source: tx.source,
        raw_data: tx.rawData,
      }).select("id").single();

      if (txError || !txRow?.id) {
        errors.push({
          messageId: tx._emailId, sender: email.from,
          subject: email.subject,
          error: `Transaction insert failed: ${txError?.message || "no id returned"}`,
        });
        continue;
      }

      // Link email to transaction
      await supabase.from("emails").update({ transaction_id: txRow.id }).eq("id", emailRow.id);
      emailIdToTxId[tx._emailId] = txRow.id;
      insertedCount++;
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

    // 10. Update sync state — separate calls so one can't break the other
    const processedNew = parsedResults.length + skipped + errors.length;
    const hasMore = !lastSyncAt && messageRefs.length >= 100 && processedNew > 0;
    const now = new Date().toISOString();

    if (!hasMore) {
      await setLastSyncAt(now);
      await clearSyncLock();
    } else {
      // Keep lock active between batches, refresh timestamp
      const { error } = await supabase.from("sync_state")
        .update({ syncing: true, last_history_id: new Date().toISOString() })
        .eq("id", 1);
      if (error) console.error("Failed to refresh sync lock:", error.message);
    }

    return NextResponse.json({
      synced: insertedCount,
      grouped: groups.length,
      skipped,
      errors,
      hasMore,
      lastSyncAt: !hasMore ? now : null,
      breakdown: { byParser, byType },
    });
  } catch (error) {
    // Clear lock on failure — separate call
    await clearSyncLock();
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
