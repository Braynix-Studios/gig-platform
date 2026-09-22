-- =============================================================================
-- Migration: 0012_reputation_and_audit.sql
-- Description:
--   P2 scaffolding for reputation engine and immutable audit trail.
--   1. `reputation_scores` table stores cached 0–100 scores per user.
--   2. `audit_logs` table stores append-only marketplace/financial events.
--   3. `atomic_append_audit_event` RPC enforces service_role-only writes.
-- =============================================================================

-- Reputation scores cache
CREATE TABLE IF NOT EXISTS public.reputation_scores (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  verified_contributions integer NOT NULL DEFAULT 0,
  last_calculated_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Immutable audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs (created_at DESC);

-- Prevent direct inserts/updates/deletes; use the atomic RPC only.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.reputation_scores FROM PUBLIC;

-- Canonical RPC: append a single audit event (service_role only)
CREATE OR REPLACE FUNCTION public.atomic_append_audit_event(
  p_actor_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id text,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RETURN jsonb_build_object(
      'success', false,
      'ok', false,
      'error', 'Forbidden: audit writes require service_role'
    );
  END IF;

  INSERT INTO public.audit_logs (actor_id, event_type, entity_type, entity_id, metadata)
  VALUES (p_actor_id, p_event_type, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'ok', true,
    'event_id', v_id,
    'error', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_append_audit_event(uuid, text, text, text, jsonb) TO service_role;
GRANT SELECT ON public.reputation_scores TO authenticated, service_role;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;
