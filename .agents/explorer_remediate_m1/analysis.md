# Comprehensive Milestone 1 Remediation Analysis & Implementation Strategy

## 1. Executive Summary

Milestone 1 hardening encountered an **INTEGRITY VIOLATION** during forensic audit and **REQUEST_CHANGES** from Challengers 1 & 2. An exhaustive empirical and architectural investigation reveals five root flaws spanning PostgreSQL database migrations, backend API routes, core database operations, and unit test suites:

1. **SECURITY DEFINER Authorization Bypass**: All 9 elevated and administrative stored procedures in `supabase/migrations/0010_security_boundaries_and_canonical_state.sql` contain `current_user = 'postgres'` or `current_user <> 'postgres'`. Because these functions are declared `SECURITY DEFINER` and owned by `postgres`, PostgreSQL evaluates `current_user` inside the execution context unconditionally to `'postgres'`. This makes all internal caller authorization checks an absolute no-op, allowing any authenticated user to debit any other user's wallet.
2. **Function Signature Overload Ambiguity**: Migration `0010` created a 7-parameter version of `atomic_debit_wallet` without dropping the 6-parameter version created in migration `0007`. Calling `atomic_debit_wallet` with default parameters triggers `ERROR: function public.atomic_debit_wallet(...) is not unique` and leaves an unhardened zombie procedure.
3. **Withdrawal Double-Deduction & Lockout**: The fallback path of `POST /api/wallet/withdrawal` delegates to `debitWallet({ status: 'REQUESTED' })`, which prematurely decrements `wallets.available_balance`. When `PATCH /api/wallet/withdrawal` later confirms `PAID`, it decrements the balance a second time. If the user only had the requested amount, the second deduction fails with "Insufficient balance", causing permanent payout lockout.
4. **Cross-Tenant Escrow Theft**: Neither SQL `atomic_refund_task_escrow` nor TypeScript `refundTaskEscrow` verifies that the business user's company matches the repository owner (`users.company = repositories.owner`). A business user from Company A can pass the task ID of Company B, cancel the task, and have Company B's escrow bounty credited into Company A's wallet.
5. **Mock Decoupling & Test Bypasses**: Application functions in `lib/db-operations.ts` and routes in `app/api/` use `if (!isTestEnv)` to actively bypass RPC execution during tests. Furthermore, contract tests in `tests/atomic-wallet-ledger.test.ts` asserted against direct invocations of `mockSupabase.rpc` rather than exercising application code.

Below is the concrete, line-by-line remediation specification.

---

## 2. Issue 1: Critical Security Boundary Bypass in SQL Procedures (`current_user = 'postgres'`)

### 2.1 Mechanism of Failure
Under PostgreSQL semantics:
- A `SECURITY INVOKER` function executes with the privileges and identity of the caller (`current_user` = caller).
- A `SECURITY DEFINER` function executes with the privileges and identity of the function creator/owner.
Because all migrations are executed by the superuser/owner `postgres`, `current_user` inside a `SECURITY DEFINER` function is **always** `'postgres'`.
Evaluating:
```sql
IF v_role = 'service_role' OR current_user = 'postgres' THEN
```
is logically equivalent to:
```sql
IF v_role = 'service_role' OR true THEN  -- ALWAYS TRUE!
```
The subsequent `ELSIF v_role = 'authenticated' AND v_caller = p_user_id` branch is never evaluated, and any unauthenticated or unauthorized caller bypasses the identity guard.

In administrative procedures, the guard:
```sql
IF COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
```
evaluates `current_user <> 'postgres'` as `false`, making the entire condition `false` and allowing any role to execute the administrative procedure.

### 2.2 Empirical Demonstration
In `tests/m1_challenger_adversarial_suite.py` Test 1.3:
Alice (`role = 'authenticated'`, `uid = alice_id`) calls `atomic_debit_wallet(bob_id, 200, ...)`:
```
Result of Alice debiting Bob: {'ok': True, 'error': None, 'success': True, 'wallet_id': '931f7675-a949-4413-8b26-8e1b121bd4d6', 'newBalance': 1800, 'transaction_id': '...'}
🚨 VULNERABILITY CONFIRMED: Alice successfully debited Bob's wallet in PostgreSQL!
```

### 2.3 Required Changes in `supabase/migrations/0010_security_boundaries_and_canonical_state.sql`
Remove `current_user = 'postgres'` and `current_user <> 'postgres'` across all 9 procedures:

1. **`atomic_debit_wallet` (Line 53)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;
   ```

2. **`atomic_request_withdrawal` (Line 168)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;
   ```

3. **`atomic_claim_task` (Line 291)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: cannot claim issues for another user'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: cannot claim issues for another user'
     );
   END IF;
   ```

4. **`atomic_create_task_with_escrow` (Line 462)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_business_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not match business identity'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_business_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not match business identity'
     );
   END IF;
   ```

5. **`atomic_confirm_withdrawal` (Line 673)**:
   ```sql
   -- Before:
   IF COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;

   -- After:
   IF COALESCE(auth.role(), '') <> 'service_role' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;
   ```

6. **`atomic_credit_reward_pending` (Line 794)**:
   ```sql
   -- Before:
   IF COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;

   -- After:
   IF COALESCE(auth.role(), '') <> 'service_role' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;
   ```

7. **`atomic_credit_topup` (Line 930)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_user_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not own this wallet'
     );
   END IF;
   ```

8. **`atomic_release_reward` (Line 1019)**:
   ```sql
   -- Before:
   IF COALESCE(auth.role(), '') <> 'service_role' AND current_user <> 'postgres' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;

   -- After:
   IF COALESCE(auth.role(), '') <> 'service_role' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: administrative operation requires service_role'
     );
   END IF;
   ```

9. **`atomic_refund_task_escrow` (Line 1126)**:
   ```sql
   -- Before:
   IF v_role = 'service_role' OR current_user = 'postgres' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_business_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not match business identity'
     );
   END IF;

   -- After:
   IF v_role = 'service_role' THEN
     NULL;
   ELSIF v_role = 'authenticated' AND v_caller IS NOT NULL AND v_caller = p_business_id THEN
     NULL;
   ELSE
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: caller does not match business identity'
     );
   END IF;
   ```

---

## 3. Issue 2: PostgreSQL Function Signature Conflict (6 vs 7 Params Overload)

### 3.1 Mechanism of Failure
In PostgreSQL, `CREATE OR REPLACE FUNCTION` matches functions by exact parameter argument types.
- Migration `0007_state_machines_and_atomic_ops.sql` (Line 126):
  `public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid)` (6 parameters).
- Migration `0010_security_boundaries_and_canonical_state.sql` (Line 26):
  `public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid, text)` (7 parameters, with `p_withdrawal_id text DEFAULT NULL`).
Because `0010` does not drop the 6-parameter signature, both signatures coexist in the `public` schema. When a query supplies 2 arguments:
```sql
SELECT public.atomic_debit_wallet('{bob_id}'::uuid, 100::numeric);
```
PostgreSQL identifies two valid candidates (both matching due to default argument clauses) and aborts with:
`ERROR: function public.atomic_debit_wallet(uuid, numeric) is not unique`.

### 3.2 Required Fix in `supabase/migrations/0010_security_boundaries_and_canonical_state.sql`
Immediately prior to defining the 7-parameter function (before line 26), add:
```sql
-- Drop the legacy 6-parameter overload from migration 0007 to avoid signature ambiguity
DROP FUNCTION IF EXISTS public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid);
```
This ensures that the 6-parameter function is removed from the catalog before creating the 7-parameter canonical implementation.

---

## 4. Issue 3: Withdrawal Double-Deduction and Payout Lockout

### 4.1 Mechanism of Failure
In `app/api/wallet/withdrawal/route.ts`:
- **POST Handler** (Lines 69-75):
  When executing the fallback path, it calls:
  ```ts
  const result = await debitWallet({
    userId: session.userId,
    amount: amount,
    currency: "INR",
    status: "REQUESTED",
  }, supabase);
  ```
  `debitWallet` unconditionally decrements `wallets.available_balance = available_balance - amount`.
- **PATCH Handler** (Lines 201-228):
  When the payout completes and PATCH is called with `cleanStatus === 'PAID'`, the fallback logic checks `wallet.available_balance >= amountToDebit`, and then performs:
  ```ts
  const newBalance = (wallet.available_balance ?? 0) - amountToDebit;
  await supabase
    .from("wallets")
    .update({ available_balance: newBalance })
    .eq("id", tx.wallet_id);
  ```
  It decrements the balance a second time!

### 4.2 Impact
1. **Double Debit**: A user with 1,000 INR requesting a 500 INR withdrawal ends up with 0 INR balance after payout confirmation (1,000 - 500 - 500 = 0).
2. **Payout Lockout**: A user with 500 INR requesting a 500 INR withdrawal has their balance reduced to 0 by POST. When PATCH runs, `(wallet.available_balance ?? 0) < amountToDebit` (0 < 500), causing PATCH to reject with 400 "Insufficient balance to complete payout" and mark the transaction `FAILED`. The user is permanently locked out from receiving their money.

### 4.3 Canonical Behavior (Matching SQL `atomic_request_withdrawal`)
1. In `POST`, validate that `available_balance - in_flight >= amount`.
2. Insert a `wallet_transactions` row with `type = 'WITHDRAWAL'`, `status = 'REQUESTED'`, and `amount = -amount`.
3. **DO NOT decrement `wallets.available_balance` in POST**.
4. In `PATCH`, when status transitions to `PAID`, execute the single definitive balance deduction (`available_balance = available_balance - amountToDebit`).

### 4.4 Required Replacement in `app/api/wallet/withdrawal/route.ts`
Replace lines 69-84 in `POST`:
```ts
    // Fallback: validate in-flight accumulation, create REQUESTED transaction WITHOUT decrementing balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("id, available_balance")
      .eq("user_id", session.userId)
      .maybeSingle();

    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 400 });
    }

    const { data: inFlightTxs } = await supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("wallet_id", wallet.id)
      .eq("type", "WITHDRAWAL")
      .in("status", ["REQUESTED", "PROCESSING"]);

    const inFlightTotal = (inFlightTxs ?? []).reduce(
      (sum: number, tx: { amount?: number }) => sum + Math.abs(tx.amount || 0),
      0,
    );

    const availableBalance = wallet.available_balance ?? 0;
    if (availableBalance - inFlightTotal < amount) {
      return NextResponse.json(
        { error: "Insufficient balance after considering in-flight withdrawals" },
        { status: 400 },
      );
    }

    const { data: tx, error: txError } = await supabase
      .from("wallet_transactions")
      .insert({
        wallet_id: wallet.id,
        amount: -Math.abs(amount),
        currency: "INR",
        type: "WITHDRAWAL",
        status: "REQUESTED",
      })
      .select("id")
      .single();

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      status: "REQUESTED",
      newBalance: availableBalance,
      transactionId: tx?.id,
    });
```

---

## 5. Issue 4: Cross-Tenant Escrow Theft in `atomic_refund_task_escrow`

### 5.1 Mechanism of Failure
In `atomic_refund_task_escrow`:
- The procedure verifies `v_caller = p_business_id`, ensuring the caller cannot forge `p_business_id`.
- However, it performs `SELECT ... FROM public.tasks WHERE id = p_task_id FOR UPDATE;` without validating repository ownership.
- It then executes:
  ```sql
  UPDATE public.wallets
  SET available_balance = available_balance + v_task.reward_amount
  WHERE user_id = p_business_id;
  ```
- Any authenticated business user can supply the task ID of another company (e.g. Acme user providing Hooli's task ID) and drain the escrow funds into their own wallet.

The exact same vulnerability exists in the TypeScript fallback in `lib/db-operations.ts` lines 754-820.

### 5.2 Required Changes in `supabase/migrations/0010_security_boundaries_and_canonical_state.sql`
In `atomic_refund_task_escrow`:
1. Declare variables:
   ```sql
   v_user_role text;
   v_user_company text;
   v_repo_owner text;
   ```
2. Lock task with `repository_id`:
   ```sql
   SELECT id, repository_id, status, reward_amount, reward_currency, escrow_locked
   INTO v_task
   FROM public.tasks
   WHERE id = p_task_id
   FOR UPDATE;
   ```
3. Enforce tenant ownership:
   ```sql
   -- Validate business user exists, role is business, and retrieve company
   SELECT role, company INTO v_user_role, v_user_company
   FROM public.users
   WHERE id = p_business_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Business user not found'
     );
   END IF;

   IF v_role <> 'service_role' AND v_user_role <> 'business' THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: only business accounts can refund task escrow'
     );
   END IF;

   -- Validate repository exists and retrieve owner
   SELECT owner INTO v_repo_owner
   FROM public.repositories
   WHERE id = v_task.repository_id;

   IF NOT FOUND THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Target repository not found'
     );
   END IF;

   -- Enforce Multi-tenant isolation: caller company strictly matches repository owner
   IF v_user_company IS NULL OR TRIM(v_user_company) = '' OR LOWER(TRIM(v_user_company)) <> LOWER(TRIM(v_repo_owner)) THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Forbidden: repository does not belong to your company'
     );
   END IF;
   ```

### 5.3 Required Changes in `lib/db-operations.ts` (`refundTaskEscrow` Fallback)
In `lib/db-operations.ts` lines 754-770:
```ts
  const { data: task, error: taskError } = await client
    .from("tasks")
    .select("id, repository_id, status, reward_amount, reward_currency, escrow_locked")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError || !task) {
    return { ok: false, error: "Task not found" };
  }

  // Multi-tenant repository verification
  const { data: userRecord } = await client
    .from("users")
    .select("role, company")
    .eq("id", businessId)
    .maybeSingle();

  if (!userRecord || userRecord.role !== "business") {
    return { ok: false, error: "Forbidden: only business accounts can refund task escrow" };
  }

  const { data: repoRecord } = await client
    .from("repositories")
    .select("owner")
    .eq("id", task.repository_id)
    .maybeSingle();

  if (!repoRecord) {
    return { ok: false, error: "Repository not found" };
  }

  if (
    !userRecord.company ||
    !repoRecord.owner ||
    userRecord.company.trim().toLowerCase() !== repoRecord.owner.trim().toLowerCase()
  ) {
    return { ok: false, error: "Forbidden: repository does not belong to your company" };
  }
```

---

## 6. Issue 5: Mock Decoupling in Tests & Test-Environment Bypasses

### 6.1 Mechanism of Failure
1. **`if (!isTestEnv)` pattern**:
   Found in:
   - `lib/db-operations.ts` (Lines 289, 405, 550, 643, 731)
   - `app/api/tasks/route.ts` (Line 146)
   - `app/api/wallet/withdrawal/route.ts` (Lines 42, 127, 159)
   This condition forcefully suppressed all PostgreSQL RPC invocations during `npm test`, forcing the system into non-atomic fallback paths.
2. **Direct Mock Calls in Contract Tests**:
   In `tests/atomic-wallet-ledger.test.ts`:
   - Line 74: `const rpcResult = await mockSupabase.rpc('atomic_credit_reward_pending', ...);`
   - Line 99: `const rpcResult = await mockSupabase.rpc('atomic_debit_wallet', ...);`
   - Line 197: `const confirmResult = await mockSupabase.rpc('atomic_confirm_withdrawal', ...);`
   - Line 323: `const result = await mockSupabase.rpc('atomic_credit_topup', ...);`
   - Line 345: `const result = await mockSupabase.rpc('atomic_release_reward', ...);`
   These tests called `mockSupabase.rpc` directly and asserted `expect(mockSupabase.rpc).toHaveBeenCalledWith(...)`. They did not exercise `creditReward`, `debitWallet`, `creditTopup`, or `releaseReward`.

### 6.2 Required Changes in Application Code
Remove `!isTestEnv &&` from:
- `lib/db-operations.ts` lines 289, 405, 550, 643, 731
- `app/api/tasks/route.ts` line 146
- `app/api/wallet/withdrawal/route.ts` lines 42, 127, 159
Standardize to:
```ts
if (typeof client.rpc === "function") {
  try {
    const { data, error } = await client.rpc(...);
    if (!error && data) {
      if (data.ok || data.success) {
        return { ok: true, ... };
      }
      return { ok: false, error: data.error || "..." };
    }
  } catch {
    // Fallback to atomic compensation
  }
}
```

### 6.3 Required Changes in `tests/atomic-wallet-ledger.test.ts`
Refactor contract tests so they call the real application functions:
1. `test_r1a1_atomic_credit_reward_rpc_contract`:
   Call `creditReward({ user_id, task_id, amount, currency, contribution_id }, mockSupabase as any)` and assert that `mockSupabase.rpc` was called with `'atomic_credit_reward_pending'` and arguments.
2. `test_r1a2_atomic_debit_wallet_rpc_contract`:
   Call `debitWallet({ userId, amount, currency, type, status }, mockSupabase as any)` and assert that `mockSupabase.rpc` was called with `'atomic_debit_wallet'` and arguments.
3. `test_r2_atomic_credit_topup_rpc_contract`:
   Call `creditTopup({ userId, amount, currency }, mockSupabase as any)` and assert that `mockSupabase.rpc` was called with `'atomic_credit_topup'`.
4. `test_r2_atomic_release_reward_rpc_contract`:
   Call `releaseReward({ transactionId }, mockSupabase as any)` and assert that `mockSupabase.rpc` was called with `'atomic_release_reward'`.
5. For fallback tests (such as `test_r1b1_reward_status_schema_pending` or compensating rollback tests):
   Mock `mockSupabase.rpc.mockImplementationOnce(() => { throw new Error('RPC unavailable'); })` to explicitly test that the fallback compensation path operates properly when RPC is unavailable.

---

## 7. Required Updates to Adversarial Test Suites

### 7.1 `tests/adversarial-financial-state-machines.test.ts`
1. **`empirical_withdrawal_2_audit_premature_deduction_in_fallback`**:
   - Change assertion from `expect(prematurelyDecremented).toBe(true)` to `expect(prematurelyDecremented).toBe(false)` and `expect(balanceUpdateCall).toBeUndefined()`.
2. **`empirical_withdrawal_3_double_deduction_or_confirmation_lockout`**:
   - Update test scenario to verify that POST does not deduct balance, and subsequent PATCH confirmation successfully deducts the balance, transitions to `PAID`, and returns status `200` with `newBalance: 0` (lockout prevented).
3. **`empirical_refund_4_cross_tenant_ownership_stress`**:
   - Change assertion from expecting success to asserting that cross-tenant refund is rejected:
     `expect(res.ok).toBe(false);`
     `expect(res.error).toMatch(/Forbidden: repository does not belong to your company/i);`
     `expect(mockSupabase.update).not.toHaveBeenCalled();`

### 7.2 `tests/withdrawal.test.ts`
1. Update `it('should return 200 for successful withdrawal')` to verify that `POST` returns `newBalance: 1000` (balance unmutated) and `mockSupabase.update` is not called.
2. In `it('should allow transaction owner to confirm payout with PAID status')`, verify that PATCH decrements balance from 1000 to 500 when confirming PAID.

---

## 8. Verification Strategy & Gate Criteria

1. **Database Migration Verification**:
   Execute `psql -h localhost -p 5433 -U postgres -d postgres -f supabase/migrations/0010_security_boundaries_and_canonical_state.sql`.
2. **Live Adversarial PostgreSQL Suite**:
   Run `python3 tests/m1_challenger_adversarial_suite.py`.
   - Test 1.1: Anon access blocked -> PASS
   - Test 1.2: Overload ambiguity eliminated -> PASS
   - Test 1.3: Cross-user debit rejected -> PASS
   - Test 1.4-1.6: Boundary & multi-tenant checks -> PASS
   - Section 2: Concurrency & Stress harnesses -> PASS
   - Exit code must be `0` with `0 VULNERABILITIES DETECTED`.
3. **Unit & Contract Test Suite**:
   Run `npm test`. All 13 test files (including `tests/atomic-wallet-ledger.test.ts`, `tests/withdrawal.test.ts`, `tests/adversarial-financial-state-machines.test.ts`) must pass with 100% green status.
