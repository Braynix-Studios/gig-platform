#!/usr/bin/env python3
"""
Adversarial Challenge & Empirical Stress Test Suite for Milestone 1 (Authorization & Concurrency)
Target: PostgreSQL 16 on port 5433 with migrations 0000 through 0010.

Evaluates:
1. SQL Authorization Boundaries & Privilege Hardening:
   - Challenge 1.1: Unauthenticated / anon invocation of atomic_debit_wallet (Layer 1 PostgreSQL role permission)
   - Challenge 1.2: Overloaded signature ambiguity bug in atomic_debit_wallet
   - Challenge 1.3: Security Definer 'current_user = postgres' flaw (Cross-user debit verification)
   - Challenge 1.4: Unauthenticated / anon invocation of atomic_request_withdrawal (Layer 1 PostgreSQL role permission)
   - Challenge 1.5: Authenticated caller attempting administrative RPC (atomic_confirm_withdrawal)
   - Challenge 1.6: Multi-tenant isolation in atomic_create_task_with_escrow (Company mismatch rejection)
2. Concurrency & High-Stress Harnesses:
   - Stress 2.1: 50 Concurrent Debits on 10,000 INR balance (300 INR each) -> Zero overdrafts, exact ledger reconciliation
   - Stress 2.2: 10 Concurrent Withdrawal Requests (1,000 INR balance, 600 INR each) -> In-flight accumulation prevents over-reservation
   - Stress 2.3: Double-payout confirmation race on same transaction -> FOR UPDATE prevents duplicate payout
   - Stress 2.4: 10 Concurrent Escrow Task Creations (1,000 INR balance, 400 INR bounty) -> Escrow balance locking
   - Stress 2.5: Escrow refund guards against active vs expired claims
"""

import subprocess
import json
import time
import uuid
import sys
from concurrent.futures import ThreadPoolExecutor

DB_HOST = "localhost"
DB_PORT = "5433"
DB_USER = "postgres"
DB_NAME = "postgres"
DB_PASS = "postgres"

def run_psql(sql, user=DB_USER):
    cmd = [
        "psql",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", user,
        "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
        "-A", "-t",
        "-c", sql
    ]
    env = {"PGPASSWORD": DB_PASS}
    res = subprocess.run(cmd, capture_output=True, text=True, env=env)
    return res.returncode, res.stdout.strip(), res.stderr.strip()

def run_sql_as_context(role="service_role", uid=None, sql=""):
    ctx_sql = []
    sub_val = uid if uid else ""
    ctx_sql.append(f"SELECT set_config('request.jwt.claim.sub', '{sub_val}', false);")
    ctx_sql.append(f"SELECT set_config('request.jwt.claim.role', '{role}', false);")
    ctx_sql.append(sql)
    full_sql = "\n".join(ctx_sql)
    return run_psql(full_sql)

def rpc_as(role, uid, fn_name, *args):
    formatted_args = []
    for a in args:
        if a is None:
            formatted_args.append("NULL")
        elif isinstance(a, bool):
            formatted_args.append("TRUE" if a else "FALSE")
        elif isinstance(a, (int, float)):
            formatted_args.append(str(a))
        elif isinstance(a, list):
            formatted_args.append(f"ARRAY[{', '.join(repr(x) for x in a)}]::text[]")
        else:
            safe_str = str(a).replace("'", "''")
            formatted_args.append(f"'{safe_str}'")
    
    arg_str = ", ".join(formatted_args)
    sql = f"SELECT public.{fn_name}({arg_str})::text;"
    rc, out, err = run_sql_as_context(role, uid, sql)
    if rc != 0:
        return {"_error": err, "_rc": rc}
    try:
        lines = [line.strip() for line in out.strip().splitlines() if line.strip()]
        for line in reversed(lines):
            if line.startswith("{") and line.endswith("}"):
                return json.loads(line)
        return json.loads(lines[-1])
    except Exception as e:
        return {"_raw": out, "_parse_error": str(e)}

def create_user(username, email, role="developer", company=None):
    uid = str(uuid.uuid4())
    comp_val = f"'{company}'" if company else "NULL"
    sql = f"""
    INSERT INTO auth.users (id, email) VALUES ('{uid}', '{email}');
    INSERT INTO public.users (id, username, email, role, company) VALUES ('{uid}', '{username}', '{email}', '{role}', {comp_val});
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create user: {err}"
    return uid

def create_wallet(user_id, balance=1000):
    sql = f"""
    INSERT INTO public.wallets (user_id, available_balance, total_earned)
    VALUES ('{user_id}', {balance}, {balance})
    ON CONFLICT (user_id) DO UPDATE SET available_balance = {balance}
    RETURNING id;
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create wallet: {err}"
    return out.strip()

def create_repo(owner, name, opted_in=True):
    rid = str(uuid.uuid4())
    opt_str = "true" if opted_in else "false"
    sql = f"""
    INSERT INTO public.repositories (id, github_repo_id, name, owner, url, opted_in)
    VALUES ('{rid}', '{owner}/{name}', '{name}', '{owner}', 'https://github.com/{owner}/{name}', {opt_str});
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create repo: {err}"
    return rid

def main():
    print("=" * 80)
    print("EMPIRICAL ADVERSARIAL CHALLENGE SUITE: MILESTONE 1 (R1, R2)")
    print("=" * 80)

    findings = []

    # -------------------------------------------------------------------------
    # PART 1: SQL AUTHORIZATION BOUNDARIES & PRIVILEGE HARDENING
    # -------------------------------------------------------------------------
    print("\n[SECTION 1] Empirically Verifying SQL Authorization Boundaries & Defenses")

    bob_id = create_user(f"bob_{uuid.uuid4().hex[:6]}", f"bob_{uuid.uuid4().hex[:6]}@gig.dev", "developer")
    alice_id = create_user(f"alice_{uuid.uuid4().hex[:6]}", f"alice_{uuid.uuid4().hex[:6]}@gig.dev", "developer")
    bob_wallet = create_wallet(bob_id, 2000)
    alice_wallet = create_wallet(alice_id, 500)

    # Test 1.1: Direct invocation by PostgreSQL role 'anon' on atomic_debit_wallet (7 params)
    print("\n[Test 1.1] Direct invocation by PostgreSQL role 'anon' on 7-param atomic_debit_wallet")
    tx_anon = f"anon_tx_{uuid.uuid4().hex}"
    rc, out, err = run_psql(f"SET ROLE anon; SELECT public.atomic_debit_wallet('{bob_id}'::uuid, 100::numeric, 'INR'::text, 'WITHDRAWAL'::text, 'COMPLETED'::text, NULL::uuid, '{tx_anon}'::text);")
    print(f"Result rc={rc}, error: {err[:120]}")
    assert rc != 0, "Security Failure: anon was able to execute atomic_debit_wallet!"
    assert "permission denied" in err.lower(), f"Expected permission denied, got: {err}"
    print("✓ PASS: PostgreSQL REVOKE successfully denied 'anon' role from executing atomic_debit_wallet.")

    # Test 1.2: Overload Ambiguity Bug: Invocation of atomic_debit_wallet with 2 or 6 parameters
    print("\n[Test 1.2] Overload Ambiguity: Invoking atomic_debit_wallet with standard arguments (e.g. 2 args)")
    rc, out, err = run_psql(f"SELECT public.atomic_debit_wallet('{bob_id}'::uuid, 100::numeric);")
    print(f"Result rc={rc}, error: {err[:120]}")
    if rc != 0 and "is not unique" in err.lower():
        print("⚠️ VULNERABILITY REPRODUCED: Calling atomic_debit_wallet without all 7 parameters fails with 'is not unique' due to unremoved 6-param overload from migration 0007!")
        findings.append({
            "id": "F-01-OVERLOAD-AMBIGUITY",
            "severity": "CRITICAL",
            "title": "Un-dropped 6-parameter atomic_debit_wallet overload breaks standard calls and leaves unhardened zombie procedure",
            "evidence": err
        })
    else:
        print(f"Overload ambiguity did not occur: rc={rc}, out={out}")

    # Test 1.3: Security Definer 'current_user = postgres' Internal Guard Bypass Bug
    print("\n[Test 1.3] Security Definer Internal Guard: Alice (authenticated) calling atomic_debit_wallet on Bob's wallet")
    tx_alice = f"alice_debit_{uuid.uuid4().hex}"
    res_cross_debit = rpc_as("authenticated", alice_id, "atomic_debit_wallet", bob_id, 200, "INR", "WITHDRAWAL", "COMPLETED", None, tx_alice)
    print(f"Result of Alice debiting Bob: {res_cross_debit}")
    if res_cross_debit.get("success") is True:
        print("🚨 VULNERABILITY CONFIRMED: Alice successfully debited Bob's wallet in PostgreSQL!")
        print("   Root Cause: 'IF v_role = 'service_role' OR current_user = 'postgres' THEN' in SECURITY DEFINER function.")
        print("   Inside a function owned by postgres, current_user is ALWAYS 'postgres', bypassing caller verification!")
        findings.append({
            "id": "F-02-CURRENT-USER-BYPASS",
            "severity": "CRITICAL",
            "title": "current_user = 'postgres' inside SECURITY DEFINER RPCs completely bypasses caller authorization",
            "evidence": json.dumps(res_cross_debit)
        })
    else:
        print(f"Cross-user debit was rejected: {res_cross_debit}")

    # Test 1.4: Direct invocation by PostgreSQL role 'anon' on atomic_request_withdrawal
    print("\n[Test 1.4] Direct invocation by PostgreSQL role 'anon' on atomic_request_withdrawal")
    rc, out, err = run_psql(f"SET ROLE anon; SELECT public.atomic_request_withdrawal('{bob_id}'::uuid, 500::numeric, 'INR'::text);")
    print(f"Result rc={rc}, error: {err[:120]}")
    assert rc != 0, "Security Failure: anon was able to execute atomic_request_withdrawal!"
    assert "permission denied" in err.lower(), f"Expected permission denied, got: {err}"
    print("✓ PASS: PostgreSQL REVOKE successfully denied 'anon' role from executing atomic_request_withdrawal.")

    # Test 1.5: Authenticated caller attempting administrative RPC (atomic_confirm_withdrawal)
    print("\n[Test 1.5] Authenticated user attempting administrative RPC: atomic_confirm_withdrawal")
    rc, out, err = run_psql(f"SET ROLE authenticated; SELECT public.atomic_confirm_withdrawal('{uuid.uuid4()}'::uuid, 'PAID');")
    print(f"Result rc={rc}, error: {err[:120]}")
    assert rc != 0, "Security Failure: authenticated role was able to execute atomic_confirm_withdrawal!"
    assert "permission denied" in err.lower(), f"Expected permission denied, got: {err}"
    print("✓ PASS: Administrative procedure atomic_confirm_withdrawal is REVOKED from authenticated users.")

    # Test 1.6: Multi-tenant repository ownership in atomic_create_task_with_escrow
    print("\n[Test 1.6] Multi-tenant isolation: Business user creating task in another company's repository")
    biz_acme = create_user(f"acme_admin_{uuid.uuid4().hex[:6]}", f"admin_{uuid.uuid4().hex[:6]}@acme.com", "business", "AcmeCorp")
    biz_hooli = create_user(f"hooli_admin_{uuid.uuid4().hex[:6]}", f"admin_{uuid.uuid4().hex[:6]}@hooli.com", "business", "HooliCorp")
    create_wallet(biz_acme, 5000)
    create_wallet(biz_hooli, 5000)
    hooli_repo = create_repo("HooliCorp", f"hooli-core-{uuid.uuid4().hex[:4]}")
    acme_repo = create_repo("AcmeCorp", f"acme-web-{uuid.uuid4().hex[:4]}")

    # Acme attempts to create task on Hooli's repository
    res_cross_task = rpc_as(
        "authenticated", biz_acme,
        "atomic_create_task_with_escrow",
        biz_acme, hooli_repo, "Malicious Cross Task", None, 500, "INR", "standard", None, "Desc"
    )
    print(f"Acme creating task on Hooli repo: {res_cross_task}")
    assert res_cross_task.get("success") is False
    assert "forbidden: repository does not belong to your company" in res_cross_task.get("error", "").lower()
    print("✓ PASS: Cross-tenant task creation on foreign repository strictly rejected with 403 / Forbidden.")

    # Acme attempts to create task on Acme's repository (should succeed)
    res_valid_task = rpc_as(
        "authenticated", biz_acme,
        "atomic_create_task_with_escrow",
        biz_acme, acme_repo, "Valid Acme Task", None, 500, "INR", "standard", None, "Desc"
    )
    print(f"Acme creating task on Acme repo: {res_valid_task}")
    assert res_valid_task.get("success") is True
    assert res_valid_task.get("new_balance") == 4500
    print("✓ PASS: Authorized task creation with escrow succeeded and decremented balance atomically.")

    # -------------------------------------------------------------------------
    # PART 2: CONCURRENCY & HIGH-STRESS HARNESSES
    # -------------------------------------------------------------------------
    print("\n[SECTION 2] Concurrency & High-Stress Harnesses")

    # Stress 2.1: 50 concurrent debits on 10,000 INR balance (300 INR each = 15,000 requested)
    print("\n[Test 2.1] Stress Harness: 50 Concurrent Debits on 10,000 INR balance (300 INR each = 15,000 requested)")
    st_user = create_user(f"stress_dev_{uuid.uuid4().hex[:6]}", f"stress_{uuid.uuid4().hex[:6]}@gig.dev", "developer")
    create_wallet(st_user, 10000)

    results_debit = []
    def thread_debit(idx):
        tx_ref = f"st_tx_{idx}_{uuid.uuid4().hex}"
        return rpc_as("service_role", st_user, "atomic_debit_wallet", st_user, 300, "INR", "WITHDRAWAL", "COMPLETED", None, tx_ref)

    with ThreadPoolExecutor(max_workers=50) as ex:
        futures = [ex.submit(thread_debit, i) for i in range(50)]
        for f in futures:
            results_debit.append(f.result())

    success_debit = [r for r in results_debit if r.get("success") is True]
    fail_debit = [r for r in results_debit if r.get("success") is False]
    print(f"Debit Stress: {len(success_debit)} succeeded, {len(fail_debit)} failed")

    rc, final_bal, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{st_user}';")
    rc, tx_count, _ = run_psql(f"SELECT COUNT(*) FROM public.wallet_transactions WHERE wallet_id = (SELECT id FROM public.wallets WHERE user_id = '{st_user}');")
    rc, tx_sum, _ = run_psql(f"SELECT SUM(amount) FROM public.wallet_transactions WHERE wallet_id = (SELECT id FROM public.wallets WHERE user_id = '{st_user}');")
    
    print(f"Final Balance: {final_bal} INR (Expected: 100 INR = 10000 - 33*300)")
    print(f"Total Transactions Logged: {tx_count} (Expected: 33)")
    print(f"Sum of Ledger Debits: {tx_sum} INR (Expected: -9900)")

    assert len(success_debit) == 33, f"Expected 33 successes, got {len(success_debit)}"
    assert len(fail_debit) == 17, f"Expected 17 failures, got {len(fail_debit)}"
    assert int(final_bal) == 100, f"Expected balance 100, got {final_bal}"
    assert int(tx_count) == 33, f"Expected 33 transactions, got {tx_count}"
    assert int(tx_sum) == -9900, f"Expected ledger sum -9900, got {tx_sum}"
    print("✓ PASS: High-concurrency debit stress test: 0 overdrafts, exact ledger reconciliation!")

    # Stress 2.2: Concurrent withdrawal requests with in-flight accumulation
    print("\n[Test 2.2] Stress Harness: 10 Concurrent Withdrawal Requests (Balance 1000 INR, 600 INR each)")
    w_user = create_user(f"w_dev_{uuid.uuid4().hex[:6]}", f"w_{uuid.uuid4().hex[:6]}@gig.dev", "developer")
    create_wallet(w_user, 1000)

    results_req = []
    def thread_request(idx):
        return rpc_as("service_role", w_user, "atomic_request_withdrawal", w_user, 600, "INR")

    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = [ex.submit(thread_request, i) for i in range(10)]
        for f in futures:
            results_req.append(f.result())

    success_req = [r for r in results_req if r.get("success") is True]
    fail_req = [r for r in results_req if r.get("success") is False]
    print(f"Withdrawal Request Stress: {len(success_req)} succeeded, {len(fail_req)} failed")

    rc, req_bal, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{w_user}';")
    assert len(success_req) == 1, f"Expected exactly 1 request to succeed, got {len(success_req)}"
    assert len(fail_req) == 9, f"Expected exactly 9 requests to fail, got {len(fail_req)}"
    assert int(req_bal) == 1000, f"Balance should not be decremented on request! Got {req_bal}"
    print("✓ PASS: In-flight aggregation and row locking prevented concurrent withdrawal over-reservation.")

    # Stress 2.3: Double-payout confirmation race
    print("\n[Test 2.3] Double Confirmation Race: 2 Concurrent PAID Confirmations on Same Transaction")
    tx_id = success_req[0]["transaction_id"]
    results_conf = []
    def thread_confirm(idx):
        return rpc_as("service_role", None, "atomic_confirm_withdrawal", tx_id, "PAID")

    with ThreadPoolExecutor(max_workers=2) as ex:
        futures = [ex.submit(thread_confirm, i) for i in range(2)]
        for f in futures:
            results_conf.append(f.result())

    success_conf = [r for r in results_conf if r.get("success") is True]
    fail_conf = [r for r in results_conf if r.get("success") is False]
    print(f"Confirmation Race: {len(success_conf)} succeeded, {len(fail_conf)} failed")

    rc, post_payout_bal, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{w_user}';")
    print(f"Balance after confirmation: {post_payout_bal} INR (Expected: 400 = 1000 - 600)")
    assert len(success_conf) == 1, f"Expected 1 confirmation to succeed, got {len(success_conf)}"
    assert len(fail_conf) == 1, f"Expected 1 confirmation to fail, got {len(fail_conf)}"
    assert int(post_payout_bal) == 400, f"Double deduction occurred! Balance is {post_payout_bal}"
    print("✓ PASS: FOR UPDATE lock in atomic_confirm_withdrawal completely prevents double payout deduction.")

    # Stress 2.4: Escrow Creation Overdraft Race
    print("\n[Test 2.4] Escrow Creation Race: 10 Concurrent Task Creations (Balance 1000 INR, 400 INR bounty each)")
    biz_race = create_user(f"biz_race_{uuid.uuid4().hex[:6]}", f"race_{uuid.uuid4().hex[:6]}@acme.com", "business", "AcmeCorp")
    create_wallet(biz_race, 1000)

    results_escrow = []
    def thread_escrow(idx):
        return rpc_as(
            "service_role", biz_race,
            "atomic_create_task_with_escrow",
            biz_race, acme_repo, f"Escrow Task {idx}", None, 400, "INR", "standard", None, "Desc"
        )

    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = [ex.submit(thread_escrow, i) for i in range(10)]
        for f in futures:
            results_escrow.append(f.result())

    success_escrow = [r for r in results_escrow if r.get("success") is True]
    fail_escrow = [r for r in results_escrow if r.get("success") is False]
    print(f"Escrow Creation Race: {len(success_escrow)} succeeded, {len(fail_escrow)} failed")

    rc, biz_final_bal, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{biz_race}';")
    print(f"Business final balance: {biz_final_bal} INR (Expected: 200 = 1000 - 2*400)")
    assert len(success_escrow) == 2, f"Expected 2 tasks to succeed, got {len(success_escrow)}"
    assert len(fail_escrow) == 8, f"Expected 8 tasks to fail, got {len(fail_escrow)}"
    assert int(biz_final_bal) == 200, f"Expected balance 200, got {biz_final_bal}"
    print("✓ PASS: Concurrent escrow creation locked exactly available funds with zero over-allocation.")

    # Stress 2.5: Escrow Refund Guards (Active Claims Block Refund)
    print("\n[Test 2.5] Escrow Refund Guards: Active claim prevents refund, expired/no claim allows refund")
    task_id_refund = success_escrow[0]["task_id"]
    claim_dev = create_user(f"claim_dev_{uuid.uuid4().hex[:6]}", f"claim_{uuid.uuid4().hex[:6]}@gig.dev", "developer")
    
    # Claim the task
    res_claim = rpc_as("service_role", claim_dev, "atomic_claim_task", task_id_refund, claim_dev, 48)
    assert res_claim.get("success") is True, f"Claim failed: {res_claim}"

    # Business attempts to refund escrow while active claim exists
    res_blocked_refund = rpc_as("service_role", biz_race, "atomic_refund_task_escrow", task_id_refund, biz_race)
    print(f"Refund attempt during active claim: {res_blocked_refund}")
    assert res_blocked_refund.get("success") is False
    assert "active claim exists" in res_blocked_refund.get("error", "").lower()
    print("✓ PASS: Escrow refund correctly blocked while active claim exists.")

    # Expire the claim manually
    run_psql(f"UPDATE public.claims SET expires_at = NOW() - interval '1 hour' WHERE task_id = '{task_id_refund}';")

    # Now refund should succeed
    res_success_refund = rpc_as("service_role", biz_race, "atomic_refund_task_escrow", task_id_refund, biz_race)
    print(f"Refund attempt after claim expired: {res_success_refund}")
    assert res_success_refund.get("success") is True
    assert res_success_refund.get("refunded_amount") == 400
    assert res_success_refund.get("new_balance") == 600

    rc, refunded_bal, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{biz_race}';")
    assert int(refunded_bal) == 600, f"Expected balance 600, got {refunded_bal}"
    print("✓ PASS: Escrow successfully refunded to business balance after claim expired.")

    print("\n" + "=" * 80)
    print(f"SUMMARY OF EMPIRICAL FINDINGS: {len(findings)} VULNERABILITIES DETECTED")
    for f in findings:
        print(f"- [{f['severity']}] {f['id']}: {f['title']}")
    print("=" * 80)

    return findings

if __name__ == "__main__":
    f = main()
    if len(f) > 0:
        sys.exit(2)
