-- Enable the uuid-ossp extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Public tables for Alpha core (Supabase PostgreSQL)
-- =============================================================================

-- Users / Profiles
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  github_id varchar(64) UNIQUE,
  username varchar(100) NOT NULL,
  email varchar(255) NOT NULL,
  avatar_url varchar(512),
  role varchar(20) NOT NULL DEFAULT 'developer',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role can manage users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- Repositories
CREATE TABLE public.repositories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_repo_id varchar(255) NOT NULL UNIQUE,
  name varchar(255) NOT NULL,
  owner varchar(255) NOT NULL,
  url varchar(512) NOT NULL,
  description text,
  opted_in boolean NOT NULL DEFAULT FALSE,
  opted_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Repositories viewable by authenticated users" ON public.repositories FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage repositories" ON public.repositories FOR ALL USING (true) WITH CHECK (true);

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  title varchar(500) NOT NULL,
  description text,
  issue_url varchar(512),
  difficulty varchar(20) NOT NULL DEFAULT 'standard',
  technology varchar(100),
  status varchar(20) NOT NULL DEFAULT 'open',
  reward_amount integer,
  reward_currency varchar(3) NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tasks viewable by authenticated users" ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service role can manage tasks" ON public.tasks FOR ALL USING (true) WITH CHECK (true);

-- Claims
CREATE TABLE public.claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'active',
  claimed_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own claims" ON public.claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own claims" ON public.claims FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage claims" ON public.claims FOR ALL USING (true) WITH CHECK (true);

-- Submissions
CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  pr_url varchar(512) NOT NULL,
  pr_number varchar(50),
  pr_status varchar(20) NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own submissions" ON public.submissions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);

-- Contributions
CREATE TABLE public.contributions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  status varchar(20) NOT NULL DEFAULT 'verified',
  reviewer varchar(100),
  merged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contributions" ON public.contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contributions" ON public.contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contributions" ON public.contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage contributions" ON public.contributions FOR ALL USING (true) WITH CHECK (true);

-- Wallets
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  available_balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role can manage wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);

-- Wallet Transactions
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  contribution_id uuid REFERENCES public.contributions(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'INR',
  type varchar(50) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'CREDITED',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
);
CREATE POLICY "Users can insert own wallet transactions" ON public.wallet_transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
);
CREATE POLICY "Users can update own wallet transactions" ON public.wallet_transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
);
CREATE POLICY "Service role can manage wallet transactions" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);
