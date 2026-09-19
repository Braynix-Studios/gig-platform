-- GitHub profile sync columns for public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS github_handle varchar(100),
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS company varchar(255),
  ADD COLUMN IF NOT EXISTS location varchar(255),
  ADD COLUMN IF NOT EXISTS followers_count integer,
  ADD COLUMN IF NOT EXISTS public_repos_count integer,
  ADD COLUMN IF NOT EXISTS github_updated_at timestamptz;