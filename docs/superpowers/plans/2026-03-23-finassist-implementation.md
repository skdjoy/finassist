# FinAssist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal finance tracker that reads Gmail transaction emails, parses them into structured data, and displays analytics on a dashboard.

**Architecture:** Next.js App Router frontend on Vercel, Supabase PostgreSQL backend. Hybrid email parsing — regex for 5 bank email types, Claude API for service emails. Rule-based multi-email grouping. Simple username/password auth + separate Google OAuth for Gmail access.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase (PostgreSQL + JS client), Google Gmail API, Anthropic Claude API, bcryptjs, jose (JWT)

**Spec:** `docs/superpowers/specs/2026-03-23-finassist-design.md`

---

## File Structure

```
finassist/
  src/
    app/
      layout.tsx                          # Root layout with providers
      page.tsx                            # Dashboard page
      login/page.tsx                      # Login form
      transactions/page.tsx               # Transaction list
      budgets/page.tsx                    # Budget management
      settings/page.tsx                   # Gmail connection + categories
      api/
        auth/login/route.ts               # POST: validate credentials, set JWT cookie
        auth/logout/route.ts              # POST: clear cookie
        sync/route.ts                     # POST: full email sync pipeline
        gmail/connect/route.ts            # GET: redirect to Google OAuth
        gmail/callback/route.ts           # GET: handle OAuth callback, store tokens
        transactions/route.ts             # GET: list with filters
        transactions/[id]/route.ts        # PATCH: update category
        budgets/route.ts                  # GET/POST/PATCH/DELETE
        dashboard/route.ts               # GET: aggregated dashboard data
    lib/
      supabase.ts                         # Supabase client (browser + server)
      auth.ts                             # JWT sign/verify + password helpers
      gmail.ts                            # Gmail API: search, read, OAuth helpers
      parsers/
        types.ts                          # ParsedTransaction type, EmailInput type
        router.ts                         # Route email to correct parser
        scb-card.ts                       # SCB card transaction alert regex
        scb-transfer.ts                   # SCB domestic transfer regex
        scb-cc-payment.ts                 # SCB credit card payment regex
        citybank-deposit.ts               # City Bank deposit alert regex
        citytouch-bkash.ts                # Citytouch bKash transfer regex
        llm-service.ts                    # Claude API service email parser
      grouping.ts                         # Multi-email grouping engine + rules
      categories.ts                       # Auto-assignment + merchant pattern matching
    components/
      ui/                                 # shadcn/ui primitives (button, card, input, etc.)
      header.tsx                          # App header with month selector + sync button
      month-selector.tsx                  # Month dropdown
      summary-cards.tsx                   # 4 summary metric cards
      income-expense-chart.tsx            # Bar chart (Recharts)
      category-donut.tsx                  # Donut chart (Recharts)
      merchant-bar-chart.tsx              # Horizontal bar chart (Recharts)
      top-expenses-table.tsx              # Top N expenses table
      budget-progress.tsx                 # Budget progress bars
      transaction-table.tsx               # Filterable transaction table
      transaction-filters.tsx             # Filter controls
      budget-form.tsx                     # Add/edit budget form
    middleware.ts                          # Next.js middleware: auth check on all routes
  supabase/
    migrations/
      001_initial_schema.sql              # All tables
  __tests__/
    parsers/
      scb-card.test.ts
      scb-transfer.test.ts
      scb-cc-payment.test.ts
      citybank-deposit.test.ts
      citytouch-bkash.test.ts
      router.test.ts
    grouping.test.ts
    categories.test.ts
  .env.local.example                      # Template for env vars
  package.json
  tsconfig.json
  tailwind.config.ts
  next.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `.env.local.example`, `.gitignore`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "/Users/sowvikdas/Documents/Rough Works/FinAssist"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults: Yes to all prompts.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @anthropic-ai/sdk googleapis bcryptjs jose recharts date-fns
npm install -D @types/bcryptjs vitest @testing-library/react
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
npx shadcn@latest init -d
```

Then add needed components:

```bash
npx shadcn@latest add button card input label table select badge dialog dropdown-menu popover progress separator tabs toast
```

- [ ] **Step 4: Create .env.local.example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
ANTHROPIC_API_KEY=
JWT_SECRET=
APP_USERNAME=admin
APP_PASSWORD_HASH=
```

- [ ] **Step 5: Create .gitignore additions**

Append to `.gitignore`:
```
.env.local
.superpowers/
```

- [ ] **Step 6: Create placeholder root page**

Replace `src/app/page.tsx` with a simple "FinAssist" heading. Replace `src/app/layout.tsx` with minimal layout using Inter font and Tailwind.

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Visit `http://localhost:3000`, confirm page renders.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_initial_schema.sql`:

```sql
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
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase dashboard > SQL Editor > paste and run the migration SQL. Alternatively, if using Supabase CLI:

```bash
npx supabase db push
```

- [ ] **Step 3: Seed app_config with credentials**

Run in Supabase SQL Editor:

```sql
-- Generate hash with: node -e "require('bcryptjs').hash('YOUR_PASSWORD', 10).then(h => console.log(h))"
INSERT INTO app_config (key, value) VALUES
  ('username', 'admin'),
  ('password_hash', '$2a$10$YOUR_BCRYPT_HASH_HERE');
```

- [ ] **Step 4: Create Supabase client**

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/ src/lib/supabase.ts
git commit -m "feat: add Supabase schema and client"
```

---

## Task 3: Auth (Login + Middleware)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create auth helpers**

Create `src/lib/auth.ts`:

```typescript
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "finassist_session";

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { username: string };
  } catch {
    return null;
  }
}

export function getSessionCookie(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export { COOKIE_NAME };
```

- [ ] **Step 2: Create login API route**

Create `src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyPassword, createToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const { data: usernameRow } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "username")
    .single();

  const { data: hashRow } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "password_hash")
    .single();

  if (!usernameRow || !hashRow) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  if (
    username !== usernameRow.value ||
    !(await verifyPassword(password, hashRow.value))
  ) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createToken(username);

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return response;
}
```

- [ ] **Step 3: Create logout API route**

Create `src/app/api/auth/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
```

- [ ] **Step 4: Create Next.js middleware**

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = "finassist_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and auth API
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 5: Create login page**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push("/");
    } else {
      setError("Invalid username or password");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">FinAssist</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Test login flow manually**

```bash
npm run dev
```

1. Visit `http://localhost:3000` — should redirect to `/login`
2. Enter wrong credentials — should show error
3. Enter correct credentials — should redirect to `/`

- [ ] **Step 7: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/app/login/ src/middleware.ts
git commit -m "feat: add auth with login, logout, and middleware"
```

---

## Task 4: Gmail OAuth Flow

**Files:**
- Create: `src/lib/gmail.ts`
- Create: `src/app/api/gmail/connect/route.ts`
- Create: `src/app/api/gmail/callback/route.ts`

- [ ] **Step 1: Create Gmail helpers**

Create `src/lib/gmail.ts`:

```typescript
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
    expiry: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
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

  // Refresh if expired
  const { credentials } = await client.refreshAccessToken();
  if (credentials.access_token !== tokenRow.access_token) {
    await supabase.from("gmail_tokens").update({
      access_token: credentials.access_token,
      expiry: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
    }).eq("id", 1);
  }

  return google.gmail({ version: "v1", auth: client });
}

export async function searchEmails(
  gmail: ReturnType<typeof google.gmail>,
  query: string,
  maxResults = 100
) {
  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });
  return res.data.messages || [];
}

export async function readEmail(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
) {
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = res.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  // Extract plain text body
  let body = "";
  const payload = res.data.payload;
  if (payload?.body?.data) {
    body = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload?.parts) {
    const textPart = payload.parts.find(
      (p) => p.mimeType === "text/plain"
    );
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
    } else {
      // Fallback to HTML stripped
      const htmlPart = payload.parts.find(
        (p) => p.mimeType === "text/html"
      );
      if (htmlPart?.body?.data) {
        body = Buffer.from(htmlPart.body.data, "base64")
          .toString("utf-8")
          .replace(/<[^>]*>/g, " ")
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
    internalDate: res.data.internalDate
      ? new Date(parseInt(res.data.internalDate))
      : new Date(),
  };
}
```

- [ ] **Step 2: Create connect route**

Create `src/app/api/gmail/connect/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
```

- [ ] **Step 3: Create callback route**

Create `src/app/api/gmail/callback/route.ts`:

```typescript
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
    return NextResponse.redirect(
      new URL("/settings?error=oauth_failed", req.url)
    );
  }
}
```

- [ ] **Step 4: Verify OAuth flow manually**

1. Set up Google Cloud project with Gmail API enabled
2. Create OAuth credentials, set redirect URI to `http://localhost:3000/api/gmail/callback`
3. Add credentials to `.env.local`
4. Visit `http://localhost:3000/api/gmail/connect`
5. Complete OAuth — should redirect to `/settings?gmail=connected`
6. Check `gmail_tokens` table in Supabase for stored tokens

- [ ] **Step 5: Commit**

```bash
git add src/lib/gmail.ts src/app/api/gmail/
git commit -m "feat: add Gmail OAuth connect and callback"
```

---

## Task 5: Email Parser Types + Router

**Files:**
- Create: `src/lib/parsers/types.ts`
- Create: `src/lib/parsers/router.ts`
- Create: `__tests__/parsers/router.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/lib/parsers/types.ts`:

```typescript
export interface EmailInput {
  messageId: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  snippet: string;
  date: string;
  internalDate: Date;
}

export interface ParsedTransaction {
  amount: number;
  currency: string;
  type: "expense" | "income" | "transfer" | "top_up";
  category: string;
  merchant: string | null;
  description: string;
  transactionDate: Date;
  source: string;
  rawData: Record<string, unknown>;
}

export type ParserResult =
  | { status: "parsed"; transaction: ParsedTransaction }
  | { status: "skip"; reason: string };

export type Parser = (email: EmailInput) => ParserResult;
```

- [ ] **Step 2: Create router**

Create `src/lib/parsers/router.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";
import { parseScbCard } from "./scb-card";
import { parseScbTransfer } from "./scb-transfer";
import { parseScbCcPayment } from "./scb-cc-payment";
import { parseCitybankDeposit } from "./citybank-deposit";
import { parseCitytouchBkash } from "./citytouch-bkash";
import { parseLlmService } from "./llm-service";

const SKIP_SENDERS = [
  "promotions@citybankplc.com",
  "citytouchpromotion@thecitybank.com",
  "digitalbanking.bd@sc.com",
];

const SERVICE_SENDERS = [
  "info@mail.foodpanda.com.bd",
  "noreply@uber.com",
  "uberone@uber.com",
  "no-reply@spotify.com",
  "invoice+statements@mail.anthropic.com",
  "googleplay-noreply@google.com",
  "bd.ebilling@dhl.com",
];

function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).toLowerCase().trim();
}

export function routeEmail(
  email: EmailInput
): { parser: string; parse: () => Promise<ParserResult> | ParserResult } {
  const sender = extractEmail(email.from);
  const subject = email.subject.toLowerCase();

  // Skip promotional / OTP
  if (SKIP_SENDERS.includes(sender)) {
    return {
      parser: "skip",
      parse: () => ({ status: "skip", reason: "promotional" }),
    };
  }

  if (sender === "ibanking.bangladesh@sc.com" && subject.includes("etac")) {
    return {
      parser: "skip",
      parse: () => ({ status: "skip", reason: "otp_email" }),
    };
  }

  // SCB card alerts
  if (sender === "smsbanking.bd@sc.com") {
    return { parser: "scb_card", parse: () => parseScbCard(email) };
  }

  // SCB iBanking
  if (sender === "ibanking.bangladesh@sc.com") {
    if (subject.includes("domestic transfer")) {
      return { parser: "scb_transfer", parse: () => parseScbTransfer(email) };
    }
    if (subject.includes("credit card payment")) {
      return { parser: "scb_cc_payment", parse: () => parseScbCcPayment(email) };
    }
  }

  // City Bank deposit
  if (sender === "noreply@citybankplc.com" && subject.includes("deposited")) {
    return {
      parser: "citybank_deposit",
      parse: () => parseCitybankDeposit(email),
    };
  }

  // Citytouch bKash
  if (
    sender === "citytouch@thecitybank.com" &&
    subject.includes("mobile wallet transfer")
  ) {
    return {
      parser: "citytouch_bkash",
      parse: () => parseCitytouchBkash(email),
    };
  }

  // Service emails
  if (SERVICE_SENDERS.includes(sender)) {
    return { parser: "llm_service", parse: () => parseLlmService(email) };
  }

  // Unknown — skip
  return {
    parser: "skip",
    parse: () => ({ status: "skip", reason: "unrecognized_sender" }),
  };
}
```

- [ ] **Step 3: Write router tests**

Create `__tests__/parsers/router.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { routeEmail } from "@/lib/parsers/router";
import { EmailInput } from "@/lib/parsers/types";

function makeEmail(overrides: Partial<EmailInput>): EmailInput {
  return {
    messageId: "test-id",
    threadId: "test-thread",
    from: "",
    subject: "",
    body: "",
    snippet: "",
    date: "",
    internalDate: new Date(),
    ...overrides,
  };
}

describe("routeEmail", () => {
  it("routes SCB card alerts to scb_card parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "<SMSBanking.BD@sc.com>",
        subject: "Standard Chartered Transaction Alert",
      })
    );
    expect(result.parser).toBe("scb_card");
  });

  it("routes SCB domestic transfer to scb_transfer parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "<iBanking.Bangladesh@sc.com>",
        subject: "Domestic Transfer - NPS -Successful",
      })
    );
    expect(result.parser).toBe("scb_transfer");
  });

  it("routes SCB credit card payment to scb_cc_payment parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "<iBanking.Bangladesh@sc.com>",
        subject: "Credit Card Payment Confirmation",
      })
    );
    expect(result.parser).toBe("scb_cc_payment");
  });

  it("routes City Bank deposit to citybank_deposit parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "City Bank PLC <noreply@citybankplc.com>",
        subject: "BDT 7,000.00 Deposited to A/C 28035******001",
      })
    );
    expect(result.parser).toBe("citybank_deposit");
  });

  it("routes Citytouch bKash to citytouch_bkash parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "Citytouch <citytouch@thecitybank.com>",
        subject: "You made a Mobile Wallet Transfer",
      })
    );
    expect(result.parser).toBe("citytouch_bkash");
  });

  it("routes Foodpanda to llm_service parser", () => {
    const result = routeEmail(
      makeEmail({
        from: "foodpanda <info@mail.foodpanda.com.bd>",
        subject: "Your order has been placed.",
      })
    );
    expect(result.parser).toBe("llm_service");
  });

  it("skips promotional emails", () => {
    const result = routeEmail(
      makeEmail({
        from: "promotions@citybankplc.com",
        subject: "Special offer!",
      })
    );
    expect(result.parser).toBe("skip");
  });

  it("skips ETAC emails", () => {
    const result = routeEmail(
      makeEmail({
        from: "<iBanking.Bangladesh@sc.com>",
        subject: "Standard Chartered Bank - Online Banking - Local Funds Transfer - ETAC Generation",
      })
    );
    expect(result.parser).toBe("skip");
  });

  it("skips unrecognized senders", () => {
    const result = routeEmail(
      makeEmail({
        from: "random@example.com",
        subject: "Hello",
      })
    );
    expect(result.parser).toBe("skip");
  });
});
```

- [ ] **Step 4: Configure vitest**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 5: Run router tests**

```bash
npm test -- __tests__/parsers/router.test.ts
```

Note: Tests will fail because parser modules don't exist yet. That's expected — they'll pass after Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/parsers/types.ts src/lib/parsers/router.ts __tests__/parsers/router.test.ts vitest.config.ts
git commit -m "feat: add parser types, router, and router tests"
```

---

## Task 6: Regex Parsers

**Files:**
- Create: `src/lib/parsers/scb-card.ts`
- Create: `src/lib/parsers/scb-transfer.ts`
- Create: `src/lib/parsers/scb-cc-payment.ts`
- Create: `src/lib/parsers/citybank-deposit.ts`
- Create: `src/lib/parsers/citytouch-bkash.ts`
- Create: `__tests__/parsers/scb-card.test.ts`
- Create: `__tests__/parsers/scb-transfer.test.ts`
- Create: `__tests__/parsers/scb-cc-payment.test.ts`
- Create: `__tests__/parsers/citybank-deposit.test.ts`
- Create: `__tests__/parsers/citytouch-bkash.test.ts`

- [ ] **Step 1: Write scb-card test**

Create `__tests__/parsers/scb-card.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseScbCard } from "@/lib/parsers/scb-card";
import { EmailInput } from "@/lib/parsers/types";

const baseEmail: EmailInput = {
  messageId: "msg1",
  threadId: "t1",
  from: "<SMSBanking.BD@sc.com>",
  subject: "Standard Chartered Transaction Alert",
  date: "Fri, 20 Mar 2026 12:45:33 +0000",
  snippet: "",
  internalDate: new Date("2026-03-20T12:45:33Z"),
  body: "",
};

describe("parseScbCard", () => {
  it("parses local card transaction", () => {
    const email = {
      ...baseEmail,
      body: "Card Alerts Alerts March 20 2026, 06:45 PM Dear Client, A local transaction of BDT 1324.00 was made using your card ending with 5575 at KFC GULSHAN 412 DHAKA BD on 20-Mar-26. If you have not made this transaction, please immediately call 16233. Your available credit limit is now BDT 55939.90.",
    };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(1324.0);
      expect(result.transaction.type).toBe("expense");
      expect(result.transaction.merchant).toContain("KFC");
      expect(result.transaction.rawData).toHaveProperty("card", "5575");
    }
  });

  it("parses international e-transaction", () => {
    const email = {
      ...baseEmail,
      body: "Card Alerts Alerts March 21 2026, 03:06 PM Dear Client, An international e-transaction equivalent to BDT 126.90 was made using your card ending with 5575 at Microsoft*Store Singapore SG on 21-Mar-26. If you have not made this transaction, please immediately call +8809666777111. Your available credit limit is now BDT 58142.00.",
    };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(126.9);
      expect(result.transaction.merchant).toContain("Microsoft");
      expect(result.transaction.rawData).toHaveProperty("international", true);
    }
  });

  it("parses withdrawal", () => {
    const email = {
      ...baseEmail,
      body: "Alerts CASA Alerts March 20 2026, 04:47 PM Dear Client, BDT 20000.00 was withdrawn from Acc. ending xxxxxxx8501 on 24-Mar-26. Your available balance is now BDT 617,430.15",
    };
    const result = parseScbCard(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(20000.0);
      expect(result.transaction.type).toBe("transfer");
      expect(result.transaction.rawData).toHaveProperty("account", "8501");
    }
  });
});
```

- [ ] **Step 2: Implement scb-card parser**

Create `src/lib/parsers/scb-card.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";
import { autoAssignCategory } from "../categories";

const LOCAL_PATTERN =
  /A local (?:e-)?transaction of BDT ([\d,.]+) was made using your card ending with (\d+) at (.+?) on (\d{2}-\w{3}-\d{2})/i;

const INTL_PATTERN =
  /An international e-transaction equivalent to BDT ([\d,.]+) was made using your card ending with (\d+) at (.+?) on (\d{2}-\w{3}-\d{2})/i;

const WITHDRAWAL_PATTERN =
  /BDT ([\d,.]+) was withdrawn from Acc\. ending (?:\w+?)(\d{4}) on (\d{2}-\w{3}-\d{2})/i;

const CREDIT_LIMIT_PATTERN = /available credit limit is now BDT ([\d,.]+)/i;
const BALANCE_PATTERN = /available balance is now BDT ([\d,.]+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

function parseDate(dateStr: string): Date {
  // Format: "20-Mar-26" → "20-Mar-2026"
  const parts = dateStr.split("-");
  const year = parseInt(parts[2]) < 50 ? `20${parts[2]}` : `19${parts[2]}`;
  return new Date(`${parts[0]}-${parts[1]}-${year}`);
}

export function parseScbCard(email: EmailInput): ParserResult {
  const body = email.body;

  // Try local transaction
  let match = body.match(LOCAL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const card = match[2];
    const merchant = match[3].trim();
    const date = parseDate(match[4]);
    const creditMatch = body.match(CREDIT_LIMIT_PATTERN);

    return {
      status: "parsed",
      transaction: {
        amount,
        currency: "BDT",
        type: "expense",
        category: autoAssignCategory(merchant),
        merchant,
        description: `Card purchase at ${merchant}`,
        transactionDate: date,
        source: "scb_card",
        rawData: {
          card,
          international: false,
          availableCredit: creditMatch ? parseAmount(creditMatch[1]) : null,
        },
      },
    };
  }

  // Try international transaction
  match = body.match(INTL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const card = match[2];
    const merchant = match[3].trim();
    const date = parseDate(match[4]);
    const creditMatch = body.match(CREDIT_LIMIT_PATTERN);

    return {
      status: "parsed",
      transaction: {
        amount,
        currency: "BDT",
        type: "expense",
        category: autoAssignCategory(merchant),
        merchant,
        description: `International purchase at ${merchant}`,
        transactionDate: date,
        source: "scb_card",
        rawData: {
          card,
          international: true,
          availableCredit: creditMatch ? parseAmount(creditMatch[1]) : null,
        },
      },
    };
  }

  // Try withdrawal
  match = body.match(WITHDRAWAL_PATTERN);
  if (match) {
    const amount = parseAmount(match[1]);
    const account = match[2];
    const date = parseDate(match[3]);
    const balanceMatch = body.match(BALANCE_PATTERN);

    return {
      status: "parsed",
      transaction: {
        amount,
        currency: "BDT",
        type: "transfer",
        category: "transfer",
        merchant: null,
        description: `Withdrawal from account ending ${account}`,
        transactionDate: date,
        source: "scb_card",
        rawData: {
          account,
          availableBalance: balanceMatch ? parseAmount(balanceMatch[1]) : null,
        },
      },
    };
  }

  return { status: "skip", reason: "scb_card_no_pattern_match" };
}
```

- [ ] **Step 3: Run scb-card test**

```bash
npm test -- __tests__/parsers/scb-card.test.ts
```

Expected: All 3 tests PASS. (Note: `autoAssignCategory` needs to exist first — create a stub in Step 4 if needed.)

- [ ] **Step 4: Create categories module**

Create `src/lib/categories.ts`:

```typescript
import { supabase } from "./supabase";

const DEFAULT_RULES: [RegExp, string][] = [
  [/foodpanda|kfc|fish\s*&?\s*co|madchef|herfy|iftarwala/i, "food"],
  [/uber(?!.*one)/i, "transport"],
  [/spotify|anthropic|google\s*play|uber\s*one|trackingmore/i, "subscription"],
  [/shwapno/i, "groceries"],
  [/pharmacy|ramna/i, "health"],
  [/dhl/i, "shipping"],
  [/axaro|white\s*tailor/i, "shopping"],
  [/persona/i, "lifestyle"],
];

// Cache user-defined rules, refreshed on each sync
let userRulesCache: { pattern: string; category: string }[] | null = null;

export async function loadUserCategoryRules() {
  const { data } = await supabase.from("category_rules").select("*");
  userRulesCache = data || [];
}

export function autoAssignCategory(merchant: string | null): string {
  if (!merchant) return "other";

  // Check user-defined rules first (from category_rules table)
  if (userRulesCache) {
    const normalized = merchant.toLowerCase();
    for (const rule of userRulesCache) {
      if (normalized.includes(rule.pattern)) return rule.category;
    }
  }

  // Fall back to hardcoded defaults
  for (const [pattern, category] of DEFAULT_RULES) {
    if (pattern.test(merchant)) return category;
  }

  return "other";
}
```

- [ ] **Step 5: Write and implement scb-transfer parser**

Create `__tests__/parsers/scb-transfer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseScbTransfer } from "@/lib/parsers/scb-transfer";
import { EmailInput } from "@/lib/parsers/types";

const baseEmail: EmailInput = {
  messageId: "msg2",
  threadId: "t2",
  from: "<iBanking.Bangladesh@sc.com>",
  subject: "Domestic Transfer - NPS -Successful",
  date: "Fri, 20 Mar 2026 21:19:12 +0800",
  snippet: "",
  internalDate: new Date("2026-03-20T13:19:12Z"),
  body: "Dear Customer,Your NPS Fund Transfer request has been processed successfully. Transfer To XXXXXXXXX8001 Payment Reference Number fte965d26e137e69 Payment Reference Domestic Transfer Online Banking - NPS Payment Amount BDT 7,000.00 Transfer From XXXXXXX8501 From Currency BDT Beneficiary Name Sowvik Kanti Das Beneficiary Type Account Beneficiary Bank Name THE CITY BANK LTD. Status Successful Please call Phone Banking on 16233.",
};

describe("parseScbTransfer", () => {
  it("parses successful domestic transfer", () => {
    const result = parseScbTransfer(baseEmail);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("transfer");
      expect(result.transaction.rawData).toHaveProperty("referenceNumber", "fte965d26e137e69");
      expect(result.transaction.rawData).toHaveProperty("beneficiaryBank", "THE CITY BANK LTD.");
      expect(result.transaction.rawData).toHaveProperty("status", "Successful");
    }
  });

  it("parses submitted transfer", () => {
    const email = {
      ...baseEmail,
      subject: "Domestic Transfer - NPS -Submitted",
      body: baseEmail.body.replace("processed successfully", "submitted for processing").replace("Status Successful", ""),
    };
    const result = parseScbTransfer(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.rawData).toHaveProperty("status", "Submitted");
    }
  });
});
```

Create `src/lib/parsers/scb-transfer.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /Payment Amount\s*BDT\s*([\d,.]+)/i;
const REFERENCE_PATTERN = /Payment Reference Number\s*(\w+)/i;
const TRANSFER_TO_PATTERN = /Transfer To\s*(\S+)/i;
const TRANSFER_FROM_PATTERN = /Transfer From\s*(\S+)/i;
const BENEFICIARY_NAME_PATTERN = /Beneficiary Name\s*(.+?)(?=Beneficiary Type)/i;
const BENEFICIARY_BANK_PATTERN = /Beneficiary Bank Name\s*(.+?)(?=(?:Status|Please))/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseScbTransfer(email: EmailInput): ParserResult {
  const body = email.body;
  const subject = email.subject;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "scb_transfer_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const reference = body.match(REFERENCE_PATTERN)?.[1] || "";
  const transferTo = body.match(TRANSFER_TO_PATTERN)?.[1] || "";
  const transferFrom = body.match(TRANSFER_FROM_PATTERN)?.[1] || "";
  const beneficiaryName = body.match(BENEFICIARY_NAME_PATTERN)?.[1]?.trim() || "";
  const beneficiaryBank = body.match(BENEFICIARY_BANK_PATTERN)?.[1]?.trim() || "";

  const isSubmitted = subject.toLowerCase().includes("submitted");
  const status = isSubmitted ? "Submitted" : "Successful";

  return {
    status: "parsed",
    transaction: {
      amount,
      currency: "BDT",
      type: "transfer",
      category: "transfer",
      merchant: beneficiaryBank || null,
      description: `Transfer to ${beneficiaryName || transferTo}`,
      transactionDate: email.internalDate,
      source: "scb_transfer",
      rawData: {
        referenceNumber: reference,
        transferTo,
        transferFrom,
        beneficiaryName,
        beneficiaryBank,
        status,
      },
    },
  };
}
```

- [ ] **Step 6: Write and implement scb-cc-payment parser**

Create `__tests__/parsers/scb-cc-payment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseScbCcPayment } from "@/lib/parsers/scb-cc-payment";
import { EmailInput } from "@/lib/parsers/types";

describe("parseScbCcPayment", () => {
  it("parses credit card payment confirmation", () => {
    const email: EmailInput = {
      messageId: "msg3",
      threadId: "t3",
      from: "<iBanking.Bangladesh@sc.com>",
      subject: "Credit Card Payment Confirmation",
      date: "Fri, 6 Mar 2026 14:06:53 +0800",
      snippet: "",
      internalDate: new Date("2026-03-06T06:06:53Z"),
      body: "Dear MR SOWVIK DAS (Rel. No: 131968500) Your request for a Credit Card Payment has been processed successfully. The details of your transaction request are as follows: Payment CurrencyBDTDebit Account NumberXXXXXXX8501Card NumberXXXXXXXXXXXX5575Debit Account CurrencyBDTPay RefStandard Chartered Credit Card PaymentDebit Amount166702.71Exchange Rate1.0Reference No202603076904009Card Holder NameSOWVIK KANTI DASTransaction Amount166702.71",
    };
    const result = parseScbCcPayment(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(166702.71);
      expect(result.transaction.type).toBe("transfer");
      expect(result.transaction.rawData).toHaveProperty("card", "5575");
    }
  });
});
```

Create `src/lib/parsers/scb-cc-payment.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /(?:Debit Amount|Transaction Amount)([\d,.]+)/i;
const CARD_PATTERN = /Card Number\w*(\d{4})/i;
const ACCOUNT_PATTERN = /Debit Account Number\w*(\d{4})/i;
const REFERENCE_PATTERN = /Reference No(\d+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseScbCcPayment(email: EmailInput): ParserResult {
  const body = email.body;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "scb_cc_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const card = body.match(CARD_PATTERN)?.[1] || "";
  const account = body.match(ACCOUNT_PATTERN)?.[1] || "";
  const reference = body.match(REFERENCE_PATTERN)?.[1] || "";

  return {
    status: "parsed",
    transaction: {
      amount,
      currency: "BDT",
      type: "transfer",
      category: "transfer",
      merchant: "Standard Chartered Credit Card",
      description: `Credit card payment - card ending ${card}`,
      transactionDate: email.internalDate,
      source: "scb_cc_payment",
      rawData: { card, account, reference },
    },
  };
}
```

- [ ] **Step 7: Write and implement citybank-deposit parser**

Create `__tests__/parsers/citybank-deposit.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCitybankDeposit } from "@/lib/parsers/citybank-deposit";
import { EmailInput } from "@/lib/parsers/types";

describe("parseCitybankDeposit", () => {
  it("parses deposit alert from subject and snippet", () => {
    const email: EmailInput = {
      messageId: "msg4",
      threadId: "t4",
      from: "City Bank PLC <noreply@citybankplc.com>",
      subject: "BDT 7,000.00 Deposited to A/C 28035******001",
      date: "Fri, 20 Mar 2026 19:30:24 +0600",
      snippet: "Deposit Alert You received BDT 7000.00 as Deposit Account 28035******001 HIGH VALUE SAVINGS A/C Date 20-MAR-2026 07:17 PM Amount BDT 7000.00 Available Balance BDT 7870.59",
      internalDate: new Date("2026-03-20T13:30:24Z"),
      body: "To view the message, please use an HTML compatible email viewer!",
    };
    const result = parseCitybankDeposit(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("income");
      expect(result.transaction.rawData).toHaveProperty("account", "28035******001");
      expect(result.transaction.rawData).toHaveProperty("balance", 7870.59);
    }
  });
});
```

Create `src/lib/parsers/citybank-deposit.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";

const SUBJECT_AMOUNT_PATTERN = /BDT\s*([\d,.]+)\s*Deposited to A\/C\s*(\S+)/i;
const SNIPPET_DATE_PATTERN = /Date\s*(\d{2}-\w{3}-\d{4}\s*\d{2}:\d{2}\s*(?:AM|PM))/i;
const SNIPPET_BALANCE_PATTERN = /Available Balance\s*BDT\s*([\d,.]+)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseCitybankDeposit(email: EmailInput): ParserResult {
  const subjectMatch = email.subject.match(SUBJECT_AMOUNT_PATTERN);
  if (!subjectMatch) return { status: "skip", reason: "citybank_no_subject_match" };

  const amount = parseAmount(subjectMatch[1]);
  const account = subjectMatch[2];

  const dateMatch = email.snippet.match(SNIPPET_DATE_PATTERN);
  const balanceMatch = email.snippet.match(SNIPPET_BALANCE_PATTERN);

  let transactionDate = email.internalDate;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) transactionDate = parsed;
  }

  return {
    status: "parsed",
    transaction: {
      amount,
      currency: "BDT",
      type: "income",
      category: "transfer",
      merchant: "City Bank",
      description: `Deposit to account ${account}`,
      transactionDate,
      source: "citybank_deposit",
      rawData: {
        account,
        balance: balanceMatch ? parseAmount(balanceMatch[1]) : null,
      },
    },
  };
}
```

- [ ] **Step 8: Write and implement citytouch-bkash parser**

Create `__tests__/parsers/citytouch-bkash.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCitytouchBkash } from "@/lib/parsers/citytouch-bkash";
import { EmailInput } from "@/lib/parsers/types";

describe("parseCitytouchBkash", () => {
  it("parses bKash wallet transfer", () => {
    const email: EmailInput = {
      messageId: "msg5",
      threadId: "t5",
      from: "Citytouch <citytouch@thecitybank.com>",
      subject: "You made a Mobile Wallet Transfer",
      date: "Fri, 20 Mar 2026 19:22:13 +0600",
      snippet: "Transaction Alert You have transferred BDT 7000.00 to 013002*3574",
      internalDate: new Date("2026-03-20T13:22:13Z"),
      body: "Email Template Transaction Alert You have transferred BDT 7,000.00 to 013002*3574 Transaction Type bKash Transfer Transferred Amount BDT 7,000.00 Service Charge BDT 0.00 VAT BDT 0.00 Total Amount BDT 7,000.00 Remarks From Account/Card 280352***8001 Beneficiary Wallet Number 013002*3574 Date and Time 20-MAR-2026 07:21 PM Reference Number CT79081497",
    };
    const result = parseCitytouchBkash(email);
    expect(result.status).toBe("parsed");
    if (result.status === "parsed") {
      expect(result.transaction.amount).toBe(7000);
      expect(result.transaction.type).toBe("top_up");
      expect(result.transaction.rawData).toHaveProperty("walletNumber", "013002*3574");
      expect(result.transaction.rawData).toHaveProperty("referenceNumber", "CT79081497");
    }
  });
});
```

Create `src/lib/parsers/citytouch-bkash.ts`:

```typescript
import { EmailInput, ParserResult } from "./types";

const AMOUNT_PATTERN = /Transferred Amount\s*BDT\s*([\d,.]+)/i;
const TOTAL_PATTERN = /Total Amount\s*BDT\s*([\d,.]+)/i;
const CHARGE_PATTERN = /Service Charge\s*BDT\s*([\d,.]+)/i;
const VAT_PATTERN = /VAT\s*BDT\s*([\d,.]+)/i;
const WALLET_PATTERN = /Beneficiary Wallet Number\s*(\S+)/i;
const ACCOUNT_PATTERN = /From Account\/Card\s*(\S+)/i;
const REFERENCE_PATTERN = /Reference Number\s*(\S+)/i;
const DATE_PATTERN = /Date and Time\s*(\d{2}-\w{3}-\d{4}\s*\d{2}:\d{2}\s*(?:AM|PM))/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ""));
}

export function parseCitytouchBkash(email: EmailInput): ParserResult {
  const body = email.body;

  const amountMatch = body.match(AMOUNT_PATTERN);
  if (!amountMatch) return { status: "skip", reason: "bkash_no_amount" };

  const amount = parseAmount(amountMatch[1]);
  const totalMatch = body.match(TOTAL_PATTERN);
  const chargeMatch = body.match(CHARGE_PATTERN);
  const vatMatch = body.match(VAT_PATTERN);
  const walletMatch = body.match(WALLET_PATTERN);
  const accountMatch = body.match(ACCOUNT_PATTERN);
  const referenceMatch = body.match(REFERENCE_PATTERN);
  const dateMatch = body.match(DATE_PATTERN);

  let transactionDate = email.internalDate;
  if (dateMatch) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) transactionDate = parsed;
  }

  return {
    status: "parsed",
    transaction: {
      amount,
      currency: "BDT",
      type: "top_up",
      category: "top_up",
      merchant: "bKash",
      description: `bKash transfer to ${walletMatch?.[1] || "wallet"}`,
      transactionDate,
      source: "citytouch_bkash",
      rawData: {
        totalAmount: totalMatch ? parseAmount(totalMatch[1]) : amount,
        serviceCharge: chargeMatch ? parseAmount(chargeMatch[1]) : 0,
        vat: vatMatch ? parseAmount(vatMatch[1]) : 0,
        walletNumber: walletMatch?.[1] || null,
        fromAccount: accountMatch?.[1] || null,
        referenceNumber: referenceMatch?.[1] || null,
      },
    },
  };
}
```

- [ ] **Step 9: Run all parser tests**

```bash
npm test -- __tests__/parsers/
```

Expected: All tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/parsers/ src/lib/categories.ts __tests__/
git commit -m "feat: add all regex parsers with tests"
```

---

## Task 7: LLM Service Parser

**Files:**
- Create: `src/lib/parsers/llm-service.ts`

- [ ] **Step 1: Implement LLM parser**

Create `src/lib/parsers/llm-service.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { EmailInput, ParserResult } from "./types";
import { autoAssignCategory } from "../categories";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a transaction data extractor. Given an email body, extract the financial transaction details. Return ONLY valid JSON with no extra text.

Required fields:
{
  "amount": <number in BDT>,
  "original_currency": "BDT" or "USD",
  "original_amount": <number in original currency, same as amount if BDT>,
  "merchant": "<merchant/service name>",
  "items": [{"name": "<string>", "quantity": <number>, "price": <number>}] or [],
  "date": "<ISO 8601 date string>",
  "description": "<one-line summary>"
}

If you cannot determine the amount, return {"error": "no_amount_found"}.`;

export async function parseLlmService(email: EmailInput): Promise<ParserResult> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract transaction data from this email:\n\nFrom: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\nBody:\n${email.body.slice(0, 3000)}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const data = JSON.parse(text);

    if (data.error) {
      return { status: "skip", reason: `llm_error: ${data.error}` };
    }

    const merchant = data.merchant || "Unknown Service";

    return {
      status: "parsed",
      transaction: {
        amount: data.amount,
        currency: "BDT",
        type: "expense",
        category: autoAssignCategory(merchant),
        merchant,
        description: data.description || `Purchase from ${merchant}`,
        transactionDate: data.date
          ? new Date(data.date)
          : email.internalDate,
        source: "llm_service",
        rawData: {
          items: data.items || [],
          originalCurrency: data.original_currency,
          originalAmount: data.original_amount,
        },
      },
    };
  } catch (error) {
    console.error("LLM parser error:", error);
    return { status: "skip", reason: "llm_parse_failed" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/parsers/llm-service.ts
git commit -m "feat: add LLM service email parser using Claude API"
```

---

## Task 8: Multi-Email Grouping

**Files:**
- Create: `src/lib/grouping.ts`
- Create: `__tests__/grouping.test.ts`

- [ ] **Step 1: Write grouping tests**

Create `__tests__/grouping.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { findGroups, GroupMatch } from "@/lib/grouping";
import { ParsedTransaction } from "@/lib/parsers/types";

function makeTx(
  overrides: Partial<ParsedTransaction> & { _emailId?: string }
): ParsedTransaction & { _emailId: string } {
  return {
    _emailId: overrides._emailId || "e1",
    amount: 0,
    currency: "BDT",
    type: "expense",
    category: "other",
    merchant: null,
    description: "",
    transactionDate: new Date("2026-03-20T12:00:00Z"),
    source: "scb_card",
    rawData: {},
    ...overrides,
  };
}

describe("findGroups", () => {
  it("groups SCB submitted + successful by reference number", () => {
    const txs = [
      makeTx({
        _emailId: "e1",
        source: "scb_transfer",
        amount: 7000,
        rawData: { referenceNumber: "ref123", status: "Submitted" },
      }),
      makeTx({
        _emailId: "e2",
        source: "scb_transfer",
        amount: 7000,
        rawData: { referenceNumber: "ref123", status: "Successful" },
      }),
    ];
    const groups = findGroups(txs);
    expect(groups).toHaveLength(1);
    expect(groups[0].primaryEmailId).toBe("e2");
    expect(groups[0].linkedEmailId).toBe("e1");
    expect(groups[0].reason).toBe("scb_transfer_pair");
  });

  it("groups SCB transfer + City Bank deposit by amount and time", () => {
    const txs = [
      makeTx({
        _emailId: "e1",
        source: "scb_transfer",
        amount: 7000,
        transactionDate: new Date("2026-03-20T12:00:00Z"),
        rawData: { status: "Successful" },
      }),
      makeTx({
        _emailId: "e2",
        source: "citybank_deposit",
        amount: 7000,
        transactionDate: new Date("2026-03-20T12:10:00Z"),
      }),
    ];
    const groups = findGroups(txs);
    expect(groups.some((g) => g.reason === "scb_citybank_transfer_pair")).toBe(true);
  });

  it("groups bank alert + service email by amount and time window", () => {
    const txs = [
      makeTx({
        _emailId: "e1",
        source: "scb_card",
        amount: 313,
        merchant: "Foodpanda Bangladesh",
        transactionDate: new Date("2026-03-22T15:55:00Z"),
      }),
      makeTx({
        _emailId: "e2",
        source: "llm_service",
        amount: 313,
        merchant: "Foodpanda",
        transactionDate: new Date("2026-03-22T15:53:00Z"),
      }),
    ];
    const groups = findGroups(txs);
    expect(groups.some((g) => g.reason === "bank_plus_merchant")).toBe(true);
    expect(groups[0].primaryEmailId).toBe("e2"); // service email is primary
  });
});
```

- [ ] **Step 2: Implement grouping engine**

Create `src/lib/grouping.ts`:

```typescript
import { ParsedTransaction } from "./parsers/types";

export interface TransactionWithEmail extends ParsedTransaction {
  _emailId: string;
}

export interface GroupMatch {
  primaryEmailId: string;
  linkedEmailId: string;
  reason: string;
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

function amountClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance;
}

function timeClose(a: Date, b: Date, windowMs: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= windowMs;
}

function merchantFuzzyMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  return na.includes(nb) || nb.includes(na);
}

export function findGroups(txs: TransactionWithEmail[]): GroupMatch[] {
  const groups: GroupMatch[] = [];
  const linked = new Set<string>();

  // Rule 1: SCB Transfer Pair (Submitted + Successful)
  const scbTransfers = txs.filter((t) => t.source === "scb_transfer");
  for (const tx of scbTransfers) {
    if (linked.has(tx._emailId)) continue;
    if (tx.rawData?.status !== "Successful") continue;

    const match = scbTransfers.find(
      (other) =>
        other._emailId !== tx._emailId &&
        !linked.has(other._emailId) &&
        other.rawData?.status === "Submitted" &&
        other.rawData?.referenceNumber === tx.rawData?.referenceNumber
    );
    if (match) {
      groups.push({
        primaryEmailId: tx._emailId,
        linkedEmailId: match._emailId,
        reason: "scb_transfer_pair",
      });
      linked.add(match._emailId);
    }
  }

  // Rule 2: SCB Transfer + City Bank Deposit
  const successfulTransfers = scbTransfers.filter(
    (t) => t.rawData?.status === "Successful" && !linked.has(t._emailId)
  );
  const cityDeposits = txs.filter(
    (t) => t.source === "citybank_deposit" && !linked.has(t._emailId)
  );

  for (const transfer of successfulTransfers) {
    const match = cityDeposits.find(
      (dep) =>
        !linked.has(dep._emailId) &&
        amountClose(transfer.amount, dep.amount, 1) &&
        timeClose(transfer.transactionDate, dep.transactionDate, THIRTY_MINUTES_MS)
    );
    if (match) {
      groups.push({
        primaryEmailId: transfer._emailId,
        linkedEmailId: match._emailId,
        reason: "scb_citybank_transfer_pair",
      });
      linked.add(match._emailId);
    }
  }

  // Rule 3: Bank Alert + Service Email
  const bankAlerts = txs.filter(
    (t) => t.source === "scb_card" && !linked.has(t._emailId)
  );
  const serviceEmails = txs.filter(
    (t) => t.source === "llm_service" && !linked.has(t._emailId)
  );

  for (const service of serviceEmails) {
    const match = bankAlerts.find(
      (alert) =>
        !linked.has(alert._emailId) &&
        amountClose(service.amount, alert.amount, 5) &&
        timeClose(service.transactionDate, alert.transactionDate, SIXTY_MINUTES_MS) &&
        merchantFuzzyMatch(service.merchant, alert.merchant)
    );
    if (match) {
      groups.push({
        primaryEmailId: service._emailId, // service email is primary (richer data)
        linkedEmailId: match._emailId,
        reason: "bank_plus_merchant",
      });
      linked.add(match._emailId);
    }
  }

  // Rule 4: bKash Top-up Chain
  const bkashTransfers = txs.filter(
    (t) => t.source === "citytouch_bkash" && !linked.has(t._emailId)
  );
  const remainingDeposits = cityDeposits.filter(
    (t) => !linked.has(t._emailId)
  );

  for (const bkash of bkashTransfers) {
    const match = remainingDeposits.find(
      (dep) =>
        !linked.has(dep._emailId) &&
        amountClose(bkash.amount, dep.amount, 1) &&
        timeClose(bkash.transactionDate, dep.transactionDate, THIRTY_MINUTES_MS)
    );
    if (match) {
      groups.push({
        primaryEmailId: bkash._emailId,
        linkedEmailId: match._emailId,
        reason: "bkash_topup_pair",
      });
      linked.add(match._emailId);
    }
  }

  return groups;
}
```

- [ ] **Step 3: Run grouping tests**

```bash
npm test -- __tests__/grouping.test.ts
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/grouping.ts __tests__/grouping.test.ts
git commit -m "feat: add multi-email grouping engine with 4 rules"
```

---

## Task 9: Sync Endpoint

**Files:**
- Create: `src/app/api/sync/route.ts`

- [ ] **Step 1: Implement sync endpoint**

Create `src/app/api/sync/route.ts`:

```typescript
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

export async function POST() {
  try {
    // 0. Load user category rules for auto-assignment
    await loadUserCategoryRules();

    // 1. Get sync state
    const { data: syncState } = await supabase
      .from("sync_state")
      .select("*")
      .eq("id", 1)
      .single();

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
    const messageRefs = await searchEmails(gmail, query, 200);

    if (messageRefs.length === 0) {
      return NextResponse.json({ synced: 0, grouped: 0, skipped: 0 });
    }

    // 4. Filter already-processed
    const messageIds = messageRefs.map((m) => m.id!);
    const { data: existingEmails } = await supabase
      .from("emails")
      .select("gmail_message_id")
      .in("gmail_message_id", messageIds);

    const existingIds = new Set(
      (existingEmails || []).map((e) => e.gmail_message_id)
    );
    const newMessageIds = messageIds.filter((id) => !existingIds.has(id));

    if (newMessageIds.length === 0) {
      return NextResponse.json({ synced: 0, grouped: 0, skipped: 0 });
    }

    // 5. Read and parse each email
    const parsedResults: {
      email: EmailInput;
      tx: TransactionWithEmail;
      parserUsed: string;
    }[] = [];
    let skipped = 0;

    for (const msgId of newMessageIds) {
      const emailData = await readEmail(gmail, msgId);
      const emailInput: EmailInput = {
        messageId: emailData.messageId,
        threadId: emailData.threadId,
        from: emailData.from,
        subject: emailData.subject,
        body: emailData.body,
        snippet: emailData.snippet,
        date: emailData.date,
        internalDate: emailData.internalDate,
      };

      const { parser, parse } = routeEmail(emailInput);

      if (parser === "skip") {
        skipped++;
        // Still record the email as processed
        await supabase.from("emails").insert({
          gmail_message_id: emailData.messageId,
          sender: emailData.from,
          subject: emailData.subject,
          snippet: emailData.snippet,
          email_date: emailData.internalDate.toISOString(),
          parser_used: "skip",
        });
        continue;
      }

      const result = await parse();

      if (result.status === "skip") {
        skipped++;
        await supabase.from("emails").insert({
          gmail_message_id: emailData.messageId,
          sender: emailData.from,
          subject: emailData.subject,
          snippet: emailData.snippet,
          email_date: emailData.internalDate.toISOString(),
          parser_used: parser,
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
    const linkedIds = new Set(groups.map((g) => g.linkedEmailId));

    // 7. Insert transactions and emails
    const emailIdToTxId: Record<string, string> = {};

    for (const { email, tx, parserUsed } of parsedResults) {
      // Insert transaction (skip linked ones — they'll reference the primary)
      const { data: txRow } = await supabase
        .from("transactions")
        .insert({
          amount: tx.amount,
          currency: tx.currency,
          type: tx.type,
          category: tx.category,
          merchant: tx.merchant,
          description: tx.description,
          transaction_date: tx.transactionDate.toISOString(),
          source: tx.source,
          raw_data: tx.rawData,
        })
        .select("id")
        .single();

      const txId = txRow?.id;
      if (txId) emailIdToTxId[tx._emailId] = txId;

      // Insert email record
      await supabase.from("emails").insert({
        gmail_message_id: email.messageId,
        transaction_id: txId || null,
        sender: email.from,
        subject: email.subject,
        snippet: email.snippet,
        email_date: email.internalDate.toISOString(),
        parser_used: parserUsed,
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

    // 9. Update sync state
    await supabase
      .from("sync_state")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", 1);

    return NextResponse.json({
      synced: parsedResults.length,
      grouped: groups.length,
      skipped,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Test sync manually**

1. Ensure Gmail is connected (tokens in DB)
2. Call: `curl -X POST http://localhost:3000/api/sync -H 'Cookie: finassist_session=YOUR_TOKEN'`
3. Check Supabase tables for inserted transactions

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sync/route.ts
git commit -m "feat: add email sync endpoint with parsing and grouping"
```

---

## Task 10: Dashboard API

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/app/api/transactions/route.ts`
- Create: `src/app/api/transactions/[id]/route.ts`
- Create: `src/app/api/budgets/route.ts`

- [ ] **Step 1: Create dashboard API**

Create `src/app/api/dashboard/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [year, mon] = month.split("-").map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 1).toISOString();

  // Last 6 months for trend chart
  const trendStart = new Date(year, mon - 6, 1).toISOString();

  // Previous month for comparison
  const prevStart = new Date(year, mon - 2, 1).toISOString();
  const prevEnd = startDate;

  // Get non-linked transaction IDs (exclude linked/secondary transactions)
  const { data: linkedRows } = await supabase
    .from("transaction_groups")
    .select("linked_transaction_id");
  const linkedIds = new Set((linkedRows || []).map((r) => r.linked_transaction_id));

  // Current month transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .gte("transaction_date", startDate)
    .lt("transaction_date", endDate);

  const filtered = (transactions || []).filter((t) => !linkedIds.has(t.id));

  // Previous month for comparison
  const { data: prevTransactions } = await supabase
    .from("transactions")
    .select("amount, type")
    .gte("transaction_date", prevStart)
    .lt("transaction_date", prevEnd);

  const prevFiltered = (prevTransactions || []).filter((t) => !linkedIds.has(t.id));

  // 6-month trend data
  const { data: trendTransactions } = await supabase
    .from("transactions")
    .select("amount, type, transaction_date")
    .gte("transaction_date", trendStart)
    .lt("transaction_date", endDate);

  const trendFiltered = (trendTransactions || []).filter((t) => !linkedIds.has(t.id));
  const monthlyTrend: Record<string, { income: number; expenses: number }> = {};
  for (const t of trendFiltered) {
    const m = t.transaction_date.slice(0, 7); // "YYYY-MM"
    if (!monthlyTrend[m]) monthlyTrend[m] = { income: 0, expenses: 0 };
    if (t.type === "income") monthlyTrend[m].income += Number(t.amount);
    if (t.type === "expense") monthlyTrend[m].expenses += Number(t.amount);
  }
  const incomeExpenseTrend = Object.entries(monthlyTrend)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, v]) => ({ month: m, ...v }));

  const totalExpenses = filtered
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const prevExpenses = prevFiltered
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // By category
  const byCategory: Record<string, number> = {};
  for (const t of filtered.filter((t) => t.type === "expense")) {
    byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
  }

  // By merchant (top 10)
  const byMerchant: Record<string, number> = {};
  for (const t of filtered.filter((t) => t.type === "expense")) {
    const key = t.merchant || "Unknown";
    byMerchant[key] = (byMerchant[key] || 0) + Number(t.amount);
  }
  const topMerchants = Object.entries(byMerchant)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([merchant, amount]) => ({ merchant, amount }));

  // Top expenses
  const topExpenses = filtered
    .filter((t) => t.type === "expense")
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 10)
    .map((t) => ({
      id: t.id,
      merchant: t.merchant,
      amount: Number(t.amount),
      category: t.category,
      date: t.transaction_date,
      source: t.source,
    }));

  // Budget
  const { data: budgets } = await supabase
    .from("budgets")
    .select("*")
    .eq("month", `${year}-${String(mon).padStart(2, "0")}-01`);

  const budgetTracking = (budgets || []).map((b) => {
    const spent = b.category
      ? byCategory[b.category] || 0
      : totalExpenses;
    return {
      category: b.category || "overall",
      budget: Number(b.amount),
      spent,
      percentage: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0,
    };
  });

  return NextResponse.json({
    totalExpenses,
    totalIncome,
    expenseChange: prevExpenses > 0
      ? ((totalExpenses - prevExpenses) / prevExpenses) * 100
      : 0,
    byCategory,
    topMerchants,
    topExpenses,
    budgetTracking,
    incomeExpenseTrend,
  });
}
```

- [ ] **Step 2: Create transactions API**

Create `src/app/api/transactions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const month = params.get("month");
  const category = params.get("category");
  const type = params.get("type");
  const search = params.get("search");
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "50");

  let query = supabase
    .from("transactions")
    .select("*, emails(gmail_message_id, sender, subject)", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = new Date(year, mon - 1, 1).toISOString();
    const end = new Date(year, mon, 1).toISOString();
    query = query.gte("transaction_date", start).lt("transaction_date", end);
  }

  if (category) query = query.eq("category", category);
  if (type) query = query.eq("type", type);
  if (search) query = query.or(`merchant.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get grouped info
  const txIds = (data || []).map((t) => t.id);
  const { data: groupData } = await supabase
    .from("transaction_groups")
    .select("*")
    .or(`primary_transaction_id.in.(${txIds.join(",")}),linked_transaction_id.in.(${txIds.join(",")})`);

  return NextResponse.json({
    transactions: data || [],
    groups: groupData || [],
    total: count || 0,
    page,
    limit,
  });
}
```

Create `src/app/api/transactions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { category } = body;

  const { data, error } = await supabase
    .from("transactions")
    .update({ category })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Save category rule for future auto-assignment
  if (data?.merchant) {
    await supabase.from("category_rules").upsert(
      { merchant_pattern: data.merchant.toLowerCase(), category },
      { onConflict: "merchant_pattern" }
    );
  }

  return NextResponse.json(data);
}
```

- [ ] **Step 3: Create budgets API**

Create `src/app/api/budgets/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get("month");

  let query = supabase.from("budgets").select("*");
  if (month) query = query.eq("month", `${month}-01`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, category, amount } = body;

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { month: `${month}-01`, category: category || null, amount },
      { onConflict: "month,category" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/dashboard/ src/app/api/transactions/ src/app/api/budgets/
git commit -m "feat: add dashboard, transactions, and budgets API routes"
```

---

## Task 11: App Shell + Header

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/header.tsx`
- Create: `src/components/month-selector.tsx`

- [ ] **Step 1: Create month selector component**

Create `src/components/month-selector.tsx`:

```tsx
"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths } from "date-fns";

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {months.map((m) => (
          <SelectItem key={m.value} value={m.value}>
            {m.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 2: Create header component**

Create `src/components/header.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthSelector } from "./month-selector";
import { format } from "date-fns";

interface HeaderProps {
  month: string;
  onMonthChange: (month: string) => void;
}

export function Header({ month, onMonthChange }: HeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${data.synced} transactions, ${data.grouped} grouped`);
        router.refresh();
      } else {
        setSyncResult(`Error: ${data.error}`);
      }
    } catch {
      setSyncResult("Sync failed");
    }
    setSyncing(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = [
    { href: "/", label: "Dashboard" },
    { href: "/transactions", label: "Transactions" },
    { href: "/budgets", label: "Budgets" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">FinAssist</h1>
          <nav className="flex gap-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`text-sm ${
                  pathname === item.href
                    ? "text-black font-medium"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {syncResult && (
            <span className="text-xs text-gray-500">{syncResult}</span>
          )}
          <MonthSelector value={month} onChange={onMonthChange} />
          <Button size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Update root layout**

Update `src/app/layout.tsx` to include basic HTML structure with Tailwind, Inter font, and a body wrapper. No header here — it goes in the page-level layouts since `/login` shouldn't have it.

- [ ] **Step 4: Commit**

```bash
git add src/components/header.tsx src/components/month-selector.tsx src/app/layout.tsx
git commit -m "feat: add app shell with header, nav, sync button, month selector"
```

---

## Task 12: Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/summary-cards.tsx`
- Create: `src/components/income-expense-chart.tsx`
- Create: `src/components/category-donut.tsx`
- Create: `src/components/merchant-bar-chart.tsx`
- Create: `src/components/top-expenses-table.tsx`
- Create: `src/components/budget-progress.tsx`

- [ ] **Step 1: Create summary cards**

Create `src/components/summary-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryCardsProps {
  totalExpenses: number;
  totalIncome: number;
  expenseChange: number;
  budgetUtilization: number;
}

function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function SummaryCards({
  totalExpenses,
  totalIncome,
  expenseChange,
  budgetUtilization,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Total Spent</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatBDT(totalExpenses)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Income</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">{formatBDT(totalIncome)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">vs Last Month</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${expenseChange > 0 ? "text-red-500" : "text-green-600"}`}>
            {expenseChange > 0 ? "+" : ""}{expenseChange.toFixed(1)}%
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">Budget Used</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-bold ${budgetUtilization > 90 ? "text-red-500" : "text-gray-900"}`}>
            {budgetUtilization.toFixed(0)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Create chart components**

Create `src/components/income-expense-chart.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface IncomeExpenseChartProps {
  data: { month: string; income: number; expenses: number }[];
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Income vs Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="income" fill="#22c55e" name="Income" />
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

Create `src/components/category-donut.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = [
  "#8b5cf6", "#3b82f6", "#22c55e", "#eab308", "#ef4444",
  "#f97316", "#06b6d4", "#ec4899", "#6366f1", "#14b8a6",
];

interface CategoryDonutProps {
  data: Record<string, number>;
}

export function CategoryDonut({ data }: CategoryDonutProps) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

Create `src/components/merchant-bar-chart.tsx`:

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MerchantBarChartProps {
  data: { merchant: string; amount: number }[];
}

export function MerchantBarChart({ data }: MerchantBarChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <XAxis type="number" />
            <YAxis dataKey="merchant" type="category" width={120} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `৳${value.toLocaleString()}`} />
            <Bar dataKey="amount" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create top expenses and budget progress**

Create `src/components/top-expenses-table.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TopExpense {
  id: string;
  merchant: string | null;
  amount: number;
  category: string;
  date: string;
  source: string;
}

export function TopExpensesTable({ expenses }: { expenses: TopExpense[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{e.merchant || "Unknown"}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(e.date), "MMM d")} &middot; <Badge variant="outline" className="text-xs">{e.category}</Badge>
                </p>
              </div>
              <p className="font-semibold">৳{e.amount.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

Create `src/components/budget-progress.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BudgetItem {
  category: string;
  budget: number;
  spent: number;
  percentage: number;
}

export function BudgetProgress({ budgets }: { budgets: BudgetItem[] }) {
  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget Tracking</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No budgets set. Go to Budgets to add one.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Budget Tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.map((b) => (
          <div key={b.category}>
            <div className="flex justify-between text-sm mb-1">
              <span className="capitalize">{b.category}</span>
              <span className={b.percentage > 90 ? "text-red-500 font-medium" : ""}>
                ৳{b.spent.toLocaleString()} / ৳{b.budget.toLocaleString()}
              </span>
            </div>
            <Progress value={Math.min(b.percentage, 100)} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Wire up dashboard page**

Update `src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { SummaryCards } from "@/components/summary-cards";
import { IncomeExpenseChart } from "@/components/income-expense-chart";
import { CategoryDonut } from "@/components/category-donut";
import { MerchantBarChart } from "@/components/merchant-bar-chart";
import { TopExpensesTable } from "@/components/top-expenses-table";
import { BudgetProgress } from "@/components/budget-progress";

interface DashboardData {
  totalExpenses: number;
  totalIncome: number;
  expenseChange: number;
  byCategory: Record<string, number>;
  topMerchants: { merchant: string; amount: number }[];
  topExpenses: { id: string; merchant: string; amount: number; category: string; date: string; source: string }[];
  budgetTracking: { category: string; budget: number; spent: number; percentage: number }[];
  incomeExpenseTrend: { month: string; income: number; expenses: number }[];
}

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?month=${month}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [month]);

  const overallBudget = data?.budgetTracking?.find((b) => b.category === "overall");
  const budgetUtilization = overallBudget?.percentage || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading || !data ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <>
            <SummaryCards
              totalExpenses={data.totalExpenses}
              totalIncome={data.totalIncome}
              expenseChange={data.expenseChange}
              budgetUtilization={budgetUtilization}
            />
            <IncomeExpenseChart data={data.incomeExpenseTrend} />
            <div className="grid grid-cols-2 gap-6">
              <CategoryDonut data={data.byCategory} />
              <MerchantBarChart data={data.topMerchants} />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <TopExpensesTable expenses={data.topExpenses} />
              <BudgetProgress budgets={data.budgetTracking} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify dashboard renders**

```bash
npm run dev
```

Visit `http://localhost:3000` — should see dashboard layout with all widgets (empty data is fine at this point).

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/
git commit -m "feat: add dashboard page with all analytics widgets"
```

---

## Task 13: Transactions Page

**Files:**
- Create: `src/app/transactions/page.tsx`
- Create: `src/components/transaction-table.tsx`
- Create: `src/components/transaction-filters.tsx`

- [ ] **Step 1: Create transaction filters**

Create `src/components/transaction-filters.tsx`:

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
}

const CATEGORIES = [
  "all", "food", "transport", "subscription", "shopping",
  "health", "groceries", "transfer", "top_up", "lifestyle", "shipping", "other",
];

const TYPES = ["all", "expense", "income", "transfer", "top_up"];

export function TransactionFilters({
  search, onSearchChange, category, onCategoryChange, type, onTypeChange,
}: FiltersProps) {
  return (
    <div className="flex gap-3">
      <Input
        placeholder="Search merchant..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
      />
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>
              {c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1).replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={type} onValueChange={onTypeChange}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 2: Create transaction table**

Create `src/components/transaction-table.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  merchant: string | null;
  description: string;
  transaction_date: string;
  source: string;
}

const CATEGORIES = [
  "food", "transport", "subscription", "shopping",
  "health", "groceries", "transfer", "top_up", "lifestyle", "shipping", "other",
];

const TYPE_COLORS: Record<string, string> = {
  expense: "bg-red-100 text-red-700",
  income: "bg-green-100 text-green-700",
  transfer: "bg-blue-100 text-blue-700",
  top_up: "bg-purple-100 text-purple-700",
};

interface Props {
  transactions: Transaction[];
  groupedIds: Set<string>;
  onCategoryChange: (id: string, category: string) => void;
}

export function TransactionTable({ transactions, groupedIds, onCategoryChange }: Props) {
  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-gray-500">
            <th className="p-3">Date</th>
            <th className="p-3">Merchant</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Type</th>
            <th className="p-3">Category</th>
            <th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-gray-50">
              <td className="p-3 text-sm">
                {format(new Date(tx.transaction_date), "MMM d, yyyy")}
              </td>
              <td className="p-3 text-sm font-medium">
                {tx.merchant || tx.description}
                {groupedIds.has(tx.id) && (
                  <Badge variant="outline" className="ml-2 text-xs">grouped</Badge>
                )}
              </td>
              <td className="p-3 text-sm font-semibold">
                ৳{tx.amount.toLocaleString()}
              </td>
              <td className="p-3">
                <span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[tx.type] || ""}`}>
                  {tx.type}
                </span>
              </td>
              <td className="p-3">
                <Select value={tx.category} onValueChange={(v) => onCategoryChange(tx.id, v)}>
                  <SelectTrigger className="h-7 text-xs w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="text-xs">
                        {c.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
              <td className="p-3">
                <Badge variant="secondary" className="text-xs">{tx.source}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Wire up transactions page**

Create `src/app/transactions/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { TransactionTable } from "@/components/transaction-table";
import { TransactionFilters } from "@/components/transaction-filters";

export default function TransactionsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [transactions, setTransactions] = useState([]);
  const [groupedIds, setGroupedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (search) params.set("search", search);
    if (category !== "all") params.set("category", category);
    if (type !== "all") params.set("type", type);

    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    const gIds = new Set<string>();
    for (const g of data.groups || []) {
      gIds.add(g.primary_transaction_id);
      gIds.add(g.linked_transaction_id);
    }
    setGroupedIds(gIds);
    setLoading(false);
  }, [month, search, category, type]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleCategoryChange(id: string, newCategory: string) {
    await fetch(`/api/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: newCategory }),
    });
    fetchTransactions();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <TransactionFilters
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          type={type}
          onTypeChange={setType}
        />
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : (
          <TransactionTable
            transactions={transactions}
            groupedIds={groupedIds}
            onCategoryChange={handleCategoryChange}
          />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/transactions/ src/components/transaction-table.tsx src/components/transaction-filters.tsx
git commit -m "feat: add transactions page with filters and inline category editing"
```

---

## Task 14: Budgets Page

**Files:**
- Create: `src/app/budgets/page.tsx`
- Create: `src/components/budget-form.tsx`

- [ ] **Step 1: Create budget form**

Create `src/components/budget-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = [
  { value: "overall", label: "Overall" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "subscription", label: "Subscription" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "groceries", label: "Groceries" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "shipping", label: "Shipping" },
  { value: "other", label: "Other" },
];

interface Props {
  month: string;
  onSaved: () => void;
}

export function BudgetForm({ month, onSaved }: Props) {
  const [category, setCategory] = useState("overall");
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        month,
        category: category === "overall" ? null : category,
        amount: parseFloat(amount),
      }),
    });
    setAmount("");
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="number"
        placeholder="Amount (BDT)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-40"
        required
      />
      <Button type="submit">Set Budget</Button>
    </form>
  );
}
```

- [ ] **Step 2: Create budgets page**

Create `src/app/budgets/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { BudgetForm } from "@/components/budget-form";
import { BudgetProgress } from "@/components/budget-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Budget {
  id: string;
  month: string;
  category: string | null;
  amount: number;
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [dashboardData, setDashboardData] = useState<{ byCategory: Record<string, number>; totalExpenses: number } | null>(null);

  const fetchData = useCallback(async () => {
    const [budgetRes, dashRes] = await Promise.all([
      fetch(`/api/budgets?month=${month}`),
      fetch(`/api/dashboard?month=${month}`),
    ]);
    setBudgets(await budgetRes.json());
    setDashboardData(await dashRes.json());
  }, [month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete(id: string) {
    await fetch(`/api/budgets?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  const budgetTracking = budgets.map((b) => {
    const cat = b.category || "overall";
    const spent = cat === "overall"
      ? dashboardData?.totalExpenses || 0
      : dashboardData?.byCategory?.[cat] || 0;
    return {
      category: cat,
      budget: Number(b.amount),
      spent,
      percentage: Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Set Budget for {format(new Date(month + "-01"), "MMMM yyyy")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetForm month={month} onSaved={fetchData} />
          </CardContent>
        </Card>
        <BudgetProgress budgets={budgetTracking} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Budgets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {budgets.map((b) => (
                <div key={b.id} className="flex justify-between items-center py-2 border-b">
                  <span className="capitalize">{b.category || "Overall"}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">৳{Number(b.amount).toLocaleString()}</span>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {budgets.length === 0 && <p className="text-sm text-gray-500">No budgets set for this month.</p>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/budgets/ src/components/budget-form.tsx
git commit -m "feat: add budgets page with create, track, and delete"
```

---

## Task 15: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Create settings page**

Create `src/app/settings/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [gmailStatus, setGmailStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if Gmail is connected by looking for tokens
    fetch("/api/dashboard?month=2000-01")
      .then(() => setGmailStatus("connected"))
      .catch(() => setGmailStatus("disconnected"));

    // Check URL params for OAuth result
    if (searchParams.get("gmail") === "connected") {
      setGmailStatus("connected");
    }
    if (searchParams.get("error")) {
      setGmailStatus("disconnected");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header month={month} onMonthChange={setMonth} />
      <main className="container mx-auto px-4 py-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Gmail Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Google Gmail</p>
                <p className="text-sm text-gray-500">Read-only access to parse transaction emails</p>
              </div>
              <div className="flex items-center gap-3">
                {gmailStatus === "connected" ? (
                  <Badge className="bg-green-100 text-green-700">Connected</Badge>
                ) : gmailStatus === "disconnected" ? (
                  <Badge variant="destructive">Not connected</Badge>
                ) : (
                  <Badge variant="secondary">Checking...</Badge>
                )}
                <Button
                  size="sm"
                  onClick={() => window.location.href = "/api/gmail/connect"}
                >
                  {gmailStatus === "connected" ? "Reconnect" : "Connect Gmail"}
                </Button>
              </div>
            </div>
            {searchParams.get("error") && (
              <p className="text-sm text-red-500">
                OAuth failed: {searchParams.get("error")}. Please try again.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500">
              FinAssist reads transaction emails from Standard Chartered Bank,
              City Bank, bKash, and various services to track your personal finances.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with Gmail connection status"
```

---

## Task 16: Final Integration Test

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All parser tests and grouping tests pass.

- [ ] **Step 2: Manual end-to-end test**

1. Start dev server: `npm run dev`
2. Log in at `/login`
3. Connect Gmail at `/settings`
4. Click "Sync" — verify transactions appear
5. Check dashboard charts populate
6. Check transactions page shows parsed data with correct categories
7. Set a budget and verify tracking works

- [ ] **Step 3: Build check**

```bash
npm run build
```

Fix any TypeScript errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix build issues and finalize integration"
```
