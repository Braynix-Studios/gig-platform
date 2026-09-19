-- =============================================================================
-- 0005 — Prevent multi-tenant impersonation by revoking company updates
-- =============================================================================

-- Revoke the full UPDATE grant given in migration 0003
REVOKE UPDATE ON public.users FROM authenticated;

-- Re-grant UPDATE, omitting the 'company' column
GRANT UPDATE (username, avatar_url, github_handle, bio, location, followers_count, public_repos_count) ON public.users TO authenticated;
