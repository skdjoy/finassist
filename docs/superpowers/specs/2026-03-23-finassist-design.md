# FinAssist — Personal Finance Email Tracker

**Date:** 2026-03-23
**Status:** Approved

## Overview

Single-user personal finance app that connects to Gmail, reads transaction emails from Bangladeshi banks and services, stores structured data in Supabase, and provides a dashboard with analytics. Deployed on Vercel.

## User

- Single user (Sowvik), Bangladesh-based
- Banks: Standard Chartered Bank BD, The City Bank Limited
- Mobile financial service: bKash (via City Bank Citytouch)
- Services: Foodpanda, Uber, Spotify, Anthropic, Google Play, DHL, various e-commerce

## Tech Stack

- **Frontend:** Next.js (App Router) on Vercel
- **Backend:** Supabase (PostgreSQL + Auth storage)
- **Charts:** Recharts
- **UI:** shadcn/ui + Tailwind CSS
- **LLM:** Claude API (for service email parsing only)
- **Gmail:** Google Gmail API with OAuth 2.0

## Architecture: Hybrid Parsing (Approach C)

Regex parsers for well-structured bank emails. LLM parsing for service emails with variable HTML. Rule-based multi-email grouping.

## Data Model

### `transactions`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| amount | decimal | BDT amount |
| currency | text | Always "BDT" |
| type | enum | `expense`, `income`, `transfer`, `top_up` |
| category | text | `food`, `transport`, `subscription`, `shopping`, `health`, `groceries`, `transfer`, `top_up`, `lifestyle`, `shipping`, `other` |
| merchant | text | Normalized merchant name |
| description | text | Human-readable summary |
| transaction_date | timestamptz | When the transaction happened |
| source | text | Parser that produced this (`scb_card`, `scb_transfer`, `scb_cc_payment`, `citybank_deposit`, `citytouch_bkash`, `llm_service`) |
| raw_data | jsonb | All parsed fields (card, account, reference, balance, etc.) |
| created_at | timestamptz | Row creation time |

### `emails`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| gmail_message_id | text | Unique, dedup key |
| transaction_id | uuid | FK to transactions (nullable) |
| sender | text | From address |
| subject | text | Email subject |
| snippet | text | Gmail snippet |
| email_date | timestamptz | Email date |
| parser_used | text | Which parser handled it |
| created_at | timestamptz | Row creation time |

### `transaction_groups`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| primary_transaction_id | uuid | FK, the main transaction |
| linked_transaction_id | uuid | FK, the duplicate/related |
| group_reason | text | `scb_transfer_pair`, `bank_plus_merchant`, `bkash_topup_pair` |

### `budgets`

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| month | date | First of month |
| category | text | Nullable (null = overall) |
| amount | decimal | Budget limit in BDT |

### `sync_state`

| Column | Type | Description |
|--------|------|-------------|
| id | int | Always 1 |
| last_sync_at | timestamptz | Last successful sync |
| last_history_id | text | Gmail history ID |

### `gmail_tokens`

| Column | Type | Description |
|--------|------|-------------|
| id | int | Always 1 |
| access_token | text | Encrypted |
| refresh_token | text | Encrypted |
| expiry | timestamptz | Token expiry |

### `app_config`

| Column | Type | Description |
|--------|------|-------------|
| key | text | Primary key |
| value | text | Config value |

Used for storing hashed app password, username, etc.

## Email Sources & Parsers

### Regex Parsers (Bank Emails)

#### 1. `scb_card` — SCB Card Transaction Alert
- **From:** `SMSBanking.BD@sc.com`
- **Subject:** "Standard Chartered Transaction Alert"
- **Body patterns:**
  - Local: `"A local [e-]transaction of BDT {amount} was made using your card ending with {card} at {merchant} on {date}"`
  - International: `"An international e-transaction equivalent to BDT {amount} was made using your card ending with {card} at {merchant} on {date}"`
  - Withdrawal: `"BDT {amount} was withdrawn from Acc. ending {account} on {date}. Your available balance is now BDT {balance}"`
- **Extracts:** amount, card/account, merchant+location, date, available credit/balance
- **Type mapping:** expense (card purchases), transfer (withdrawals)

#### 2. `scb_transfer` — SCB Domestic Transfer
- **From:** `iBanking.Bangladesh@sc.com`
- **Subject:** "Domestic Transfer - NPS -{Submitted|Successful}"
- **Body fields:** Transfer To, Payment Reference Number, Payment Amount, Transfer From, Beneficiary Name, Beneficiary Bank Name, Status
- **Extracts:** amount, reference, beneficiary, bank name, status
- **Type mapping:** transfer
- **Note:** Only process "Successful" emails. Link "Submitted" as grouped.

#### 3. `scb_cc_payment` — SCB Credit Card Payment
- **From:** `iBanking.Bangladesh@sc.com`
- **Subject:** "Credit Card Payment Confirmation"
- **Body fields:** Payment Currency, Debit Account Number, Card Number, Debit Amount, Transaction Amount, Reference No
- **Extracts:** amount, card, account, reference
- **Type mapping:** transfer (internal — paying off credit card)

#### 4. `citybank_deposit` — City Bank Deposit Alert
- **From:** `noreply@citybankplc.com`
- **Subject pattern:** `"BDT {amount} Deposited to A/C {account}"`
- **Snippet fields:** Account, Account Type, Date, Amount, Available Balance
- **Extracts:** amount, account, date, balance
- **Type mapping:** income (if standalone) or grouped with transfer

#### 5. `citytouch_bkash` — Citytouch bKash Transfer
- **From:** `citytouch@thecitybank.com`
- **Subject:** "You made a Mobile Wallet Transfer"
- **Body fields:** Transaction Type, Transferred Amount, Service Charge, VAT, Total Amount, From Account/Card, Beneficiary Wallet Number, Date and Time, Reference Number
- **Extracts:** amount, charges, wallet number, reference, date
- **Type mapping:** top_up

#### SKIP rules
- **From:** `iBanking.Bangladesh@sc.com` + Subject contains "ETAC" → Skip (OTP)
- **From:** `promotions@citybankplc.com` → Skip (promotional)
- **From:** `citytouchpromotion@thecitybank.com` → Skip (promotional)
- **From:** `DigitalBanking.BD@sc.com` → Skip (promotional)

### LLM Parser (Service Emails)

For emails from: Foodpanda, Uber, Spotify, Anthropic, Google Play, DHL, Axaro, White Tailor, and any other unrecognized transaction emails.

**Prompt structure:** Send email body text to Claude API with instruction to extract:
```json
{
  "amount": number,
  "currency": "BDT",
  "original_currency": "BDT | USD",
  "original_amount": "number (if different from BDT amount)",
  "merchant": "string",
  "items": [{ "name": "string", "quantity": number, "price": number }],
  "date": "ISO date",
  "category": "food | transport | subscription | shopping | health | shipping | other",
  "description": "one-line summary"
}
```

**Known service senders for routing:**
- `info@mail.foodpanda.com.bd`
- `noreply@uber.com`, `uberone@uber.com`
- `no-reply@spotify.com`
- `invoice+statements@mail.anthropic.com`
- `googleplay-noreply@google.com`
- `BD.ebilling@dhl.com`

## Multi-Email Grouping

After all emails in a sync batch are parsed, run grouping rules:

### Rule 1: SCB Transfer Pair
- Match: SCB "Submitted" + SCB "Successful" with same Payment Reference Number
- Action: Keep Successful as primary, link Submitted

### Rule 2: SCB Transfer + City Bank Deposit
- Match: SCB Successful transfer to City Bank + City Bank deposit
- Conditions: Same amount (±1 BDT), within 30-minute window
- Action: Keep SCB transfer as primary (has richer data), link deposit. Mark type as `transfer`.
- Group reason: `scb_citybank_transfer_pair`

### Rule 3: Bank Alert + Service Email
- Match: SCB card alert + service email (Foodpanda/Uber/Spotify etc.)
- Conditions: Same amount (±5 BDT for rounding/fees), within 60-minute window, merchant name fuzzy match
- Action: Keep service email as primary (has itemized data), link bank alert.

### Rule 4: bKash Top-up Chain
- Match: Citytouch bKash transfer + City Bank deposit (that funded it)
- Conditions: Same amount, within 30-minute window
- Action: Keep Citytouch as primary, link deposit. Mark type as `top_up`.

## Category Auto-Assignment

| Merchant pattern | Category |
|-----------------|----------|
| Foodpanda, KFC, Fish & Co, Madchef, Herfy, Iftarwala | `food` |
| Uber (trip receipts) | `transport` |
| Spotify, Anthropic, Google Play, Uber One, TrackingMore | `subscription` |
| Shwapno | `groceries` |
| Ramna Pharmacy | `health` |
| DHL | `shipping` |
| Axaro, White Tailor | `shopping` |
| Persona | `lifestyle` |
| SCB internal transfer, City Bank deposit (grouped) | `transfer` |
| bKash top-up | `top_up` |
| Unknown | `other` |

Users can re-categorize from the transaction list. Category overrides are stored in a `category_rules` table (merchant pattern → category) so future transactions from the same merchant auto-assign the corrected category.

## Frontend

### Pages

| Route | Purpose |
|-------|---------|
| `/login` | Username/password login |
| `/` | Dashboard with analytics |
| `/transactions` | Full transaction list with search/filter |
| `/budgets` | Set and track monthly budgets by category |
| `/settings` | Connect Gmail, manage categories |

### Dashboard Widgets

1. **Summary cards** — Total spent, income this month, expense change vs last month, budget utilization %
2. **Income vs Expenses chart** — Bar chart by month (Recharts)
3. **Spending by Category** — Donut chart
4. **Spending by Merchant** — Horizontal bar chart, top 10
5. **Top Expenses** — Table of largest transactions this month
6. **Budget Tracking** — Progress bars per category

### Month selector
- Dropdown in header to switch between months
- Dashboard and transaction list filter by selected month

### Transactions page
- Searchable, filterable table
- Filters: date range, category, merchant, type, source
- Grouped transactions show an indicator; click to expand linked emails
- Inline category editing (click category badge to change)

## Auth & Gmail Connection

### App Login
- Single hardcoded user
- Username + bcrypt-hashed password in `app_config` table
- `/api/auth/login` validates and returns JWT in httpOnly cookie
- Next.js middleware checks cookie on all routes except `/login`

### Gmail OAuth
- Google OAuth 2.0 with `gmail.readonly` scope
- Initiated from `/settings` page
- Tokens stored encrypted in `gmail_tokens` table
- Refresh token used to get fresh access tokens on each sync
- If token revoked, UI shows "Reconnect Gmail"

### Environment Variables (Vercel)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`

## Sync Flow

1. User clicks "Sync" button
2. API route `/api/sync` called
3. Read `sync_state` for `last_sync_at`
4. Gmail API search for transaction emails since last sync
5. Filter out already-processed emails (dedup on `gmail_message_id`)
6. Route each email to appropriate parser
7. Parse and normalize transaction data
8. Run multi-email grouping rules
9. Insert transactions, emails, and groups into Supabase
10. Update `sync_state`
11. Return sync summary (new transactions count, grouped count)

## Out of Scope

- Multi-user / multi-tenancy
- Automatic background sync
- SMS parsing
- Investment tracking
- Multi-currency conversion
- Mobile app
