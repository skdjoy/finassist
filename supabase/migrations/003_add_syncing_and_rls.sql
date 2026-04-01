-- 1. Add missing syncing column to sync_state
ALTER TABLE sync_state ADD COLUMN IF NOT EXISTS syncing BOOLEAN DEFAULT false;

-- 2. Enable Row-Level Security on all tables
-- The app uses the service role key (bypasses RLS), so no policies needed.
-- This blocks direct access via the anon/public key.
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
