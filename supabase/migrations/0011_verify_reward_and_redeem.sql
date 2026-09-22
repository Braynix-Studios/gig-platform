-- =============================================================================
-- Migration: 0011_verify_reward_and_redeem.sql
-- Description:
--   Milestone 2 Hardening:
--   1. Add canonical atomic_verify_reward RPC (service_role only):
--      Transitions reward transactions PENDING -> VERIFIED after evidence
--      capture (business review, GitHub webhook confirmation, etc.).
--   2. Add canonical atomic_redeem_reward RPC (service_role only):
--      Marks rewards that have reached AVAILABLE as REDEEMED after payout
--      completion / withdraw confirmation. This is the final ledger state.
--   3. Grant EXECUTE to service_role for the new administrative RPCs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- New Canonical RPC: atomic_verify_reward (service_role only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_verify_reward(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
BEGIN
  -- Administrative Boundary: ONLY executable by service_role
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: verification requires service_role'
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

  -- Idempotency check: if already VERIFIED, return current state
  IF v_tx.status = 'VERIFIED' THEN
    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'transaction_id', v_tx.id,
      'status', 'VERIFIED',
      'error', null
    );
  END IF;

  IF v_tx.status <> 'PENDING' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Transaction is not in PENDING status'
    );
  END IF;

  -- Transition PENDING -> VERIFIED without crediting available_balance
  UPDATE public.wallet_transactions
  SET status = 'VERIFIED',
      updated_at = NOW()
  WHERE id = v_tx.id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'transaction_id', v_tx.id,
    'status', 'VERIFIED',
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- New Canonical RPC: atomic_redeem_reward (service_role only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_redeem_reward(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx record;
  v_current_balance integer;
BEGIN
  -- Administrative Boundary: ONLY executable by service_role
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: redemption requires service_role'
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

  -- Idempotency check: if already REDEEMED, return current balance
  IF v_tx.status = 'REDEEMED' THEN
    SELECT available_balance INTO v_current_balance
    FROM public.wallets WHERE id = v_tx.wallet_id;

    RETURN jsonb_build_object(
      'success', true,
      'ok', true,
      'transaction_id', v_tx.id,
      'status', 'REDEEMED',
      'new_balance', v_current_balance,
      'newBalance', v_current_balance,
      'idempotent', true,
      'error', null
    );
  END IF;

  IF v_tx.status <> 'AVAILABLE' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Transaction is not in AVAILABLE status'
    );
  END IF;

  -- Finalize transaction status; balance was already credited at AVAILABLE.
  UPDATE public.wallet_transactions
  SET status = 'REDEEMED',
      updated_at = NOW()
  WHERE id = v_tx.id;

  SELECT available_balance INTO v_current_balance
  FROM public.wallets WHERE id = v_tx.wallet_id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'transaction_id', v_tx.id,
    'status', 'REDEEMED',
    'new_balance', v_current_balance,
    'newBalance', v_current_balance,
    'error', null
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- Grant EXECUTE for new administrative RPCs to service_role
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.atomic_verify_reward(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_verify_reward(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_verify_reward(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_verify_reward(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_redeem_reward(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_redeem_reward(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.atomic_redeem_reward(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_redeem_reward(uuid) TO service_role;
