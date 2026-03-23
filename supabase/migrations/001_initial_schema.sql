-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer', 'top_up')),
  category TEXT NOT NULL DEFAULT 'other',
  merchant TEXT,
  description TEXT,
  transaction_date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Emails table
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT UNIQUE NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  sender TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  email_date TIMESTAMPTZ,
  parser_used TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction groups
CREATE TABLE transaction_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  linked_transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_reason TEXT NOT NULL
);

-- Budgets
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  category TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  UNIQUE(month, category)
);

-- Sync state
CREATE TABLE sync_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_sync_at TIMESTAMPTZ,
  last_history_id TEXT
);

INSERT INTO sync_state (id) VALUES (1);

-- Gmail tokens
CREATE TABLE gmail_tokens (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token TEXT,
  refresh_token TEXT,
  expiry TIMESTAMPTZ
);

-- App config
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Category rules (user overrides)
CREATE TABLE category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_pattern TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_emails_gmail_id ON emails(gmail_message_id);
CREATE INDEX idx_emails_transaction ON emails(transaction_id);
CREATE INDEX idx_budgets_month ON budgets(month);
