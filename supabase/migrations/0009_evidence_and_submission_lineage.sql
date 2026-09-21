-- =============================================================================
-- Migration: 0009_evidence_and_submission_lineage.sql
-- Description:
--   1. Add submission revision lineage tracking (revision_number, parent_submission_id)
--      and partial unique index (single pending submission per claim)
--   2. Add durable evidence snapshot columns to public.contributions:
--      (github_repo_id, github_issue_number, pr_number, pr_author_github_id, merge_commit_sha, verification_source)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Submissions revision lineage
-- -----------------------------------------------------------------------------
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_submission_id uuid REFERENCES public.submissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_claim_id ON public.submissions(claim_id);
CREATE INDEX IF NOT EXISTS idx_submissions_parent ON public.submissions(parent_submission_id);

-- Enforce at most one active ('pending') submission per claim
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_unique_active_per_claim
  ON public.submissions(claim_id)
  WHERE (pr_status = 'pending');

-- -----------------------------------------------------------------------------
-- 2. Contributions durable evidence snapshot
-- -----------------------------------------------------------------------------
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS github_repo_id text,
  ADD COLUMN IF NOT EXISTS github_issue_number integer,
  ADD COLUMN IF NOT EXISTS pr_number integer,
  ADD COLUMN IF NOT EXISTS pr_author_github_id text,
  ADD COLUMN IF NOT EXISTS merge_commit_sha text,
  ADD COLUMN IF NOT EXISTS verification_source text NOT NULL DEFAULT 'github_api';

CREATE INDEX IF NOT EXISTS idx_contributions_task_id ON public.contributions(task_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON public.contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_repo_pr ON public.contributions(github_repo_id, pr_number);
