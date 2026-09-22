# Project: GIG Developer Marketplace Stabilization & Bug Fixing

## Architecture
- **Framework**: Next.js 15 App Router (Server Actions, API Routes)
- **Database**: Supabase PostgreSQL with RLS; additive migrations in `supabase/migrations/`
- **Data Flow**:
  - `Database (PostgreSQL + RLS + RPCs)`:
    - Tables: `users`, `wallets`, `wallet_transactions`, `tasks`, `claims`, `contributions`, `repositories`, `submissions`.
    - Stored Procedures / RPCs: `atomic_debit_wallet`, `atomic_credit_reward_pending`, `atomic_request_withdrawal`, `atomic_confirm_withdrawal`, `atomic_create_task_with_escrow`, `atomic_claim_task`.
  - `Database Layer (lib/db-operations.ts)`:
    - Type-safe wrapper invoking RPCs or atomic SQL operations.
    - Status-conditional mutations (`UPDATE ... WHERE status = $1 RETURNING id`).
  - `Auth & Session Layer (lib/supabaseAuth.ts, lib/session.ts)`:
    - Authoritative role determination solely from `public.users`.
    - Returns `null` for unauthenticated or incomplete profile states.
  - `Server Actions (app/actions/dev-loop.ts, app/actions/business-loop.ts)`:
    - `dev-loop`: GitHub linkage validation, claim creation, PR repo binding verification.
    - `business-loop`: GitHub REST API verification for merged status, changes_requested rejection flow, pending reward crediting.
  - `API Routes (app/api/**)`:
    - `/api/tasks`: Atomic task creation + escrow reservation, validation of reward amount > 0, repo opt-in, repo ownership.
    - `/api/wallet/withdrawal`: Two-phase withdrawal lifecycle (`REQUESTED -> PROCESSING -> PAID | FAILED`).
    - `/api/profile`: Strict profile updates without company override bypass.
  - `Dashboard & UI Layer (lib/dashboard-data.ts, components/dashboard/**)`:
    - Scoped multi-tenant data queries (repositories, backlog tasks, submissions).
    - Authentic identity derivation (actual email/displayName).
    - UI truthfulness: complete removal of fake data, mock arrays, and unbacked Web3/multi-sig claims.
    - Optimistic UI with rollback on server action failure.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1a.1 Atomic wallet credit RPC | Wrap wallet credit and transaction insertion in single atomic RPC (`atomic_credit_reward_pending`) | M1 | ORIGINAL_REQUEST §R1a |
| 2 | R1a.2 Atomic wallet debit RPC | Wrap wallet balance check, debit, and transaction insertion in single atomic RPC (`atomic_debit_wallet`) | M1 | ORIGINAL_REQUEST §R1a, §R2i |
| 3 | R1a.3 DB operations atomic integration | Update `lib/db-operations.ts` (`creditReward`, `debitWallet`) to use atomic RPCs | M2 | ORIGINAL_REQUEST §R1a |
| 4 | R1b.1 Reward status schema | Add `reward_status` or status enum (`PENDING`, `VERIFIED`, `AVAILABLE`) to transactions/claims | M1 | ORIGINAL_REQUEST §R1b |
| 5 | R1b.2 Reward approval lifecycle | In `reviewSubmissionAction()`, set status to `PENDING` without immediately incrementing spendable balance | M2 | ORIGINAL_REQUEST §R1b |
| 6 | R1b.3 Fix inverted idempotency bug | Fix inverted `creditReward` check in `lib/db-operations.ts:275-283` that checks `contributions` table instead of transactions | M2 | Survey Explorer DB |
| 7 | R1c.1 Withdrawal status lifecycle | Implement withdrawal status machine `REQUESTED -> PROCESSING -> PAID | FAILED` | M1 | ORIGINAL_REQUEST §R1c |
| 8 | R1c.2 Withdrawal route non-instant debit | `POST /api/wallet/withdrawal` creates `REQUESTED` transaction without immediately decrementing balance | M2 | ORIGINAL_REQUEST §R1c |
| 9 | R1c.3 Withdrawal confirmation hook/RPC | Implement payout confirmation step (`atomic_confirm_withdrawal`) transitioning to `PAID` and debiting balance | M2 | ORIGINAL_REQUEST §R1c |
| 10 | R1d.1 Atomic escrow task creation RPC | PostgreSQL function `atomic_create_task_with_escrow` guaranteeing all-or-nothing task + escrow debit | M1 | ORIGINAL_REQUEST §R1d |
| 11 | R1d.2 Task route escrow integration | Refactor `app/api/tasks/route.ts` to use atomic escrow RPC instead of pre-debiting before task insert | M2 | ORIGINAL_REQUEST §R1d |
| 12 | R1e.1 GitHub REST API client | Add public GitHub REST API client function to inspect `/repos/{owner}/{repo}/pulls/{number}` | M4 | ORIGINAL_REQUEST §R1e |
| 13 | R1e.2 PR exists verification | Verify PR exists via GitHub REST API before allowing submission approval | M4 | ORIGINAL_REQUEST §R1e |
| 14 | R1e.3 PR repo binding verification on review | Verify PR repository matches task repository before allowing submission approval | M4 | ORIGINAL_REQUEST §R1e |
| 15 | R1e.4 PR merged state verification | Verify PR `merged === true` via GitHub REST API; reject approval if not merged | M4 | ORIGINAL_REQUEST §R1e |
| 16 | R1f.1 PR URL parser & validator | Parse `{owner}/{repo}/{number}` from PR URL in `submitPrAction()` | M4 | ORIGINAL_REQUEST §R1f |
| 17 | R1f.2 PR repo matching check | Verify PR `{owner}/{repo}` strictly matches claimed task's repository | M4 | ORIGINAL_REQUEST §R1f |
| 18 | R1g.1 Unique submission constraint | Add `UNIQUE(submission_id)` constraint on `contributions` table in migration 0007 | M1 | ORIGINAL_REQUEST §R1g |
| 19 | R1g.2 Unique contribution violation handling | Gracefully handle unique constraint violation in `createContribution()` in `lib/db-operations.ts` | M2 | ORIGINAL_REQUEST §R1g |
| 20 | R1h.1 Conditional submission review update | `UPDATE submissions SET pr_status = $1 WHERE id = $2 AND pr_status = 'pending' RETURNING id` with 1-row check | M2 | ORIGINAL_REQUEST §R1h |
| 21 | R1h.2 Conditional claim status update | Atomic conditional update for claim state transitions (`WHERE status = expected RETURNING id`) | M2 | ORIGINAL_REQUEST §R1h |
| 22 | R1h.3 Conditional task status update | Atomic conditional update for task state transitions (`WHERE status = expected RETURNING id`) | M2 | ORIGINAL_REQUEST §R1h |
| 23 | R2a.1 Remove role metadata fallback | In `lib/supabaseAuth.ts:83`, remove fallback to `user_metadata?.role` and default `'developer'` | M3 | ORIGINAL_REQUEST §R2a |
| 24 | R2a.2 Incomplete onboarding rejection | Return `null` from `getSession()` when `public.users` row is absent | M3 | ORIGINAL_REQUEST §R2a |
| 25 | R2b.1 Claims expires_at column | Add `claims.expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours')` + index in migration 0007 | M1 | ORIGINAL_REQUEST §R2b |
| 26 | R2b.2 Set expires_at on claim | Set `expires_at = claimed_at + interval '48 hours'` when creating claim in `claimTask()` | M4 | ORIGINAL_REQUEST §R2b |
| 27 | R2b.3 Expiry filtering in active claims | Add `AND expires_at > NOW()` to `getActiveClaimForTask` and `getActiveClaimForUserAndTask` | M4 | ORIGINAL_REQUEST §R2b |
| 28 | R2b.4 Stale claim state cleanup | Lazily transition expired claims to `status = 'expired'` to prevent blocking partial unique indexes | M4 | Survey Explorer DB |
| 29 | R2c.1 Business dashboard repository scoping | Filter repositories by `owner = user.company` in business dashboard queries | M3 | ORIGINAL_REQUEST §R2c |
| 30 | R2c.2 Business tasks query isolation | Scope open tasks in `lib/dashboard-data.ts` to business-owned repositories only | M3 | ORIGINAL_REQUEST §R2c |
| 31 | R2c.3 Business submissions isolation | Scope submissions reviews to tasks belonging to business-owned repositories | M3 | ORIGINAL_REQUEST §R2c |
| 32 | R2e.1 Remove hardcoded stats constants | Remove fake constants ("98.4", "Alex Rivers", "biz@gig.dev") in `lib/dashboard-stats-defaults.ts` | M5 | ORIGINAL_REQUEST §R2e |
| 33 | R2e.2 Remove mock data generators | Remove mock arrays (Elena Rostova, mock tx hashes, fake metrics) in `lib/dashboard-data.ts` | M5 | ORIGINAL_REQUEST §R2e |
| 34 | R2e.3 Authentic empty/loading UI states | Replace fake fallback data in `DeveloperDashboard.tsx` and `BusinessDashboard.tsx` with clean zero states | M5 | ORIGINAL_REQUEST §R2e |
| 35 | R2f.1 Remove company input from profile UI | Remove editable `Company` field from `ProfileView.tsx` and `DeveloperDashboard.tsx` | M5 | ORIGINAL_REQUEST §R2f |
| 36 | R2f.2 Remove profile API company bypass | Remove `supabaseAdmin` service-role update of `company` in `app/api/profile/route.ts:109-114` | M3 | Survey Explorer Frontend |
| 37 | R2g.1 Sidebar metric isolation | Scope `Tasks Backlog` in `getSidebarStats()` to current business tenant's repositories | M3 | ORIGINAL_REQUEST §R2g |
| 38 | R2g.2 Global vs tenant UI labels | Clearly label network-wide metrics (e.g. "Platform Developers") vs workspace-specific metrics | M5 | ORIGINAL_REQUEST §R2g |
| 39 | R2h.1 Task reward amount validation | Validate `reward_amount > 0` in `POST /api/tasks/route.ts` | M3 | ORIGINAL_REQUEST §R2h |
| 40 | R2h.2 Task repo opt-in validation | Validate `repository.opted_in = true` in `POST /api/tasks/route.ts` | M3 | ORIGINAL_REQUEST §R2h |
| 41 | R2h.3 Task repo ownership validation | Validate repository owner matches `user.company` in `POST /api/tasks/route.ts` | M3 | ORIGINAL_REQUEST §R2h |
| 42 | R2i.1 Atomic balance check and decrement | `UPDATE wallets SET available_balance = available_balance - amount WHERE user_id = $1 AND available_balance >= amount` | M1 | ORIGINAL_REQUEST §R2i |
| 43 | R2j.1 GitHub linkage check in claims | In `claimIssueAction()`, reject claim if `session.githubId` is null or undefined | M4 | ORIGINAL_REQUEST §R2j |
| 44 | R3a.1 Optimistic rollback in IssuePool | Support bidirectional rollback in `IssuePool.tsx` when `claimIssueAction` returns error | M5 | ORIGINAL_REQUEST §R3a |
| 45 | R3a.2 Optimistic rollback in PR submit | Preserve form state and restore submission UI on failed `submitPrAction` | M5 | ORIGINAL_REQUEST §R3a |
| 46 | R3b.1 Remove Web3 & smart contract claims | Remove "ON-CHAIN RECORD SYNCED", "100% smart contract collateralized" badges across all components | M5 | ORIGINAL_REQUEST §R3b |
| 47 | R3b.2 Remove multi-sig escrow claims | Replace "Multi-Sig Escrow Active" with truthful platform escrow indicators | M5 | ORIGINAL_REQUEST §R3b |
| 48 | R3c.1 Changes requested workflow | Add `CHANGES_REQUESTED` path to `reviewSubmissionAction()` preserving claim activity | M4 | ORIGINAL_REQUEST §R3c |
| 49 | R3d.1 Authentic business dashboard identity | Derive `displayName` and `displayEmail` from `session.userId` -> `public.users` in `getBusinessDashboard` | M3 | ORIGINAL_REQUEST §R3d |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Database Migrations & Atomic RPCs | Additive migration `0007_state_machines_and_atomic_ops.sql` (columns, constraints, indexes, 6 RPCs) | none | DONE |


| M2 | Core State Machines & Atomic Ledger / Escrow | `lib/db-operations.ts`, `app/api/tasks/route.ts`, `app/api/wallet/withdrawal/route.ts`, atomic updates | M1 | IN_PROGRESS (worker_m2) |

| M3 | Auth, Role Integrity & Tenant Isolation | `lib/supabaseAuth.ts`, `lib/dashboard-data.ts`, `app/api/profile/route.ts`, `POST /api/tasks` validation | M1 | PLANNED |
| M4 | GitHub Verification & Loop Logic | `app/actions/business-loop.ts`, `app/actions/dev-loop.ts`, GitHub REST API verification, claim 48h locking | M2, M3 | PLANNED |
| M5 | UI Truthfulness & Workflow Integrity | `IssuePool.tsx` rollback, remove fake data/claims, profile UI company field removal | M3, M4 | PLANNED |
| M6 | E2E Testing, Adversarial Verification & Regression | All test tiers, race condition tests, claim expiry tests, GitHub verification tests, integrity audit | M1-M5 | PLANNED |

## Interface Contracts

### 1. Database RPCs ↔ `lib/db-operations.ts`
- `atomic_debit_wallet(p_user_id uuid, p_amount numeric, p_currency text, p_type text, p_status text, p_task_id uuid)`
  - Returns: `jsonb { success: boolean, new_balance: numeric, transaction_id: uuid, error: text }`
- `atomic_create_task_with_escrow(p_business_id uuid, p_repository_id uuid, p_title text, p_issue_url text, p_reward_amount numeric, p_reward_currency text, p_experience_level text, p_tags text[], p_description text)`
  - Returns: `jsonb { success: boolean, task: jsonb, error: text }`
- `atomic_credit_reward_pending(p_user_id uuid, p_task_id uuid, p_amount numeric, p_currency text, p_contribution_id uuid)`
  - Returns: `jsonb { success: boolean, transaction_id: uuid, error: text }`
- `atomic_request_withdrawal(p_user_id uuid, p_amount numeric, p_currency text)`
  - Returns: `jsonb { success: boolean, transaction_id: uuid, new_balance: numeric, error: text }`
- `atomic_confirm_withdrawal(p_transaction_id uuid, p_payout_status text)`
  - Returns: `jsonb { success: boolean, new_balance: numeric, error: text }`

### 2. GitHub REST Verification ↔ `reviewSubmissionAction`
- `verifyGitHubPrStatus(prUrl: string, expectedRepoOwner: string, expectedRepoName: string)`
  - Returns: `Promise<{ valid: boolean; merged: boolean; prNumber: number; repoMatches: boolean; error?: string }>`
  - Uses: `https://api.github.com/repos/{owner}/{repo}/pulls/{number}` (public endpoint, respects optional GITHUB_TOKEN)

### 3. Auth & Session ↔ Application Layer
- `getSession(): Promise<Session | null>`
  - Role derived strictly from `public.users.role`.
  - Returns `null` if user is not authenticated or `public.users` record does not exist.
  - Role is NEVER read from `user.user_metadata`.

### 4. Business Dashboard ↔ Multi-Tenant Scoping
- `getBusinessDashboard(userId: string): Promise<BusinessDashboard | null>`
  - Resolves business user profile: `company`, `email`, `username`.
  - Scopes all queries (tasks, submissions, repositories) by `repository.owner = user.company`.

## Code Layout
- `supabase/migrations/`: Database migrations (`0000_` through `0007_state_machines_and_atomic_ops.sql`).
- `lib/`:
  - `db-operations.ts`: Database query helpers and RPC wrappers.
  - `supabaseAuth.ts`: Authoritative session resolution and role checking.
  - `session.ts`: Next.js cookies / token session decoding.
  - `dashboard-data.ts`: Multi-tenant scoped dashboard data loaders.
  - `dashboard-stats-defaults.ts`: Clean default stats helpers without fake data.
  - `github.ts`: GitHub REST API verification helper for PRs.
- `app/`:
  - `actions/dev-loop.ts`: Developer server actions (claim, submit PR).
  - `actions/business-loop.ts`: Business server actions (review, changes requested).
  - `api/tasks/route.ts`: Validated task creation with atomic escrow.
  - `api/wallet/**`: Two-phase withdrawal lifecycle and balance API.
  - `api/profile/route.ts`: Secure profile updating without RLS bypass.
- `components/`:
  - `dashboard/IssuePool.tsx`: Issue pool with bidirectional optimistic rollback.
  - `dashboard/SubmissionsReviewPanel.tsx`: Review panel supporting changes requested.
  - `dashboard/DeveloperDashboard.tsx`, `BusinessDashboard.tsx`: Clean UI without fake claims/constants.
  - `profile/ProfileView.tsx`: Developer profile with read-only/omitted company field.
- `tests/`:
  - `tests/withdrawal.test.ts`: Existing + concurrent withdrawal race tests.
  - `tests/session-token.test.ts`: Role integrity and missing profile tests.
  - `tests/github-profile.test.ts`: GitHub profile and linkage tests.
  - `tests/claims-expiry.test.ts`: Claim 48h expiry and locking tests.
  - `tests/github-pr-verification.test.ts`: GitHub REST PR validation tests.
  - `tests/task-escrow.test.ts`: Atomic escrow reservation and rollback tests.
