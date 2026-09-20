-- =============================================================================
-- 0006 — Competitive racing claims & Escrow holds for tasks
-- =============================================================================

-- 1. In competitive racing, multiple developers can attempt the same task concurrently.
-- Drop the single-active-claim-per-task constraint so multiple developers can work on it.
-- We keep a unique constraint per (task_id, user_id) so a single user cannot claim the same task twice concurrently.
DROP INDEX IF EXISTS public.one_active_claim_per_task;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_claim_per_user_task
  ON public.claims (task_id, user_id) WHERE (status = 'active');

-- 2. Add escrow hold tracking to tasks table if not present
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS escrow_locked boolean NOT NULL DEFAULT true;

-- 3. Allow TOPUP transaction type for purchasing GIG Coins in wallet_transactions
-- Check constraint on type if any, or verify wallet_transactions schema
ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

