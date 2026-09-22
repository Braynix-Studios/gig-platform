-- =============================================================================
-- Migration: 0010_security_boundaries_and_canonical_state.sql
-- Description:
--   Milestone 1 Hardening:
--   1. Enforce strict caller ownership inside all elevated SECURITY DEFINER RPCs:
--      (atomic_debit_wallet, atomic_request_withdrawal, atomic_claim_task,
--       atomic_create_task_with_escrow, atomic_credit_topup, atomic_refund_task_escrow):
--      Require auth.role() = 'service_role' OR (auth.role() = 'authenticated' AND auth.uid() = p_user_id).
--      Explicitly reject unauthenticated/anon callers where auth.uid() IS NULL.
--      Revoke EXECUTE from PUBLIC and anon; grant strictly to authenticated, service_role.
--   2. Enforce strict administrative boundaries on administrative RPCs:
--      (atomic_confirm_withdrawal, atomic_credit_reward_pending, atomic_release_reward):
--      Revoke EXECUTE from PUBLIC, authenticated, anon; grant strictly to service_role.
--      Add internal procedure check asserting auth.role() = 'service_role'.
--   3. Enforce multi-tenant repository ownership in atomic_create_task_with_escrow:
--      Caller company (users.company) must strictly match repository owner (repositories.owner).
--   4. Add canonical atomic procedures:
--      - atomic_credit_topup: atomically update wallet balance and log TOPUP transaction.
--      - atomic_release_reward: advance reward PENDING/VERIFIED -> AVAILABLE and credit balance.
--      - atomic_refund_task_escrow: cancel open task and refund locked escrow bounty.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Hardened RPC: atomic_debit_wallet
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR',
  p_type text DEFAULT 'WITHDRAWAL',
  p_status text DEFAULT 'COMPLETED',
  p_task_id uuid DEFAULT NULL,
  p_withdrawal_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance integer;
  v_tx_id uuid;
  v_int_amount integer;
  v_caller uuid;
  v_role text;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: caller must be service_role OR authenticated owner
  -- Explicitly reject unauthenticated/anon callers where auth.uid() IS NULL
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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Debit amount must be positive'
    );
  END IF;

  v_int_amount := ROUND(p_amount)::integer;

  IF v_int_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Debit amount must be at least 1'
    );
  END IF;

  -- Atomic conditional decrement with row lock
  UPDATE public.wallets
  SET available_balance = available_balance - v_int_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id AND available_balance >= v_int_amount
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = p_user_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'ok', false,
        'error', 'Wallet not found'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'ok', false,
        'error', 'Insufficient balance'
      );
    END IF;
  END IF;

  -- Record ledger transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    task_id,
    contribution_id,
    withdrawal_id,
    amount,
    currency,
    type,
    status,
    created_at
  ) VALUES (
    v_wallet_id,
    p_task_id,
    NULL,
    p_withdrawal_id,
    -ABS(v_int_amount),
    COALESCE(p_currency, 'INR'),
    COALESCE(p_type, 'WITHDRAWAL'),
    COALESCE(p_status, 'COMPLETED'),
    NOW()
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'newBalance', v_new_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. Hardened RPC: atomic_request_withdrawal
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_request_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_current_balance integer;
  v_in_flight integer;
  v_tx_id uuid;
  v_int_amount integer;
  v_caller uuid;
  v_role text;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: caller must be service_role OR authenticated owner
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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Withdrawal amount must be positive'
    );
  END IF;

  v_int_amount := ROUND(p_amount)::integer;

  IF v_int_amount < 500 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Minimum withdrawal amount is 500'
    );
  END IF;

  -- Lock wallet row for update
  SELECT id, available_balance
  INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Wallet not found'
    );
  END IF;

  -- Calculate in-flight withdrawals
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_in_flight
  FROM public.wallet_transactions
  WHERE wallet_id = v_wallet_id
    AND type = 'WITHDRAWAL'
    AND status IN ('REQUESTED', 'PROCESSING');

  IF (v_current_balance - v_in_flight) < v_int_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Insufficient balance after considering in-flight withdrawals'
    );
  END IF;

  -- Create withdrawal record in REQUESTED status without decrementing balance yet
  INSERT INTO public.wallet_transactions (
    wallet_id,
    task_id,
    contribution_id,
    amount,
    currency,
    type,
    status,
    created_at
  ) VALUES (
    v_wallet_id,
    NULL,
    NULL,
    -ABS(v_int_amount),
    COALESCE(p_currency, 'INR'),
    'WITHDRAWAL',
    'REQUESTED',
    NOW()
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'transaction_id', v_tx_id,
    'status', 'REQUESTED',
    'new_balance', v_current_balance,
    'newBalance', v_current_balance,
    'available_balance', v_current_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. Hardened RPC: atomic_claim_task
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_claim_task(
  p_task_id uuid,
  p_user_id uuid,
  p_lock_duration_hours integer DEFAULT 48
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_existing_claim record;
  v_claim_id uuid;
  v_expires_at timestamptz;
  v_duration integer;
  v_caller uuid;
  v_role text;
  v_user_role text;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: caller must be service_role OR authenticated owner
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

  -- Verify developer role if user profile exists
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;

  IF FOUND AND v_user_role <> 'developer' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: only developers can claim tasks'
    );
  END IF;

  v_duration := COALESCE(p_lock_duration_hours, 48);

  -- 1. Lazily expire any stale claims for this user whose expiry has passed
  UPDATE public.claims
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'active'
    AND expires_at <= NOW();

  -- 2. Lazily expire stale claims on the task whose expiry has passed
  UPDATE public.claims
  SET status = 'expired'
  WHERE task_id = p_task_id
    AND status = 'active'
    AND expires_at <= NOW();

  -- 3. Check if user already holds an active, non-expired claim on this specific task
  SELECT id, expires_at INTO v_existing_claim
  FROM public.claims
  WHERE task_id = p_task_id
    AND user_id = p_user_id
    AND status = 'active'
    AND expires_at > NOW();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'claim_id', v_existing_claim.id,
      'expires_at', v_existing_claim.expires_at,
      'already_claimed', true,
      'error', null
    );
  END IF;

  -- 4. Check if user holds an active claim on any OTHER task (one active claim per user)
  IF EXISTS (
    SELECT 1 FROM public.claims
    WHERE user_id = p_user_id
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'You already hold an active claim on another issue.'
    );
  END IF;

  -- 5. Verify task is open
  SELECT id, status INTO v_task
  FROM public.tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Task not found'
    );
  END IF;

  IF v_task.status <> 'open' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'This issue is no longer open.'
    );
  END IF;

  -- 6. Insert new claim with exact expires_at
  v_expires_at := NOW() + (v_duration || ' hours')::interval;

  BEGIN
    INSERT INTO public.claims (
      task_id,
      user_id,
      status,
      claimed_at,
      expires_at
    ) VALUES (
      p_task_id,
      p_user_id,
      'active',
      NOW(),
      v_expires_at
    ) RETURNING id INTO v_claim_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'already_claimed', true,
      'error', 'Task has already been claimed or user already has an active claim'
    );
  END;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'claim_id', v_claim_id,
    'expires_at', v_expires_at,
    'already_claimed', false,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. Hardened RPC: atomic_create_task_with_escrow (Multi-tenant Repo Ownership)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_create_task_with_escrow(
  p_business_id uuid,
  p_repository_id uuid,
  p_title text,
  p_issue_url text DEFAULT NULL,
  p_reward_amount numeric DEFAULT NULL,
  p_reward_currency text DEFAULT 'INR',
  p_experience_level text DEFAULT 'standard',
  p_tags text[] DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance integer;
  v_task record;
  v_tx_id uuid;
  v_has_bounty boolean;
  v_int_reward integer;
  v_technology text;
  v_caller uuid;
  v_role text;
  v_user_role text;
  v_user_company text;
  v_repo_owner text;
  v_repo_opted_in boolean;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: Caller must be service_role OR authenticated business owner
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

  -- 1. Validate title
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Issue title is required'
    );
  END IF;

  -- 2. Validate business user exists, role is business, and retrieve company
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

  IF v_user_role <> 'business' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: only business accounts can create tasks'
    );
  END IF;

  -- 3. Validate repository exists and is opted in
  SELECT owner, opted_in INTO v_repo_owner, v_repo_opted_in
  FROM public.repositories
  WHERE id = p_repository_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Target repository not found'
    );
  END IF;

  IF v_repo_opted_in IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Target repository not found or not opted in'
    );
  END IF;

  -- 4. Enforce Multi-tenant isolation: caller company strictly matches repository owner
  IF v_user_company IS NULL OR TRIM(v_user_company) = '' OR LOWER(TRIM(v_user_company)) <> LOWER(TRIM(v_repo_owner)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: repository does not belong to your company'
    );
  END IF;

  -- 5. Determine bounty requirements and validate
  IF p_reward_amount IS NOT NULL AND p_reward_amount < 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Task reward amount cannot be negative'
    );
  END IF;

  v_has_bounty := (p_reward_amount IS NOT NULL AND p_reward_amount > 0);
  IF v_has_bounty THEN
    v_int_reward := ROUND(p_reward_amount)::integer;
    IF v_int_reward <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'ok', false,
        'error', 'Reward amount must be at least 1'
      );
    END IF;
  ELSE
    v_int_reward := NULL;
  END IF;

  -- 6. Convert tags array to technology string if provided (truncated to 100 chars)
  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    v_technology := SUBSTRING(ARRAY_TO_STRING(p_tags, ', ') FROM 1 FOR 100);
  ELSE
    v_technology := NULL;
  END IF;

  -- 7. Reserve escrow funds from business wallet if bounty specified
  IF v_has_bounty THEN
    UPDATE public.wallets
    SET available_balance = available_balance - v_int_reward,
        updated_at = NOW()
    WHERE user_id = p_business_id AND available_balance >= v_int_reward
    RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

    IF NOT FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id = p_business_id) THEN
        RETURN jsonb_build_object(
          'success', false,
          'ok', false,
          'error', 'Wallet not found for business user'
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'ok', false,
          'error', 'Insufficient balance for task bounty escrow'
        );
      END IF;
    END IF;
  ELSE
    SELECT available_balance INTO v_new_balance
    FROM public.wallets
    WHERE user_id = p_business_id;
  END IF;

  -- 8. Insert task
  INSERT INTO public.tasks (
    repository_id,
    title,
    description,
    issue_url,
    difficulty,
    technology,
    status,
    reward_amount,
    reward_currency,
    escrow_locked,
    created_at
  ) VALUES (
    p_repository_id,
    TRIM(p_title),
    p_description,
    p_issue_url,
    COALESCE(p_experience_level, 'standard'),
    v_technology,
    'open',
    v_int_reward,
    COALESCE(p_reward_currency, 'INR'),
    v_has_bounty,
    NOW()
  ) RETURNING * INTO v_task;

  -- 9. Insert escrow ledger transaction
  IF v_has_bounty THEN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      task_id,
      amount,
      currency,
      type,
      status,
      created_at
    ) VALUES (
      v_wallet_id,
      v_task.id,
      -ABS(v_int_reward),
      COALESCE(p_reward_currency, 'INR'),
      'ESCROW_LOCK',
      'COMPLETED',
      NOW()
    ) RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'task', row_to_json(v_task),
    'task_id', v_task.id,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'newBalance', v_new_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. Hardened Administrative RPC: atomic_confirm_withdrawal (service_role only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_confirm_withdrawal(
  p_transaction_id uuid,
  p_payout_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_new_balance integer;
  v_clean_status text;
BEGIN
  -- Administrative Boundary: ONLY executable by service_role
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: administrative operation requires service_role'
    );
  END IF;

  v_clean_status := UPPER(TRIM(COALESCE(p_payout_status, '')));

  IF v_clean_status NOT IN ('PAID', 'FAILED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Invalid payout status. Must be PAID or FAILED'
    );
  END IF;

  -- Lock transaction row
  SELECT id, wallet_id, amount, status
  INTO v_tx
  FROM public.wallet_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Withdrawal transaction not found'
    );
  END IF;

  IF v_tx.status NOT IN ('REQUESTED', 'PROCESSING') THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Transaction is not in REQUESTED or PROCESSING status'
    );
  END IF;

  IF v_clean_status = 'PAID' THEN
    -- Atomically decrement wallet balance
    UPDATE public.wallets
    SET available_balance = available_balance - ABS(v_tx.amount),
        updated_at = NOW()
    WHERE id = v_tx.wallet_id AND available_balance >= ABS(v_tx.amount)
    RETURNING available_balance INTO v_new_balance;

    IF NOT FOUND THEN
      -- If wallet balance became insufficient, mark transaction as FAILED
      UPDATE public.wallet_transactions
      SET status = 'FAILED'
      WHERE id = v_tx.id;

      RETURN jsonb_build_object(
        'success', false,
        'ok', false,
        'error', 'Wallet has insufficient balance to complete payout'
      );
    END IF;

    UPDATE public.wallet_transactions
    SET status = 'PAID'
    WHERE id = v_tx.id;

    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'transaction_id', v_tx.id,
      'status', 'PAID',
      'new_balance', v_new_balance,
      'newBalance', v_new_balance,
      'error', null
    );
  ELSE
    -- Payout failed: mark transaction as FAILED, balance remains untouched
    UPDATE public.wallet_transactions
    SET status = 'FAILED'
    WHERE id = v_tx.id;

    SELECT available_balance INTO v_new_balance
    FROM public.wallets
    WHERE id = v_tx.wallet_id;

    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'transaction_id', v_tx.id,
      'status', 'FAILED',
      'new_balance', v_new_balance,
      'newBalance', v_new_balance,
      'error', null
    );
  END IF;
END;
$$;


-- -----------------------------------------------------------------------------
-- 6. Hardened Administrative RPC: atomic_credit_reward_pending (service_role only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_credit_reward_pending(
  p_user_id uuid,
  p_task_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR',
  p_contribution_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_tx_id uuid;
  v_existing_tx_id uuid;
  v_int_amount integer;
BEGIN
  -- Administrative Boundary: ONLY executable by service_role
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: administrative operation requires service_role'
    );
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Reward amount must be positive'
    );
  END IF;

  v_int_amount := ROUND(p_amount)::integer;

  IF v_int_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Reward amount must be at least 1'
    );
  END IF;

  -- Ensure wallet exists for recipient (atomic upsert)
  INSERT INTO public.wallets (user_id, available_balance, total_earned, created_at, updated_at)
  VALUES (p_user_id, 0, 0, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_wallet_id;

  -- Idempotency check on wallet_transactions (by contribution_id)
  IF p_contribution_id IS NOT NULL THEN
    SELECT id INTO v_existing_tx_id
    FROM public.wallet_transactions
    WHERE contribution_id = p_contribution_id
      AND type = 'TASK_REWARD'
    LIMIT 1;

    IF v_existing_tx_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'ok', true,
        'wallet_id', v_wallet_id,
        'transaction_id', v_existing_tx_id,
        'status', 'PENDING',
        'idempotent', true,
        'error', null
      );
    END IF;
  END IF;

  -- Create ledger transaction in PENDING status (available_balance is NOT modified!)
  BEGIN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      task_id,
      contribution_id,
      amount,
      currency,
      type,
      status,
      created_at
    ) VALUES (
      v_wallet_id,
      p_task_id,
      p_contribution_id,
      ABS(v_int_amount),
      COALESCE(p_currency, 'INR'),
      'TASK_REWARD',
      'PENDING',
      NOW()
    ) RETURNING id INTO v_tx_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_existing_tx_id
    FROM public.wallet_transactions
    WHERE contribution_id = p_contribution_id
      AND type = 'TASK_REWARD'
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'wallet_id', v_wallet_id,
      'transaction_id', v_existing_tx_id,
      'status', 'PENDING',
      'idempotent', true,
      'error', null
    );
  END;

  -- Canonical escrow lifecycle: when reward is credited, unlock task escrow
  IF p_task_id IS NOT NULL THEN
    UPDATE public.tasks
    SET escrow_locked = false
    WHERE id = p_task_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'status', 'PENDING',
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 7. New Canonical RPC: atomic_credit_topup
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_credit_topup(
  p_user_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id uuid;
  v_new_balance integer;
  v_tx_id uuid;
  v_int_amount integer;
  v_caller uuid;
  v_role text;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: Caller must be service_role OR authenticated owner
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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Topup amount must be positive'
    );
  END IF;

  v_int_amount := ROUND(p_amount)::integer;

  IF v_int_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Topup amount must be at least 1'
    );
  END IF;

  -- Ensure wallet exists and atomically increment available_balance
  INSERT INTO public.wallets (user_id, available_balance, total_earned, created_at, updated_at)
  VALUES (p_user_id, v_int_amount, 0, NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET available_balance = public.wallets.available_balance + v_int_amount,
      updated_at = NOW()
  RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

  -- Insert TOPUP transaction into ledger
  INSERT INTO public.wallet_transactions (
    wallet_id,
    task_id,
    contribution_id,
    amount,
    currency,
    type,
    status,
    created_at
  ) VALUES (
    v_wallet_id,
    NULL,
    NULL,
    v_int_amount,
    COALESCE(p_currency, 'INR'),
    'TOPUP',
    'COMPLETED',
    NOW()
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'wallet_id', v_wallet_id,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance,
    'newBalance', v_new_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 8. New Canonical RPC: atomic_release_reward (service_role only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_release_reward(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_new_balance integer;
  v_current_balance integer;
BEGIN
  -- Administrative Boundary: ONLY executable by service_role
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: administrative operation requires service_role'
    );
  END IF;

  -- Lock transaction row
  SELECT id, wallet_id, amount, status, type
  INTO v_tx
  FROM public.wallet_transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Transaction not found'
    );
  END IF;

  -- Idempotency check: if already AVAILABLE, return current balance
  IF v_tx.status = 'AVAILABLE' THEN
    SELECT available_balance INTO v_current_balance
    FROM public.wallets WHERE id = v_tx.wallet_id;

    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'transaction_id', v_tx.id,
      'status', 'AVAILABLE',
      'new_balance', v_current_balance,
      'newBalance', v_current_balance,
      'idempotent', true,
      'error', null
    );
  END IF;

  IF v_tx.status NOT IN ('PENDING', 'VERIFIED') THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Transaction is not in PENDING or VERIFIED status'
    );
  END IF;

  -- Atomically increment developer available_balance and total_earned
  UPDATE public.wallets
  SET available_balance = available_balance + ABS(v_tx.amount),
      total_earned = total_earned + ABS(v_tx.amount),
      updated_at = NOW()
  WHERE id = v_tx.wallet_id
  RETURNING available_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Associated wallet not found'
    );
  END IF;

  -- Update transaction status to AVAILABLE
  UPDATE public.wallet_transactions
  SET status = 'AVAILABLE'
  WHERE id = v_tx.id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'transaction_id', v_tx.id,
    'wallet_id', v_tx.wallet_id,
    'status', 'AVAILABLE',
    'new_balance', v_new_balance,
    'newBalance', v_new_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 9. New Canonical RPC: atomic_refund_task_escrow
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_refund_task_escrow(
  p_task_id uuid,
  p_business_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task record;
  v_wallet_id uuid;
  v_new_balance integer;
  v_tx_id uuid;
  v_caller uuid;
  v_role text;
  v_user_company text;
  v_repo_owner text;
BEGIN
  v_caller := auth.uid();
  v_role := COALESCE(auth.role(), '');

  -- Security Boundary: Caller must be service_role OR authenticated business owner
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

  -- Lock task row
  SELECT id, status, reward_amount, reward_currency, escrow_locked
  INTO v_task
  FROM public.tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Task not found'
    );
  END IF;

  IF v_task.status <> 'open' AND v_task.status <> 'canceled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Only open or canceled tasks can have escrow refunded'
    );
  END IF;

  IF v_task.escrow_locked IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Escrow is not locked for this task'
    );
  END IF;

   -- Check if there is an active non-expired claim on this task
   IF EXISTS (
     SELECT 1 FROM public.claims
     WHERE task_id = p_task_id AND status = 'active' AND expires_at > NOW()
   ) THEN
     RETURN jsonb_build_object(
       'success', false,
       'ok', false,
       'error', 'Cannot refund escrow while an active claim exists on task'
     );
   END IF;

   -- Multi-tenant isolation: caller company must match task repository owner
   IF p_business_id IS NOT NULL THEN
     SELECT company INTO v_user_company FROM public.users WHERE id = p_business_id;
     IF NOT FOUND OR v_user_company IS NULL OR TRIM(v_user_company) = '' THEN
       RETURN jsonb_build_object(
         'success', false,
         'ok', false,
         'error', 'Business user not found or has no company assigned'
       );
     END IF;

     SELECT owner INTO v_repo_owner FROM public.repositories r
     JOIN public.tasks t ON t.repository_id = r.id
     WHERE t.id = p_task_id;

     IF NOT FOUND OR v_repo_owner IS NULL THEN
       RETURN jsonb_build_object(
         'success', false,
         'ok', false,
         'error', 'Task repository not found'
       );
     END IF;

     IF LOWER(TRIM(v_user_company)) <> LOWER(TRIM(v_repo_owner)) THEN
       RETURN jsonb_build_object(
         'success', false,
         'ok', false,
         'error', 'Forbidden: task repository does not belong to your company'
       );
     END IF;
   END IF;

   -- Update task: mark canceled and unlock escrow
   UPDATE public.tasks
  SET status = 'canceled',
      escrow_locked = false
  WHERE id = p_task_id;

  -- Refund bounty to business wallet if bounty exists
  IF v_task.reward_amount IS NOT NULL AND v_task.reward_amount > 0 THEN
    UPDATE public.wallets
    SET available_balance = available_balance + v_task.reward_amount,
        updated_at = NOW()
    WHERE user_id = p_business_id
    RETURNING id, available_balance INTO v_wallet_id, v_new_balance;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'ok', false,
        'error', 'Business wallet not found'
      );
    END IF;

    INSERT INTO public.wallet_transactions (
      wallet_id,
      task_id,
      amount,
      currency,
      type,
      status,
      created_at
    ) VALUES (
      v_wallet_id,
      p_task_id,
      v_task.reward_amount,
      COALESCE(v_task.reward_currency, 'INR'),
      'ESCROW_REFUND',
      'COMPLETED',
      NOW()
    ) RETURNING id INTO v_tx_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'task_id', p_task_id,
    'refunded_amount', COALESCE(v_task.reward_amount, 0),
    'new_balance', v_new_balance,
    'newBalance', v_new_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 10. Privilege Revocations and Precise Grants
-- -----------------------------------------------------------------------------

-- Revoke all execution from PUBLIC and anon for elevated user RPCs
REVOKE EXECUTE ON FUNCTION public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_request_withdrawal(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_request_withdrawal(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_request_withdrawal(uuid, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_claim_task(uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_claim_task(uuid, uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_claim_task(uuid, uuid, integer) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_create_task_with_escrow(uuid, uuid, text, text, numeric, text, text, text[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_create_task_with_escrow(uuid, uuid, text, text, numeric, text, text, text[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_create_task_with_escrow(uuid, uuid, text, text, numeric, text, text, text[], text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_credit_topup(uuid, numeric, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_credit_topup(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_credit_topup(uuid, numeric, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_refund_task_escrow(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_refund_task_escrow(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_refund_task_escrow(uuid, uuid) TO authenticated, service_role;

-- Strictly restrict administrative RPCs to service_role (REVOKE from PUBLIC, authenticated, anon)
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_release_reward(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_release_reward(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_release_reward(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_release_reward(uuid) TO service_role;
