-- =============================================================================
-- 0002 — P0 RLS integrity: lock down money + verification writes
-- =============================================================================

-- Users may no longer flip the money columns on their own wallet. Wallet
-- mutations are server-side only (service role / stored procedures).
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

-- Wallet transactions are created/appended only by the server (credit/withdraw).
-- Removes the self-credit path (inserting a transaction that never happened).
DROP POLICY IF EXISTS "Users can insert own wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can update own wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Users can delete own wallet transactions" ON public.wallet_transactions;

-- Contributions are only created when a PR is verified & merged server-side.
-- Removes self-insert (fabricating contributions) and self-verify status flips.
DROP POLICY IF EXISTS "Users can insert own contributions" ON public.contributions;
DROP POLICY IF EXISTS "Users can update own contributions" ON public.contributions;
DROP POLICY IF EXISTS "Users can delete own contributions" ON public.contributions;

-- Claims may only be created/updated via server actions (service role).
-- Removes direct insert spam and manual status flips (e.g. to 'completed').
DROP POLICY IF EXISTS "Users can insert own claims" ON public.claims;
DROP POLICY IF EXISTS "Users can update own claims" ON public.claims;

-- Profile edits must not be able to escalate the account role. RLS policies
-- can't compare old/new rows, so block the role column at the privilege level.
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);
REVOKE UPDATE (role) ON public.users FROM authenticated;
REVOKE INSERT (role) ON public.users FROM authenticated;

-- Enforce a single active claim per developer, and per task, at the DB level.
-- First retire any older active claims (seed data has two active claims for one user).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY claimed_at DESC) AS rn
  FROM public.claims
  WHERE status = 'active'
)
UPDATE public.claims c
SET status = 'expired'
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_claim_per_user
  ON public.claims (user_id) WHERE (status = 'active');

CREATE UNIQUE INDEX IF NOT EXISTS one_active_claim_per_task
  ON public.claims (task_id) WHERE (status = 'active');

-- Row-level defenses are only effective if RLS stays enabled on these tables.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;