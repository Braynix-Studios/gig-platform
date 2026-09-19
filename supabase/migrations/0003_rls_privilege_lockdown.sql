-- =============================================================================
-- 0003 — RLS hardening part 2: privilege-layer lockdown + explicit DENY policies
--
-- Root cause discovered during live verification: a RELATION with SOME policies
-- (e.g. SELECT/INSERT) but NO policy for a given DML command still permitted that
-- DML via RLS fallback (e.g. UPDATE on `wallets` worked with zero UPDATE policy).
-- Column-level REVOKE also does NOT defeat a table-level GRANT, so role
-- escalation on `users.role` slipped through until now.
--
-- Fix: remove table-level write privileges for anon/authenticated and back it
-- with explicit DENY policies so the policy layer can never silently "fall
-- back" to allow again.
-- =============================================================================

-- --- wallets --------------------------------------------------------------
-- Balances are only mutated by server-side flows (service role). Users get
-- read-only access to their own wallet.
REVOKE UPDATE, DELETE ON public.wallets FROM authenticated, anon;
CREATE POLICY "Deny user wallet writes" ON public.wallets
  FOR UPDATE USING (false) WITH CHECK (false);

-- --- wallet_transactions ---------------------------------------------------
-- Ledger is append-only and written exclusively by the server.
REVOKE INSERT, UPDATE, DELETE ON public.wallet_transactions FROM authenticated, anon;
CREATE POLICY "Deny user wallet tx writes" ON public.wallet_transactions
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny user wallet tx updates" ON public.wallet_transactions
  FOR UPDATE USING (false) WITH CHECK (false);

-- --- contributions ---------------------------------------------------------
-- Only created when a PR is verified/merged by the server. Users read their own.
REVOKE INSERT, UPDATE, DELETE ON public.contributions FROM authenticated, anon;
CREATE POLICY "Deny user contribution writes" ON public.contributions
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny user contribution updates" ON public.contributions
  FOR UPDATE USING (false) WITH CHECK (false);

-- --- claims ----------------------------------------------------------------
-- Created and transitioned only by server actions (single-active-claim rules).
REVOKE INSERT, UPDATE, DELETE ON public.claims FROM authenticated, anon;
CREATE POLICY "Deny user claim writes" ON public.claims
  FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny user claim updates" ON public.claims
  FOR UPDATE USING (false) WITH CHECK (false);

-- --- users ----------------------------------------------------------------
-- Profile edits are allowed, but the role column (and id) can never change.
-- Column-level REVOKE cannot override the table-level GRANT, so revoke the
-- whole UPDATE privilege and re-grant only the safe, editable columns.
REVOKE UPDATE ON public.users FROM authenticated, anon;
GRANT UPDATE (username, avatar_url, github_handle, bio, company, location, followers_count, public_repos_count) ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "People can update own profile" ON public.users;
CREATE POLICY "Users can update own profile only" ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);