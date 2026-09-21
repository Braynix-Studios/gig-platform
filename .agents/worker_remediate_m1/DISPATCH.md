## 2026-09-21T13:17:18Z

You are worker_remediate_m1, responsible for implementing the complete Milestone 1 remediation.

Your working directory is:
/home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/worker_remediate_m1

MANDATORY FIRST STEP:
Read /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/ORIGINAL_REQUEST.md.

Read the remediation specifications in:
- /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/explorer_remediate_m1/handoff.md
- /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/explorer_remediate_m1/analysis.md
- /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/auditor_harden_m1_1/handoff.md
- /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/challenger_harden_m1_1/handoff.md
- /home/dev/Desktop/projects/GIG/GIG/alpha-v0.1/.agents/challenger_harden_m1_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Implementation Tasks:
1. Fix supabase/migrations/0010_security_boundaries_and_canonical_state.sql:
   a. Prepend: DROP FUNCTION IF EXISTS public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid); before creating the 7-parameter version.
   b. In all elevated functions (atomic_debit_wallet, atomic_request_withdrawal, atomic_claim_task, atomic_create_task_with_escrow, atomic_credit_topup, atomic_refund_task_escrow), REMOVE `OR current_user = 'postgres'`. Require strictly:
      IF v_role = 'service_role' THEN NULL;
      ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN NULL; -- (or v_caller = p_business_id)
      ELSE RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'Forbidden: caller does not own this wallet'); -- or relevant error
      END IF;
   c. In administrative functions (atomic_confirm_withdrawal, atomic_credit_reward_pending, atomic_release_reward), REMOVE `AND current_user <> 'postgres'`. Require strictly:
      IF COALESCE(auth.role(), '') <> 'service_role' THEN RETURN jsonb_build_object('success', false, 'ok', false, 'error', 'Forbidden: administrative operation requires service_role'); END IF;
   d. In atomic_refund_task_escrow, enforce repository company ownership: verify that the caller's company (users.company) strictly matches the repository owner (repositories.owner) for the task being refunded. Reject with `Forbidden: task repository does not belong to your company` if mismatched.
   e. Apply migration 0010 to PostgreSQL 16 on port 5433:
      psql -h localhost -p 5433 -U postgres -d postgres -f supabase/migrations/0010_security_boundaries_and_canonical_state.sql
2. Fix app/api/wallet/withdrawal/route.ts:
   In POST fallback (lines 69-77), do NOT call debitWallet which prematurely decrements available_balance. Instead, verify in-flight amounts against available_balance and insert a transaction record with type = 'WITHDRAWAL' and status = 'REQUESTED' WITHOUT decrementing available_balance. Balance decrement occurs ONLY during PATCH confirmation (PAID).
3. Fix lib/db-operations.ts:
   a. In refundTaskEscrow (lines 755-820), verify that the business user's company matches the task's repository owner before canceling or refunding. Return forbidden error on mismatch.
   b. Ensure clean RPC calling without mock bypasses.
4. Fix and update tests:
   In tests/atomic-wallet-ledger.test.ts, tests/withdrawal.test.ts, and tests/adversarial-financial-state-machines.test.ts:
   Ensure contract tests call exported application functions.
5. Verification:
   - Run python3 tests/m1_challenger_adversarial_suite.py (must exit 0 with 0 vulnerabilities).
   - Run python3 .agents/auditor_harden_m1_1/test_m1_empirical_audit.py (must pass).
   - Run npm test (all tests must pass).
   - Run npx tsc --noEmit (0 type errors).
   - Document all changes and verification command outputs in handoff.md.

Send a completion message via send_message when done.
