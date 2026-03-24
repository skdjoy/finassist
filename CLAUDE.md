# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run test         # Run vitest once
npm run test:watch   # Vitest watch mode
npm run lint         # ESLint
```

Run a single test file:
```bash
npx vitest run __tests__/parsers/scb-card.test.ts
```

## Architecture

FinAssist is a single-user personal finance tracker that reads Gmail transaction emails, parses them into structured data, and displays analytics. Deployed on Vercel with Supabase backend.

### Email Processing Pipeline

The core flow is: **Gmail API -> Router -> Parsers -> Grouping -> Supabase**

1. **Sync trigger** (`src/app/api/sync/route.ts`): User clicks Sync, fetches emails from known senders since last sync, deduplicates by `gmail_message_id`. Per-email error handling skips bad emails (inserted with `parser_used: "error"` for dedup). Returns enriched response with breakdown by parser/type and error details.
2. **Router** (`src/lib/parsers/router.ts`): Matches sender address + subject to select a parser. Skips promotional/OTP emails.
3. **Regex parsers** (`src/lib/parsers/scb-card.ts`, `scb-transfer.ts`, `scb-cc-payment.ts`, `citybank-deposit.ts`, `citytouch-bkash.ts`): Extract amount, merchant, date from structured bank emails using regex
4. **LLM parser** (`src/lib/parsers/llm-service.ts`): Uses Claude Haiku for unstructured service emails (Foodpanda, Uber, Spotify, etc.)
5. **Grouping** (`src/lib/grouping.ts`): Links related emails as one transaction (e.g., SCB transfer submitted+successful, bank alert + merchant receipt). Uses amount matching, time windows (30-60 min), and fuzzy merchant matching.
6. **Categories** (`src/lib/categories.ts`): Auto-assigns categories. User overrides from `category_rules` table take priority over hardcoded regex defaults. Call `loadUserCategoryRules()` before parsing to populate the cache.

### Auth

- Simple JWT in httpOnly cookie, verified in `src/middleware.ts`
- Credentials stored in `app_config` Supabase table (username + bcrypt hash)
- Login/logout at `/api/auth/login` and `/api/auth/logout`
- Middleware allows `/login` and `/api/auth/*` without auth

### Gmail OAuth

- `src/lib/gmail.ts`: OAuth2 flow, token refresh, email search/read helpers
- Connect flow: `/api/gmail/connect` -> Google consent -> `/api/gmail/callback` -> tokens saved to `gmail_tokens` table
- Tokens auto-refresh on each sync

### Database (Supabase)

Schema in `supabase/migrations/001_initial_schema.sql`. Key tables:
- `transactions`: Core data (amount, type, category, merchant, source, raw_data JSONB)
- `emails`: Gmail message tracking, FK to transactions, dedup key on `gmail_message_id`
- `transaction_groups`: Links primary + linked transactions with a `group_reason`
- `budgets`: Monthly budgets per category (UNIQUE on month+category)
- `sync_state`: Single row (id=1) tracking `last_sync_at`, `syncing` (boolean lock), `last_history_id` (repurposed as sync start timestamp for stale lock detection, auto-clears after 5 min)
- `category_rules`: User merchant->category overrides, queried at sync time

### Transaction Types

- `expense`: Card purchases, service charges
- `income`: Bank deposits (standalone)
- `transfer`: Inter-bank transfers, withdrawals, credit card payments
- `top_up`: bKash mobile wallet transfers

### Parser Sources

`scb_card`, `scb_transfer`, `scb_cc_payment`, `citybank_deposit`, `citytouch_bkash`, `llm_service`, `skip`, `error`

### Frontend

Next.js App Router pages at `/`, `/transactions`, `/budgets`, `/settings`, `/login`. All use `"use client"` with fetch-based data loading. Charts via Recharts, UI via shadcn/ui + Tailwind. Toast notifications via Sonner. Navigation uses Next.js `<Link>` for client-side routing.

Dashboard API (`/api/dashboard`) excludes linked (grouped) transactions from totals and returns 6-month trend data (always backfills all 6 months even if empty), recurring charge detection, and spending insights.

### Styling

- **Theme system**: CSS variables use `oklch()` in `globals.css`, referenced as `var(--xxx)` in `tailwind.config.ts`. Do NOT wrap in `hsl()`.
- **Color tokens**: Use `bg-card`, `bg-muted/50`, `text-foreground`, `text-muted-foreground` — never hardcoded `bg-white`, `bg-gray-50`, `text-black`, `text-gray-500`.
- **Dark mode**: Variables defined in `globals.css` `.dark` block but not yet activated (next-themes installed, `darkMode: ["class"]` in tailwind config).

### Merchant Name Handling

- `src/lib/merchant-utils.ts`: `normalizeMerchant()` title-cases names and preserves known acronyms (KFC, ATM, DHL, SCB, LTD, etc.)
- Used in parsers for new data and in display components (transaction-table, top-expenses-table, merchant-bar-chart) for existing data
- `src/lib/gmail.ts`: HTML entity stripping (line 96-102) decodes `&nbsp;`, `&amp;`, numeric entities after tag removal

### Advanced Features

- **Category Rule Management**: API at `/api/category-rules` (GET/POST/DELETE), UI component `category-rules-manager.tsx` on Settings page
- **Recurring Detection**: `src/lib/recurring.ts` groups 3-month expenses by merchant, detects weekly/monthly patterns with consistent amounts (±10%)
- **Spending Insights**: `src/lib/insights.ts` generates alerts comparing current vs previous month (spending changes, budget warnings, category spikes)
- **Data Cleanup**: POST `/api/admin/cleanup` normalizes merchant names and re-categorizes existing transactions

### Grouping Rules

| Rule | Match Criteria | Window | Primary |
|------|---------------|--------|---------|
| SCB transfer pair | Same reference number | - | Successful |
| SCB transfer + City Bank deposit | Amount ±1 BDT | 30 min | SCB transfer |
| Bank alert + service email | Amount ±5 BDT + fuzzy merchant | 60 min | Service email |
| bKash + City Bank deposit | Amount ±1 BDT | 30 min | bKash transfer |

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sync` | GET | Sync status (`syncing`, `lastSyncAt`) |
| `/api/sync` | POST | Trigger email sync; returns `{ synced, grouped, skipped, errors[], hasMore, lastSyncAt, breakdown }` |
| `/api/dashboard` | GET | Dashboard data (expenses, trends, recurring, insights) |
| `/api/transactions` | GET | Paginated transactions (supports `page`, `limit`, `month`, `category`, `type`, `search`) |
| `/api/transactions/[id]` | PATCH | Update transaction (e.g., category change) |
| `/api/budgets` | GET/POST/DELETE | Budget CRUD |
| `/api/category-rules` | GET/POST/DELETE | Category rule CRUD |
| `/api/admin/cleanup` | POST | One-time data cleanup (normalize merchants, fix categories) |
| `/api/gmail/connect` | GET | Start Gmail OAuth flow |
| `/api/gmail/callback` | GET | Gmail OAuth callback |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |

### Testing

Tests live in `__tests__/`. Vitest with `@` path alias. `vitest.setup.ts` injects placeholder env vars so Supabase client doesn't fail at import time. Parser tests use real email body text from actual bank emails.

Test suites: `scb-card` (3), `scb-transfer` (1), `router` (9), `citybank-deposit` (1), `citytouch-bkash` (1), `grouping` (3), `categories` (25), `merchant-utils` (6). Total: 49 tests.
