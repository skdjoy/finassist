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

1. **Sync trigger** (`src/app/api/sync/route.ts`): User clicks Sync, fetches emails from known senders since last sync, deduplicates by `gmail_message_id`
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
- `sync_state`: Single row (id=1) tracking `last_sync_at`
- `category_rules`: User merchant->category overrides, queried at sync time

### Transaction Types

- `expense`: Card purchases, service charges
- `income`: Bank deposits (standalone)
- `transfer`: Inter-bank transfers, withdrawals, credit card payments
- `top_up`: bKash mobile wallet transfers

### Parser Sources

`scb_card`, `scb_transfer`, `scb_cc_payment`, `citybank_deposit`, `citytouch_bkash`, `llm_service`

### Frontend

Next.js App Router pages at `/`, `/transactions`, `/budgets`, `/settings`, `/login`. All use `"use client"` with fetch-based data loading. Charts via Recharts, UI via shadcn/ui + Tailwind.

Dashboard API (`/api/dashboard`) excludes linked (grouped) transactions from totals and returns 6-month trend data.

### Grouping Rules

| Rule | Match Criteria | Window | Primary |
|------|---------------|--------|---------|
| SCB transfer pair | Same reference number | - | Successful |
| SCB transfer + City Bank deposit | Amount ±1 BDT | 30 min | SCB transfer |
| Bank alert + service email | Amount ±5 BDT + fuzzy merchant | 60 min | Service email |
| bKash + City Bank deposit | Amount ±1 BDT | 30 min | bKash transfer |

### Testing

Tests live in `__tests__/`. Vitest with `@` path alias. `vitest.setup.ts` injects placeholder env vars so Supabase client doesn't fail at import time. Parser tests use real email body text from actual bank emails.
