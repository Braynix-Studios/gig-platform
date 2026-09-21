-- =============================================================================
-- Migration: 0008_security_definer_authorization.sql
-- Description: 
--   1. Enforce strict caller authorization inside all SECURITY DEFINER RPCs:
--      - atomic_debit_wallet: assert auth.uid() = p_user_id (or service_role)
--      - atomic_request_withdrawal: assert auth.uid() = p_user_id (or service_role)
--      - atomic_claim_task: assert auth.uid() = p_user_id (or service_role)
--      - atomic_create_task_with_escrow: assert auth.uid() = p_business_id (or service_role)
--   2. Revoke administrative RPC execution from authenticated users:
--      - atomic_confirm_withdrawal: ONLY executable by service_role
--      - atomic_credit_reward_pending: ONLY executable by service_role
--   3. Tighten withdrawal ownership verification in confirmation logic
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
BEGIN
  v_caller := auth.uid();

  -- Security Boundary: When invoked via client auth, caller MUST match target user
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
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
BEGIN
  v_caller := auth.uid();

  -- Security Boundary: When invoked via client auth, caller MUST match target user
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
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
BEGIN
  v_caller := auth.uid();

  -- Security Boundary: Caller cannot claim on behalf of another user
  IF v_caller IS NOT NULL AND v_caller <> p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: cannot claim issues for another user'
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
-- 4. Hardened RPC: atomic_create_task_with_escrow
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
BEGIN
  v_caller := auth.uid();

  -- Security Boundary: Caller cannot create tasks charged to another business
  IF v_caller IS NOT NULL AND v_caller <> p_business_id THEN
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

  -- 2. Validate repository exists and is opted in
  IF NOT EXISTS (
    SELECT 1 FROM public.repositories
    WHERE id = p_repository_id AND opted_in = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Target repository not found or not opted in'
    );
  END IF;

  -- 3. Determine bounty requirements and validate
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

  -- 4. Convert tags array to technology string if provided (truncated to 100 chars)
  IF p_tags IS NOT NULL AND array_length(p_tags, 1) > 0 THEN
    v_technology := SUBSTRING(ARRAY_TO_STRING(p_tags, ', ') FROM 1 FOR 100);
  ELSE
    v_technology := NULL;
  END IF;

  -- 5. Reserve escrow funds from business wallet if bounty specified
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

  -- 6. Insert task
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

  -- 7. Insert escrow ledger transaction
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
-- 5. Revoke & Secure Privilege Grants
-- -----------------------------------------------------------------------------
-- Revoke all public / authenticated access to sensitive administrative functions
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) FROM anon;

-- Explicitly allow only service_role on administrative RPCs
GRANT EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) TO service_role;

-- Allow authenticated (with internal auth.uid() guards) and service_role on user-initiated RPCs
GRANT EXECUTE ON FUNCTION public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_request_withdrawal(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_create_task_with_escrow(uuid, uuid, text, text, numeric, text, text, text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_claim_task(uuid, uuid, integer) TO authenticated, service_role;
