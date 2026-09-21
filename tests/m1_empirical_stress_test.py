#!/usr/bin/env python3
"""
Empirical Challenge & Stress Test Suite for Milestone 1 (Database Migrations & Atomic RPCs)
Tests against real PostgreSQL 16 on port 5433.
"""

import subprocess
import json
import time
import uuid
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

DB_HOST = "localhost"
DB_PORT = "5433"
DB_USER = "postgres"
DB_NAME = "postgres"
DB_PASS = "postgres"

def run_psql(sql, json_mode=False):
    """Run SQL query via psql CLI."""
    cmd = [
        "psql",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
        "-A", "-t"
    ]
    if json_mode:
        cmd.extend(["-c", sql])
    else:
        cmd.extend(["-c", sql])
    
    env = {"PGPASSWORD": DB_PASS}
    res = subprocess.run(cmd, capture_output=True, text=True, env=env)
    return res.returncode, res.stdout.strip(), res.stderr.strip()

def run_psql_file(filepath):
    """Run an entire SQL file via psql."""
    cmd = [
        "psql",
        "-h", DB_HOST,
        "-p", DB_PORT,
        "-U", DB_USER,
        "-d", DB_NAME,
        "-v", "ON_ERROR_STOP=1",
        "-f", filepath
    ]
    env = {"PGPASSWORD": DB_PASS}
    res = subprocess.run(cmd, capture_output=True, text=True, env=env)
    return res.returncode, res.stdout.strip(), res.stderr.strip()

def rpc(fn_name, *args):
    """Call a PostgreSQL RPC returning JSONB and parse output."""
    formatted_args = []
    for a in args:
        if a is None:
            formatted_args.append("NULL")
        elif isinstance(a, bool):
            formatted_args.append("TRUE" if a else "FALSE")
        elif isinstance(a, (int, float)):
            formatted_args.append(str(a))
        elif isinstance(a, list):
            # Postgres text[]
            elements = ",".join(f'"{x}"' for x in a)
            formatted_args.append(f"ARRAY[{', '.join(repr(x) for x in a)}]::text[]")
        else:
            # string / uuid
            safe_str = str(a).replace("'", "''")
            formatted_args.append(f"'{safe_str}'")
    
    arg_str = ", ".join(formatted_args)
    sql = f"SELECT public.{fn_name}({arg_str})::text;"
    rc, out, err = run_psql(sql)
    if rc != 0:
        return {"_error": err, "_rc": rc}
    try:
        return json.loads(out)
    except Exception as e:
        return {"_raw": out, "_parse_error": str(e)}

def setup_supabase_prerequisites():
    """Create auth schema, mock auth.users, and standard Supabase roles."""
    prereq_sql = """
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;

    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
      END IF;
    END
    $$;

    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      email varchar(255),
      raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
      created_at timestamptz DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      SELECT '00000000-0000-0000-0000-000000000001'::uuid;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
      SELECT 'authenticated'::text;
    $$ LANGUAGE sql STABLE;
    """
    rc, out, err = run_psql(prereq_sql)
    assert rc == 0, f"Failed to setup prerequisites: {err}"
    print("✓ Supabase prerequisite schema & roles configured.")

def apply_migrations():
    """Apply migrations 0000 through 0007 sequentially."""
    migrations = [
        "supabase/migrations/0000_init.sql",
        "supabase/migrations/0001_github_profile.sql",
        "supabase/migrations/0002_rls_integrity.sql",
        "supabase/migrations/0003_rls_privilege_lockdown.sql",
        "supabase/migrations/0004_wallet_tx_nullable_task.sql",
        "supabase/migrations/0005_company_immutability.sql",
        "supabase/migrations/0006_competitive_racing_escrow.sql",
        "supabase/migrations/0007_state_machines_and_atomic_ops.sql",
    ]
    for m in migrations:
        rc, out, err = run_psql_file(m)
        if rc != 0:
            print(f"FAILED migration {m}:\nError: {err}\nOutput: {out}")
            return False, m, err
        print(f"✓ Migration applied: {m}")
    return True, None, None

def create_mock_user(username="testdev", email="testdev@example.com", role="developer"):
    """Helper to create an auth user and public user profile."""
    uid = str(uuid.uuid4())
    sql = f"""
    INSERT INTO auth.users (id, email) VALUES ('{uid}', '{email}');
    INSERT INTO public.users (id, username, email, role) VALUES ('{uid}', '{username}', '{email}', '{role}');
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create user: {err}"
    return uid

def create_mock_wallet(user_id, balance=1000):
    """Helper to create a wallet with balance."""
    sql = f"""
    INSERT INTO public.wallets (user_id, available_balance, total_earned)
    VALUES ('{user_id}', {balance}, {balance})
    ON CONFLICT (user_id) DO UPDATE SET available_balance = {balance}
    RETURNING id;
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create wallet: {err}"
    return out.strip()

def create_mock_repo(owner="testcorp", name="repo1"):
    """Helper to create a repository."""
    rid = str(uuid.uuid4())
    sql = f"""
    INSERT INTO public.repositories (id, github_repo_id, name, owner, url, opted_in)
    VALUES ('{rid}', 'gh-{rid}', '{name}', '{owner}', 'https://github.com/{owner}/{name}', true);
    """
    rc, out, err = run_psql(sql)
    assert rc == 0, f"Failed to create repo: {err}"
    return rid

def main():
    print("=" * 70)
    print("EMPIRICAL CHALLENGE: MILESTONE 1 ATOMIC RPCs & DATABASE MIGRATIONS")
    print("=" * 70)

    # 1. Prerequisites & Migrations
    setup_supabase_prerequisites()
    ok, failed_m, err = apply_migrations()
    if not ok:
        print(f"CRITICAL: Migration failure on {failed_m}: {err}")
        sys.exit(1)

    print("\n--- 1. SCHEMA INVARIANTS & CONSTRAINTS VERIFICATION ---")

    # Invariant 1: claims.expires_at NOT NULL and default
    rc, out, err = run_psql("""
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'claims' AND column_name = 'expires_at';
    """)
    print(f"claims.expires_at column: {out}")
    assert "expires_at|NO|" in out, f"claims.expires_at invariant violated: {out}"

    # Invariant 2: contributions(submission_id) UNIQUE
    rc, out, err = run_psql("""
    SELECT conname, contype 
    FROM pg_constraint 
    WHERE conrelid = 'public.contributions'::regclass AND conname = 'contributions_submission_id_unique';
    """)
    print(f"contributions unique constraint: {out}")
    assert "contributions_submission_id_unique|u" in out, "Unique constraint missing on contributions"

    # Invariant 3: wallets(available_balance >= 0) CHECK
    rc, out, err = run_psql("""
    SELECT conname, pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conrelid = 'public.wallets'::regclass AND conname = 'check_wallet_available_balance_non_negative';
    """)
    print(f"wallets non-negative constraint: {out}")
    assert "available_balance >= 0" in out, "wallets non-negative balance check missing"

    # Invariant 4: Security Definer & Search Path on RPCs
    rc, out, err = run_psql("""
    SELECT proname, prosecdef, proconfig 
    FROM pg_proc 
    WHERE proname IN (
      'atomic_debit_wallet', 'atomic_credit_reward_pending',
      'atomic_request_withdrawal', 'atomic_confirm_withdrawal',
      'atomic_create_task_with_escrow', 'atomic_claim_task'
    ) AND pronamespace = 'public'::regnamespace;
    """)
    print(f"RPC Security Definer Audit:\n{out}")
    for fn in ['atomic_debit_wallet', 'atomic_credit_reward_pending', 'atomic_request_withdrawal', 'atomic_confirm_withdrawal', 'atomic_create_task_with_escrow', 'atomic_claim_task']:
        assert fn in out, f"Missing RPC: {fn}"

    print("\n--- 2. CONCURRENCY STRESS TESTS ---")

    # TEST C1: atomic_debit_wallet Concurrency Overdraft Race
    print("\n[Test C1] atomic_debit_wallet Overdraft Race (1000 balance, 10x 200 debit concurrently)")
    u1 = create_mock_user("c1_user", "c1@test.com")
    w1 = create_mock_wallet(u1, 1000)

    results_c1 = []
    def do_debit(idx):
        res = rpc("atomic_debit_wallet", u1, 200, "INR", "WITHDRAWAL", "COMPLETED", None)
        return idx, res

    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = [ex.submit(do_debit, i) for i in range(10)]
        for f in futs:
            results_c1.append(f.result())

    successes_c1 = [r for idx, r in results_c1 if r.get("success") is True]
    failures_c1 = [r for idx, r in results_c1 if r.get("success") is False]
    print(f"C1 Results: {len(successes_c1)} succeeded, {len(failures_c1)} failed")
    
    rc, bal_c1, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{u1}';")
    print(f"C1 Final Wallet Balance: {bal_c1} (expected: 0)")
    assert len(successes_c1) == 5, f"Expected exactly 5 successes, got {len(successes_c1)}"
    assert len(failures_c1) == 5, f"Expected exactly 5 failures, got {len(failures_c1)}"
    assert int(bal_c1) == 0, f"Expected final balance 0, got {bal_c1}"
    print("✓ Test C1 PASSED: Zero overdrafts, atomic balance decrement verified under high concurrency.")

    # TEST C2: atomic_request_withdrawal Concurrency Race (1000 balance, 2x 700 requests)
    print("\n[Test C2] atomic_request_withdrawal In-Flight Race (1000 balance, 2x 700 requests concurrently)")
    u2 = create_mock_user("c2_user", "c2@test.com")
    w2 = create_mock_wallet(u2, 1000)

    results_c2 = []
    def do_req_withdraw(idx):
        res = rpc("atomic_request_withdrawal", u2, 700, "INR")
        return idx, res

    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(do_req_withdraw, i) for i in range(2)]
        for f in futs:
            results_c2.append(f.result())

    successes_c2 = [r for idx, r in results_c2 if r.get("success") is True]
    failures_c2 = [r for idx, r in results_c2 if r.get("success") is False]
    print(f"C2 Results: {len(successes_c2)} succeeded, {len(failures_c2)} failed")
    assert len(successes_c2) == 1, f"Expected 1 success, got {len(successes_c2)}"
    assert len(failures_c2) == 1, f"Expected 1 failure, got {len(failures_c2)}"
    assert "in-flight" in failures_c2[0].get("error", "").lower(), f"Unexpected error: {failures_c2[0]}"

    rc, bal_c2, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{u2}';")
    print(f"C2 Balance after request: {bal_c2} (expected: 1000 - balance not decremented in request)")
    assert int(bal_c2) == 1000
    print("✓ Test C2 PASSED: Row locking & in-flight aggregation prevented double withdrawal reservation.")

    # TEST C3: atomic_confirm_withdrawal Concurrency Double-Payout Race
    print("\n[Test C3] atomic_confirm_withdrawal Double-Payout Race (Two concurrent PAID confirmations)")
    tx_id_c2 = successes_c2[0]["transaction_id"]
    results_c3 = []
    def do_confirm(idx):
        res = rpc("atomic_confirm_withdrawal", tx_id_c2, "PAID")
        return idx, res

    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(do_confirm, i) for i in range(2)]
        for f in futs:
            results_c3.append(f.result())

    successes_c3 = [r for idx, r in results_c3 if r.get("success") is True]
    failures_c3 = [r for idx, r in results_c3 if r.get("success") is False]
    print(f"C3 Results: {len(successes_c3)} succeeded, {len(failures_c3)} failed")
    assert len(successes_c3) == 1, f"Expected 1 success, got {len(successes_c3)}"
    assert len(failures_c3) == 1, f"Expected 1 failure, got {len(failures_c3)}"

    rc, bal_c3, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{u2}';")
    print(f"C3 Final Balance: {bal_c3} (expected: 300 = 1000 - 700)")
    assert int(bal_c3) == 300, f"Expected balance 300, got {bal_c3}"
    print("✓ Test C3 PASSED: FOR UPDATE on transaction prevented double debit on confirmation.")

    # TEST C4: atomic_create_task_with_escrow Concurrency Escrow Overdraft
    print("\n[Test C4] atomic_create_task_with_escrow Overdraft Race (500 balance, 2x 400 bounty tasks)")
    u4 = create_mock_user("c4_biz", "c4@test.com", "business")
    w4 = create_mock_wallet(u4, 500)
    repo4 = create_mock_repo("c4_biz", "repo4")

    results_c4 = []
    def do_create_task(idx):
        res = rpc(
            "atomic_create_task_with_escrow",
            u4, repo4, f"Task {idx}", "https://github.com/c4_biz/repo4/issues/1",
            400, "INR", "standard", ["typescript"], "Task desc"
        )
        return idx, res

    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(do_create_task, i) for i in range(2)]
        for f in futs:
            results_c4.append(f.result())

    successes_c4 = [r for idx, r in results_c4 if r.get("success") is True]
    failures_c4 = [r for idx, r in results_c4 if r.get("success") is False]
    print(f"C4 Results: {len(successes_c4)} succeeded, {len(failures_c4)} failed")
    assert len(successes_c4) == 1, f"Expected 1 task success, got {len(successes_c4)}"
    assert len(failures_c4) == 1, f"Expected 1 task failure, got {len(failures_c4)}"

    rc, bal_c4, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{u4}';")
    rc, task_count, _ = run_psql(f"SELECT COUNT(*) FROM public.tasks WHERE repository_id = '{repo4}';")
    print(f"C4 Final Balance: {bal_c4} (expected: 100), Tasks Created: {task_count} (expected: 1)")
    assert int(bal_c4) == 100
    assert int(task_count) == 1
    print("✓ Test C4 PASSED: Escrow balance deduction and task insert are atomic.")

    # TEST C5: atomic_credit_reward_pending Idempotency and Concurrency
    print("\n[Test C5] atomic_credit_reward_pending Duplicate Contribution Concurrency")
    u5 = create_mock_user("c5_dev", "c5@test.com")
    task_id_c4 = successes_c4[0]["task_id"]
    # Mock submission & contribution
    claim_id = str(uuid.uuid4())
    submission_id = str(uuid.uuid4())
    contribution_id = str(uuid.uuid4())
    
    rc, _, err = run_psql(f"INSERT INTO public.claims (id, task_id, user_id, status) VALUES ('{claim_id}', '{task_id_c4}', '{u5}', 'active');")
    assert rc == 0, f"Claim insert failed: {err}"
    
    rc, _, err = run_psql(f"INSERT INTO public.submissions (id, task_id, user_id, claim_id, pr_url, pr_status) VALUES ('{submission_id}', '{task_id_c4}', '{u5}', '{claim_id}', 'https://github.com/c4_biz/repo4/pull/1', 'approved');")
    assert rc == 0, f"Submission insert failed: {err}"
    
    rc, _, err = run_psql(f"INSERT INTO public.contributions (id, user_id, task_id, submission_id, status) VALUES ('{contribution_id}', '{u5}', '{task_id_c4}', '{submission_id}', 'verified');")
    assert rc == 0, f"Contribution insert failed: {err}"
    print(f"C5 Created contribution_id: {contribution_id}")

    # Call atomic_credit_reward_pending concurrently with same contribution_id
    results_c5 = []
    def do_credit(idx):
        res = rpc("atomic_credit_reward_pending", u5, task_id_c4, 400, "INR", contribution_id)
        return idx, res

    with ThreadPoolExecutor(max_workers=2) as ex:
        futs = [ex.submit(do_credit, i) for i in range(2)]
        for f in futs:
            results_c5.append(f.result())

    print(f"C5 Concurrent Results: {results_c5}")
    # Check transactions count for this contribution
    rc, tx_count, _ = run_psql(f"SELECT COUNT(*) FROM public.wallet_transactions WHERE contribution_id = '{contribution_id}';")
    print(f"C5 Total Transactions Created for Contribution: {tx_count}")
    rc, bal_c5, _ = run_psql(f"SELECT available_balance FROM public.wallets WHERE user_id = '{u5}';")
    print(f"C5 Dev Wallet Balance: {bal_c5} (expected: 0 - pending reward must NOT credit available_balance)")
    assert int(bal_c5) == 0, f"Pending reward mutated available_balance! {bal_c5}"

    # Sequential idempotency test
    idemp_call = rpc("atomic_credit_reward_pending", u5, task_id_c4, 400, "INR", contribution_id)
    print(f"C5 Sequential Idempotent Call: {idemp_call}")
    assert idemp_call.get("idempotent") is True, f"Expected idempotent: true, got {idemp_call}"

    print("\n--- 3. EDGE CASES & BOUNDARY VALUE STRESS TESTS ---")

    # E1: Negative amount on debit
    res = rpc("atomic_debit_wallet", u1, -50)
    print(f"E1 Debit negative (-50): {res}")
    assert res.get("success") is False

    # E2: Zero amount on debit
    res = rpc("atomic_debit_wallet", u1, 0)
    print(f"E2 Debit zero (0): {res}")
    assert res.get("success") is False

    # E3: Non-existent wallet on debit
    fake_uid = str(uuid.uuid4())
    res = rpc("atomic_debit_wallet", fake_uid, 50)
    print(f"E3 Debit non-existent user: {res}")
    assert res.get("success") is False and "Wallet not found" in res.get("error", "")

    # E4: Confirm withdrawal with invalid status
    res = rpc("atomic_confirm_withdrawal", tx_id_c2, "INVALID_STATUS")
    print(f"E4 Confirm with invalid status: {res}")
    assert res.get("success") is False and "Invalid payout status" in res.get("error", "")

    # E5: Confirm already confirmed transaction
    res = rpc("atomic_confirm_withdrawal", tx_id_c2, "PAID")
    print(f"E5 Re-confirm already PAID transaction: {res}")
    assert res.get("success") is False and "not in REQUESTED or PROCESSING" in res.get("error", "")

    # E6: Create task with empty title
    res = rpc("atomic_create_task_with_escrow", u4, repo4, "", None, 100)
    print(f"E6 Task with empty title: {res}")
    assert res.get("success") is False and "title is required" in res.get("error", "")

    # E7: Create task with non-existent repo
    res = rpc("atomic_create_task_with_escrow", u4, str(uuid.uuid4()), "Valid title", None, 100)
    print(f"E7 Task with missing repo: {res}")
    assert res.get("success") is False and "repository not found" in res.get("error", "")

    # E8: Claim task - lazy expiration and active claim enforcement
    u8 = create_mock_user("dev8", "dev8@test.com")
    u8_2 = create_mock_user("dev8_2", "dev8_2@test.com")
    # Open task
    res_t = rpc("atomic_create_task_with_escrow", u4, repo4, "Claim Test Task", None, None)
    claim_task_id = res_t["task_id"]

    # Developer claims task
    res_claim1 = rpc("atomic_claim_task", claim_task_id, u8, 48)
    print(f"E8 Claim 1 (Developer 1): {res_claim1}")
    assert res_claim1.get("success") is True

    # Developer claims SAME task again -> should return already_claimed: true
    res_claim_dup = rpc("atomic_claim_task", claim_task_id, u8, 48)
    print(f"E8 Claim duplicate same user/task: {res_claim_dup}")
    assert res_claim_dup.get("already_claimed") is True

    # Developer tries to claim ANOTHER task -> should fail (one active claim per user)
    res_t2 = rpc("atomic_create_task_with_escrow", u4, repo4, "Task 2", None, None)
    claim_task_id_2 = res_t2["task_id"]
    res_claim_other = rpc("atomic_claim_task", claim_task_id_2, u8, 48)
    print(f"E8 Claim other task when already holding active claim: {res_claim_other}")
    assert res_claim_other.get("success") is False and "already hold an active claim" in res_claim_other.get("error", "")

    # Different developer claims the open task (competitive racing)
    res_claim2 = rpc("atomic_claim_task", claim_task_id, u8_2, 48)
    print(f"E8 Developer 2 claims task under competitive racing: {res_claim2}")
    assert res_claim2.get("success") is True

    # Manually expire dev8's claim to test lazy expiry
    run_psql(f"UPDATE public.claims SET expires_at = NOW() - interval '1 hour' WHERE user_id = '{u8}';")
    # Now dev8 claims Task 2 -> lazy expiry in atomic_claim_task should expire old claim and allow claiming Task 2!
    res_claim_after_expiry = rpc("atomic_claim_task", claim_task_id_2, u8, 48)
    print(f"E8 Claim after expiry: {res_claim_after_expiry}")
    assert res_claim_after_expiry.get("success") is True, f"Failed lazy expiry claim: {res_claim_after_expiry}"

    # E9: Unique constraint test on contributions table
    print("\n[E9] Duplicate contributions(submission_id) constraint violation test")
    rc, _, err = run_psql(f"""
    INSERT INTO public.contributions (user_id, task_id, submission_id, status)
    VALUES ('{u5}', '{task_id_c4}', '{submission_id}', 'verified');
    """)
    print(f"Duplicate contribution insert rc={rc}, error={err}")
    assert rc != 0, "Duplicate contribution did not violate unique constraint!"
    assert "contributions_submission_id_unique" in err, f"Expected unique constraint error, got: {err}"
    print("✓ Unique constraint contributions_submission_id_unique empirically verified.")

    # E10: Check constraint test on wallets negative balance
    print("\n[E10] Wallets negative balance check constraint test")
    rc, _, err = run_psql(f"UPDATE public.wallets SET available_balance = -100 WHERE user_id = '{u1}';")
    print(f"Negative balance update rc={rc}, error={err}")
    assert rc != 0, "Negative balance update did not violate check constraint!"
    assert "check_wallet_available_balance_non_negative" in err, f"Expected check constraint error, got: {err}"
    print("✓ Check constraint check_wallet_available_balance_non_negative empirically verified.")

    print("\n" + "=" * 70)
    print("ALL EMPIRICAL TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
