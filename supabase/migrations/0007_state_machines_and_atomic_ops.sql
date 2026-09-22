-- =============================================================================
-- Migration: 0007_state_machines_and_atomic_ops.sql
-- Description: Additive schema evolution and atomic RPC procedures for:
--   - R1a: Atomic wallet ledger operations (atomic_debit_wallet, atomic_credit_reward_pending)
--   - R1b: Reward lifecycle state machine (PENDING -> VERIFIED -> AVAILABLE)
--   - R1c: Withdrawal lifecycle state machine (REQUESTED -> PROCESSING -> PAID | FAILED)
--   - R1d: Escrow task creation atomicity (atomic_create_task_with_escrow)
--   - R1g: Unique constraint on contributions(submission_id)
--   - R2b: Claim expiry column (expires_at), indexes, and atomic_claim_task
--   - R2i: Atomic balance decrement & non-negative constraint
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Claims Table: Expiry Enforcement (R2b)
-- -----------------------------------------------------------------------------
ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT (now() + interval '48 hours');

-- Backfill existing claims without expires_at based on claimed_at + 48 hours
UPDATE public.claims
SET expires_at = claimed_at + interval '48 hours'
WHERE expires_at IS NULL;

ALTER TABLE public.claims
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.claims
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '48 hours');

CREATE INDEX IF NOT EXISTS idx_claims_expires_at
  ON public.claims (expires_at);

CREATE INDEX IF NOT EXISTS idx_claims_task_status_expires
  ON public.claims (task_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_claims_user_status_expires
  ON public.claims (user_id, status, expires_at);


-- -----------------------------------------------------------------------------
-- 2. Contributions Table: Submission Uniqueness (R1g)
-- -----------------------------------------------------------------------------
-- Deduplicate any existing duplicate contributions before adding unique constraint
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY submission_id ORDER BY created_at ASC) as rn
  FROM public.contributions
  WHERE submission_id IS NOT NULL
)
DELETE FROM public.contributions
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

ALTER TABLE public.contributions
  DROP CONSTRAINT IF EXISTS contributions_submission_id_unique;

ALTER TABLE public.contributions
  ADD CONSTRAINT contributions_submission_id_unique UNIQUE (submission_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contributions_submission_id
  ON public.contributions (submission_id);


-- -----------------------------------------------------------------------------
-- 3. Wallets Table: Hardening & Balance Integrity (R2i)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_id
  ON public.wallets (user_id);

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_user_id_unique;

ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_user_id_unique UNIQUE (user_id);

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS check_wallet_available_balance_non_negative;

ALTER TABLE public.wallets
  DROP CONSTRAINT IF EXISTS wallets_available_balance_non_negative;

ALTER TABLE public.wallets
  ADD CONSTRAINT check_wallet_available_balance_non_negative CHECK (available_balance >= 0);


-- -----------------------------------------------------------------------------
-- 4. Tasks Table: Ensure Escrow Column Exists
-- -----------------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS escrow_locked boolean NOT NULL DEFAULT true;


-- -----------------------------------------------------------------------------
-- 5. Wallet Transactions: Lifecycle Status Accommodation & Indexes (R1b, R1c)
-- -----------------------------------------------------------------------------
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_status_check;

ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_status_check
  CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'PAID',
    'FAILED',
    'COMPLETED',
    'CREDITED',
    'REQUESTED',
    'VERIFIED',
    'AVAILABLE',
    'REFUNDED'
  ));

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_status
  ON public.wallet_transactions (wallet_id, status);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_contribution_id
  ON public.wallet_transactions (contribution_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_transactions_unique_task_reward
  ON public.wallet_transactions (contribution_id)
  WHERE type = 'TASK_REWARD' AND contribution_id IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 6. RPC: Atomic Debit Wallet (R1a, R2i)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_debit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_currency text DEFAULT 'INR',
  p_type text DEFAULT 'WITHDRAWAL',
  p_status text DEFAULT 'COMPLETED',
  p_task_id uuid DEFAULT NULL
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
BEGIN
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
    amount,
    currency,
    type,
    status,
    created_at
  ) VALUES (
    v_wallet_id,
    p_task_id,
    NULL,
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
-- 7. RPC: Atomic Credit Reward Pending (R1a, R1b)
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
    -- If concurrent call inserted reward for this contribution first, return existing record
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
-- 8. RPC: Atomic Request Withdrawal (R1c)
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
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Withdrawal amount must be positive'
    );
  END IF;

  v_int_amount := ROUND(p_amount)::integer;

  IF v_int_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Withdrawal amount must be at least 1'
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
-- 9. RPC: Atomic Confirm Withdrawal (R1c)
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
    -- FAILED status: leave wallet balance untouched
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
-- 10. RPC: Atomic Create Task with Escrow (R1d)
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
BEGIN
  -- 1. Validate title
  IF p_title IS NULL OR TRIM(p_title) = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Issue title is required'
    );
  END IF;

  -- 2. Validate repository exists
  IF NOT EXISTS (SELECT 1 FROM public.repositories WHERE id = p_repository_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Target repository not found'
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
    -- If no bounty, just fetch the wallet balance if it exists
    SELECT available_balance INTO v_new_balance
    FROM public.wallets
    WHERE user_id = p_business_id;
  END IF;

  -- 6. Insert the task into public.tasks
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

  -- 7. Insert the escrow ledger record if bounty was held
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
-- 11. RPC: Atomic Claim Task with Lazy Expiry (R1h, R2b)
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
BEGIN
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
-- 12. Security Definer Function Grants
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.atomic_debit_wallet(uuid, numeric, text, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_credit_reward_pending(uuid, uuid, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_request_withdrawal(uuid, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_confirm_withdrawal(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_create_task_with_escrow(uuid, uuid, text, text, numeric, text, text, text[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.atomic_claim_task(uuid, uuid, integer) TO authenticated, service_role;
