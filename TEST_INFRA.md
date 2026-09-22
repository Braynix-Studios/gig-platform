# TEST_INFRA — GIG Developer Marketplace Test Infrastructure & Specification

## 1. Overview & Test Architecture

The GIG developer marketplace is a mission-critical, two-sided developer platform built on Next.js 15 and Supabase PostgreSQL. This document defines the authoritative test infrastructure, design patterns, testing methodology, and requirement-driven test inventory covering all 49 identified bugs, architectural flaws, and missing invariants across the platform.

### Test Stack & Runner
- **Test Framework**: Vitest (v3.2.7) configured via `vitest.config.js`.
- **Test Runner Command**: `npm test` (invokes `vitest run`).
- **Module Resolution**: Path alias `@/` mapping to project root `/home/dev/Desktop/projects/GIG/GIG/alpha-v0.1`.
- **Isolation Strategy**: Pure in-memory sandboxing with isolated mock fixtures for Supabase client, auth sessions, and external GitHub REST endpoints.
- **Progression**: Strictly progressive and opaque-box requirement-driven. Tests evaluate interface contracts, state machine transitions, and database atomic invariants without modifying production code.

---

## 2. Test Design Methodology & Project Patterns

To ensure exhaustive, adversarial, and defect-revealing coverage, all test suites adhere to four formal test design patterns:

### 2.1 Category-Partition Method
Input spaces and environment parameters are partitioned into mutually exclusive equivalence classes:
1. **User Role**: `[developer, business, missing_from_db, invalid_role, unauthenticated]`.
2. **GitHub Linkage**: `[linked_valid_handle, missing_handle, purely_numeric_id, reserved_string_like_user_none]`.
3. **Task & Escrow State**: `[open, claimed, closed, non_existent, opted_in_repo, non_opted_in_repo, foreign_company_repo]`.
4. **Reward Amount**: `[> 0, == 0, < 0, non_numeric, null, undefined]`.
5. **Withdrawal Amount**: `[< 500 (below min threshold), == 500, > 500, > available_balance, negative, non_numeric]`.
6. **PR Verification**: `[valid_matching_repo_merged, valid_matching_repo_unmerged, valid_mismatched_repo, 404_not_found, malformed_url]`.
7. **Claim Lifecycle**: `[active (< 48h), expired (>= 48h), completed, changes_requested, double_claim]`.

### 2.2 Boundary Value Analysis (BVA)
Boundary testing targets vulnerable transition points:
- **Withdrawal Minimum**: Amounts ₹499 (rejected), ₹500 (accepted minimum), ₹501 (accepted).
- **Balance Limits**: Available balance `B`. Debit `B - 1` (success), `B` (success, zero balance remaining), `B + 1` (insufficient balance error).
- **Claim Expiry (48-Hour Lock)**:
  - `claimed_at + 47 hours 59 minutes`: active, locking honored.
  - `claimed_at + 48 hours 00 minutes`: boundary transition.
  - `claimed_at + 48 hours 01 minutes`: expired, must not appear in active claims, permits competitor claim.
- **Task Escrow Amount**: Reward `0` (rejected), `-100` (rejected), `1` (minimum valid bounty).

### 2.3 Pairwise Combinatorial Testing
Interaction combinations between independent variables:
- `(User Role = developer) × (GitHub Linkage = true) × (Claim State = active) × (PR Repo = match) → Approved submission path`
- `(User Role = developer) × (GitHub Linkage = false) × (Claim State = none) → Claim blocked by GitHub prerequisite`
- `(User Role = business) × (Repo Owner = matching company) × (Opted In = true) → Task posted with atomic escrow`
- `(User Role = business) × (Repo Owner = competitor company) × (Opted In = true) → Rejected with 403 Forbidden`
- `(Sponsor Decision = changes_requested) × (PR Status = pending) → Claim remains active, status updated`

### 2.4 Real-World Application Scenarios (E2E User Journeys)
End-to-end integration workflows simulating production use cases:
- Complete developer bounty lifecycle: Task Post with Escrow → Issue Claim → PR Submit → GitHub REST Merge Verification → Sponsor Approval → Pending Reward Hold → Payout Confirmation → Wallet Withdrawal.
- Iterative feedback loop: Sponsor Requests Changes → Claim preserved → Resubmission → Approval.
- Adversarial attack resilience: Concurrent overdraw race simulation, cross-tenant task injection, fake PR repo binding spoofing.

---

## 3. Four-Tier Test Architecture

The test suite is organized into four complementary tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   TIER 4: REAL-WORLD APPLICATION SCENARIOS                  │
│       End-to-end user workflows, multi-step personas, adversarial attacks   │
├─────────────────────────────────────────────────────────────────────────────┤
│                   TIER 3: CROSS-FEATURE COMBINATIONS                        │
│    Escrow -> Claim -> PR -> GitHub Verify -> Review -> Pending -> Payout    │
├─────────────────────────────────────────────────────────────────────────────┤
│                   TIER 2: BOUNDARY & CORNER CASES                           │
│   Zero/negative balances, expired claims, duplicate submissions, races      │
├─────────────────────────────────────────────────────────────────────────────┤
│                   TIER 1: FEATURE COVERAGE                                  │
│         Representative functional tests for each of the 49 features         │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Tier 1: Feature Coverage**: Verifies that every single feature in the inventory performs its core functional contract under nominal inputs.
- **Tier 2: Boundary & Corner Cases**: Exercises boundary values, edge conditions, invalid input combinations, duplicate actions, and concurrency races.
- **Tier 3: Cross-Feature Combinations**: Validates integration across multi-module pipelines where output of one feature cascades into the next.
- **Tier 4: Real-World Scenarios**: Full behavioral user journeys mirroring actual developer and enterprise sponsor interactions on the marketplace.

---

## 4. Comprehensive Feature Inventory & Test Mapping Matrix (All 49 Features)

| # | Feature ID | Feature Name | Test Suite | Test Case Function | Tier | Derivation Source |
|---|------------|--------------|------------|--------------------|------|-------------------|
| 1 | R1a.1 | Atomic wallet credit RPC | `tests/atomic-wallet-ledger.test.ts` | `test_r1a1_atomic_credit_reward_rpc_contract` | Tier 1 | ORIGINAL_REQUEST §R1a |
| 2 | R1a.2 | Atomic wallet debit RPC | `tests/atomic-wallet-ledger.test.ts` | `test_r1a2_atomic_debit_wallet_rpc_contract` | Tier 1 | ORIGINAL_REQUEST §R1a |
| 3 | R1a.3 | DB operations atomic integration | `tests/atomic-wallet-ledger.test.ts` | `test_r1a3_db_operations_atomic_integration` | Tier 1 | ORIGINAL_REQUEST §R1a |
| 4 | R1b.1 | Reward status schema (PENDING) | `tests/atomic-wallet-ledger.test.ts` | `test_r1b1_reward_status_schema_pending` | Tier 1 | ORIGINAL_REQUEST §R1b |
| 5 | R1b.2 | Reward approval lifecycle | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r1b2_review_submission_sets_pending_reward` | Tier 1 | ORIGINAL_REQUEST §R1b |
| 6 | R1b.3 | Fix inverted idempotency bug | `tests/atomic-wallet-ledger.test.ts` | `test_r1b3_credit_reward_idempotency_checks_transactions` | Tier 1 | Survey Explorer DB |
| 7 | R1c.1 | Withdrawal status lifecycle | `tests/atomic-wallet-ledger.test.ts` | `test_r1c1_withdrawal_status_machine_lifecycle` | Tier 1 | ORIGINAL_REQUEST §R1c |
| 8 | R1c.2 | Withdrawal route non-instant debit | `tests/withdrawal.test.ts` | `test_r1c2_withdrawal_route_creates_requested_status` | Tier 1 | ORIGINAL_REQUEST §R1c |
| 9 | R1c.3 | Withdrawal confirmation hook/RPC | `tests/atomic-wallet-ledger.test.ts` | `test_r1c3_withdrawal_confirmation_hook` | Tier 1 | ORIGINAL_REQUEST §R1c |
| 10 | R1d.1 | Atomic escrow task creation RPC | `tests/task-escrow.test.ts` | `test_r1d1_atomic_create_task_with_escrow_rpc` | Tier 1 | ORIGINAL_REQUEST §R1d |
| 11 | R1d.2 | Task route escrow integration | `tests/task-escrow.test.ts` | `test_r1d2_task_route_escrow_atomicity` | Tier 1 | ORIGINAL_REQUEST §R1d |
| 12 | R1e.1 | GitHub REST API client | `tests/github-pr-verification.test.ts` | `test_r1e1_github_rest_api_client_request` | Tier 1 | ORIGINAL_REQUEST §R1e |
| 13 | R1e.2 | PR exists verification on review | `tests/github-pr-verification.test.ts` | `test_r1e2_review_rejects_nonexistent_pr` | Tier 1 | ORIGINAL_REQUEST §R1e |
| 14 | R1e.3 | PR repo binding verification on review | `tests/github-pr-verification.test.ts` | `test_r1e3_review_rejects_mismatched_repo_pr` | Tier 1 | ORIGINAL_REQUEST §R1e |
| 15 | R1e.4 | PR merged state verification | `tests/github-pr-verification.test.ts` | `test_r1e4_review_rejects_unmerged_pr` | Tier 1 | ORIGINAL_REQUEST §R1e |
| 16 | R1f.1 | PR URL parser & validator | `tests/github-pr-verification.test.ts` | `test_r1f1_pr_url_parser_validation` | Tier 1 | ORIGINAL_REQUEST §R1f |
| 17 | R1f.2 | PR repo matching check on submit | `tests/github-pr-verification.test.ts` | `test_r1f2_submit_pr_rejects_foreign_repository` | Tier 1 | ORIGINAL_REQUEST §R1f |
| 18 | R1g.1 | Unique submission constraint | `tests/concurrency-and-uniqueness.test.ts` | `test_r1g1_contributions_unique_submission_constraint` | Tier 1 | ORIGINAL_REQUEST §R1g |
| 19 | R1g.2 | Unique contribution violation handling | `tests/concurrency-and-uniqueness.test.ts` | `test_r1g2_create_contribution_handles_unique_violation` | Tier 1 | ORIGINAL_REQUEST §R1g |
| 20 | R1h.1 | Conditional submission review update | `tests/concurrency-and-uniqueness.test.ts` | `test_r1h1_conditional_submission_review_update` | Tier 1 | ORIGINAL_REQUEST §R1h |
| 21 | R1h.2 | Conditional claim status update | `tests/concurrency-and-uniqueness.test.ts` | `test_r1h2_conditional_claim_status_update` | Tier 1 | ORIGINAL_REQUEST §R1h |
| 22 | R1h.3 | Conditional task status update | `tests/concurrency-and-uniqueness.test.ts` | `test_r1h3_conditional_task_status_update` | Tier 1 | ORIGINAL_REQUEST §R1h |
| 23 | R2a.1 | Remove role metadata fallback | `tests/role-and-tenant-isolation.test.ts` | `test_r2a1_get_session_ignores_user_metadata_role` | Tier 1 | ORIGINAL_REQUEST §R2a |
| 24 | R2a.2 | Incomplete onboarding rejection | `tests/role-and-tenant-isolation.test.ts` | `test_r2a2_get_session_returns_null_when_user_missing` | Tier 1 | ORIGINAL_REQUEST §R2a |
| 25 | R2b.1 | Claims expires_at column & index | `tests/claims-expiry.test.ts` | `test_r2b1_claims_schema_has_expires_at` | Tier 1 | ORIGINAL_REQUEST §R2b |
| 26 | R2b.2 | Set expires_at on claim (+48h) | `tests/claims-expiry.test.ts` | `test_r2b2_claim_task_sets_48h_expiry` | Tier 1 | ORIGINAL_REQUEST §R2b |
| 27 | R2b.3 | Expiry filtering in active claims | `tests/claims-expiry.test.ts` | `test_r2b3_active_claim_queries_filter_expired` | Tier 1 | ORIGINAL_REQUEST §R2b |
| 28 | R2b.4 | Stale claim state cleanup | `tests/claims-expiry.test.ts` | `test_r2b4_stale_claim_lazy_cleanup` | Tier 1 | Survey Explorer DB |
| 29 | R2c.1 | Business dashboard repo scoping | `tests/role-and-tenant-isolation.test.ts` | `test_r2c1_business_dashboard_scopes_repositories` | Tier 1 | ORIGINAL_REQUEST §R2c |
| 30 | R2c.2 | Business tasks query isolation | `tests/role-and-tenant-isolation.test.ts` | `test_r2c2_business_dashboard_isolates_open_tasks` | Tier 1 | ORIGINAL_REQUEST §R2c |
| 31 | R2c.3 | Business submissions isolation | `tests/role-and-tenant-isolation.test.ts` | `test_r2c3_business_submissions_isolated_to_company` | Tier 1 | ORIGINAL_REQUEST §R2c |
| 32 | R2e.1 | Remove hardcoded stats constants | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r2e1_no_hardcoded_stats_constants` | Tier 1 | ORIGINAL_REQUEST §R2e |
| 33 | R2e.2 | Remove mock data generators | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r2e2_no_mock_data_generators` | Tier 1 | ORIGINAL_REQUEST §R2e |
| 34 | R2e.3 | Authentic empty/loading UI states | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r2e3_authentic_zero_states_for_new_users` | Tier 1 | ORIGINAL_REQUEST §R2e |
| 35 | R2f.1 | Remove company input from profile UI | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r2f1_profile_view_no_editable_company` | Tier 1 | ORIGINAL_REQUEST §R2f |
| 36 | R2f.2 | Remove profile API company bypass | `tests/role-and-tenant-isolation.test.ts` | `test_r2f2_profile_route_no_company_service_role_bypass` | Tier 1 | Survey Explorer Frontend |
| 37 | R2g.1 | Sidebar metric isolation | `tests/role-and-tenant-isolation.test.ts` | `test_r2g1_sidebar_stats_scoped_to_tenant` | Tier 1 | ORIGINAL_REQUEST §R2g |
| 38 | R2g.2 | Global vs tenant UI labels | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r2g2_clear_distinction_global_vs_tenant_labels` | Tier 1 | ORIGINAL_REQUEST §R2g |
| 39 | R2h.1 | Task reward amount validation | `tests/task-escrow.test.ts` | `test_r2h1_task_creation_requires_positive_reward` | Tier 1 | ORIGINAL_REQUEST §R2h |
| 40 | R2h.2 | Task repo opt-in validation | `tests/task-escrow.test.ts` | `test_r2h2_task_creation_requires_repo_opted_in` | Tier 1 | ORIGINAL_REQUEST §R2h |
| 41 | R2h.3 | Task repo ownership validation | `tests/task-escrow.test.ts` | `test_r2h3_task_creation_enforces_repo_ownership` | Tier 1 | ORIGINAL_REQUEST §R2h |
| 42 | R2i.1 | Atomic balance check and decrement | `tests/withdrawal.test.ts` | `test_r2i1_concurrent_withdrawal_race_prevention` | Tier 2 | ORIGINAL_REQUEST §R2i |
| 43 | R2j.1 | GitHub linkage check in claims | `tests/github-pr-verification.test.ts` | `test_r2j1_claim_issue_requires_github_linkage` | Tier 1 | ORIGINAL_REQUEST §R2j |
| 44 | R3a.1 | Optimistic rollback in IssuePool | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r3a1_issue_pool_optimistic_rollback_contract` | Tier 2 | ORIGINAL_REQUEST §R3a |
| 45 | R3a.2 | Optimistic rollback in PR submit | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r3a2_pr_submit_optimistic_rollback_contract` | Tier 2 | ORIGINAL_REQUEST §R3a |
| 46 | R3b.1 | Remove Web3 & smart contract claims | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r3b1_no_web3_smart_contract_badges` | Tier 1 | ORIGINAL_REQUEST §R3b |
| 47 | R3b.2 | Remove multi-sig escrow claims | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r3b2_no_multisig_escrow_badges` | Tier 1 | ORIGINAL_REQUEST §R3b |
| 48 | R3c.1 | Changes requested workflow | `tests/ui-truthfulness-and-workflow.test.ts` | `test_r3c1_review_submission_supports_changes_requested` | Tier 1 | ORIGINAL_REQUEST §R3c |
| 49 | R3d.1 | Authentic business dashboard identity | `tests/role-and-tenant-isolation.test.ts` | `test_r3d1_business_dashboard_authentic_identity` | Tier 1 | ORIGINAL_REQUEST §R3d |

---

## 5. Test Suite File Structure & Organization

```
tests/
├── session-token.test.ts                 # JWT signing, tamper rejection, secret validation
├── github-profile.test.ts                # GitHub handle sanitization & profile upsert
├── withdrawal.test.ts                    # Withdrawal API, balance checks, concurrent race tests
├── atomic-wallet-ledger.test.ts          # Atomic RPCs, reward/withdrawal lifecycles, idempotency
├── task-escrow.test.ts                   # Task creation atomicity, escrow reservation, repo validation
├── github-pr-verification.test.ts        # GitHub REST PR verification, repo binding, claim prerequisite
├── claims-expiry.test.ts                 # 48h claim locking, expiry boundaries, stale claim cleanup
├── concurrency-and-uniqueness.test.ts    # Unique contribution constraint, race-safe conditional updates
├── role-and-tenant-isolation.test.ts     # Authoritative session role, multi-tenant query isolation
├── ui-truthfulness-and-workflow.test.ts  # Removal of fake constants/badges, rollback, changes requested
└── e2e-developer-marketplace-lifecycle.test.ts # Tier 3 & Tier 4 End-to-end integration workflows
```

---

## 6. Execution & Verification Commands

- **Run all test suites**: `npm test`
- **Run specific test suite**: `npx vitest run tests/task-escrow.test.ts`
- **Run with filter**: `npx vitest run -t "race"`
- **Typecheck verification**: `npm run typecheck`
