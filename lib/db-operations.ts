import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseAdmin } from "@/lib/supabaseClient";

function db(): SupabaseClient | null {
  return supabaseAdmin ?? supabase;
}

export interface UserProfile {
  id: string;
  github_id?: string | null;
  github_handle?: string | null;
  username: string;
  email: string;
  avatar_url?: string | null;
  role: string;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  followers_count?: number | null;
  public_repos_count?: number | null;
  github_updated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Repository {
  id: string;
  github_repo_id: string;
  name: string;
  owner: string;
  url: string;
  description?: string | null;
  opted_in: boolean;
  opted_in_at?: string | null;
  created_at?: string | null;
}

export interface Task {
  id: string;
  repository_id: string;
  title: string;
  description?: string | null;
  issue_url?: string | null;
  difficulty: string;
  technology?: string | null;
  status: string;
  reward_amount?: number | null;
  reward_currency: string;
  created_at?: string | null;
}

export interface Claim {
  id: string;
  task_id: string;
  user_id: string;
  status: string;
  claimed_at?: string | null;
}

export interface Submission {
  id: string;
  task_id: string;
  user_id: string;
  claim_id: string;
  pr_url: string;
  pr_number?: string | null;
  pr_status: string;
  submitted_at?: string | null;
}

export interface Contribution {
  id: string;
  user_id: string;
  task_id: string;
  submission_id: string;
  status: string;
  reviewer?: string | null;
  merged_at?: string | null;
  created_at?: string | null;
}

export interface Wallet {
  id: string;
  user_id: string;
  available_balance: number;
  total_earned: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  task_id: string | null;
  contribution_id?: string | null;
  withdrawal_id?: string | null;
  amount: number;
  currency: string;
  type: string;
  status: string;
  created_at?: string | null;
}

export interface Profile {
  user: UserProfile | null;
  wallet: Wallet | null;
  submissions_count: number;
  contributions_count: number;
}

export interface UpsertUserInput {
  id?: string;
  github_id?: string | null;
  username?: string;
  email?: string;
  avatar_url?: string | null;
  role?: string;
}

export interface GitHubProfileData {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  followers?: number;
  public_repos?: number;
}

export interface RepositoriesFilter {
  optedInOnly?: boolean;
  owner?: string;
  limit?: number;
}

export interface OpenTasksFilter {
  repositoryId?: string;
  limit?: number;
}

export interface SubmitPRInput {
  task_id: string;
  user_id: string;
  claim_id: string;
  pr_url: string;
  pr_number?: string | null;
}

export interface CreateContributionInput {
  user_id: string;
  task_id: string;
  submission_id: string;
  status?: string;
  reviewer?: string | null;
  merged_at?: string | null;
}

export interface SubmissionReview {
  id: string;
  pr_url: string;
  pr_number?: string | null;
  pr_status: string;
  submitted_at?: string | null;
  task: {
    id: string;
    title: string;
    reward_amount?: number | null;
    reward_currency: string;
    repository_owner: string;
    repository_name: string;
  };
  user: {
    username: string;
    avatar_url?: string | null;
  } | null;
}

type MaybeObj<T> = T | T[] | null | undefined;

function pickOne<T>(value: MaybeObj<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function getPendingSubmissionsForCompany(
  company: string,
  clientOverride?: SupabaseClient | null,
): Promise<SubmissionReview[]> {
  const client = clientOverride ?? db();
  if (!client || !company) return [];
  const { data, error } = await client
    .from("submissions")
    .select(
      "id, pr_url, pr_number, pr_status, submitted_at, users(username, avatar_url), tasks(id, title, reward_amount, reward_currency, repositories(owner, name))",
    )
    .eq("pr_status", "pending")
    .order("submitted_at", { ascending: false });
  if (error) return [];

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    pr_url: string;
    pr_number?: string | null;
    pr_status?: string;
    submitted_at?: string | null;
    users?: MaybeObj<{ username?: string; avatar_url?: string | null }>;
    tasks?: {
      id?: string;
      title?: string;
      reward_amount?: number | null;
      reward_currency?: string;
      repositories?: MaybeObj<{ owner?: string; name?: string }>;
    } | null;
  }>;

  return rows
    .filter((row) => pickOne(row.tasks?.repositories)?.owner === company)
    .map((row) => {
      const repo = pickOne(row.tasks?.repositories);
      const user = pickOne(row.users);
      return {
        id: row.id,
        pr_url: row.pr_url,
        pr_number: row.pr_number ?? null,
        pr_status: row.pr_status ?? "pending",
        submitted_at: row.submitted_at ?? null,
        task: {
          id: row.tasks?.id ?? "",
          title: row.tasks?.title ?? "Untitled task",
          reward_amount: row.tasks?.reward_amount ?? null,
          reward_currency: row.tasks?.reward_currency ?? "INR",
          repository_owner: repo?.owner ?? "",
          repository_name: repo?.name ?? "",
        },
        user: user
          ? {
              username: user.username ?? "developer",
              avatar_url: user.avatar_url ?? null,
            }
          : null,
      };
    });
}

export interface CreditRewardInput {
  user_id: string;
  task_id: string;
  amount: number;
  currency: string;
  contribution_id?: string | null;
}

export async function creditReward(
  input: CreditRewardInput,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  const client = clientOverride ?? db();
  if (!client) return { ok: false, error: "No database client" };
  const { data: wallet } = await client
    .from("wallets")
    .select()
    .eq("user_id", input.user_id)
    .maybeSingle();
  if (!wallet) return { ok: false, error: "Recipient has no wallet" };

  // Idempotency check: if a contribution with this contribution_id already exists, skip
  if (input.contribution_id) {
    const { data: existingContribution } = await client
      .from("contributions")
      .select("id")
      .eq("id", input.contribution_id)
      .maybeSingle();
    if (existingContribution) {
      return { ok: true };
    }
  }

  const { error: updateError } = await client
    .from("wallets")
    .update({
      available_balance: (wallet.available_balance ?? 0) + input.amount,
      total_earned: (wallet.total_earned ?? 0) + input.amount,
    })
    .eq("id", wallet.id);
  if (updateError) return { ok: false, error: updateError.message };

  const { error: txError } = await client.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    task_id: input.task_id,
    contribution_id: input.contribution_id ?? null,
    amount: input.amount,
    currency: input.currency,
    type: "TASK_REWARD",
    status: "CREDITED",
  });
  if (txError) return { ok: false, error: txError.message };

  return { ok: true };
}

export interface DebitWalletInput {
  userId: string;
  amount: number;
  currency?: string;
}

export async function debitWallet(
  input: DebitWalletInput,
  clientOverride?: SupabaseClient | null,
): Promise<{ ok: boolean; error?: string }> {
  const client = clientOverride ?? db();
  if (!client) return { ok: false, error: "No database client" };

  // Get wallet for the user
  const { data: wallet } = await client
    .from("wallets")
    .select()
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!wallet) return { ok: false, error: "Wallet not found" };

  // Check if available_balance >= amount
  const availableBalance = wallet.available_balance ?? 0;
  if (availableBalance < input.amount) {
    return { ok: false, error: "Insufficient balance" };
  }

  // Idempotency check: same wallet + amount + type within last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existingTx } = await client
    .from("wallet_transactions")
    .select("id")
    .eq("wallet_id", wallet.id)
    .eq("amount", -Math.abs(input.amount))
    .eq("type", "WITHDRAWAL")
    .gte("created_at", fiveMinutesAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingTx) {
    return { ok: true };
  }

  // Update wallet by subtracting the amount
  const { error: updateError } = await client
    .from("wallets")
    .update({
      available_balance: availableBalance - input.amount,
    })
    .eq("id", wallet.id);

  if (updateError) return { ok: false, error: updateError.message };

  // Insert wallet transaction with negative amount, type 'WITHDRAWAL', status 'COMPLETED'
  const withdrawalId = `${input.userId}_${Date.now()}`;
  const { error: txError } = await client.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    task_id: null,
    contribution_id: null,
    withdrawal_id: withdrawalId,
    amount: -Math.abs(input.amount),
    currency: input.currency ?? "INR",
    type: "WITHDRAWAL",
    status: "COMPLETED",
  });

  if (txError) return { ok: false, error: txError.message };

  return { ok: true };
}

export async function getUserByGithubId(
  githubId: string,
  clientOverride?: SupabaseClient | null,
): Promise<UserProfile | null> {
  const client = clientOverride ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("users")
    .select()
    .eq("github_id", githubId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getUserByEmail(
  email: string,
  clientOverride?: SupabaseClient | null,
): Promise<UserProfile | null> {
  const client = clientOverride ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("users")
    .select()
    .eq("email", email)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getUserById(
  id: string,
  clientOverride?: SupabaseClient | null,
): Promise<UserProfile | null> {
  const client = clientOverride ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("users")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function upsertUser(
  user: UpsertUserInput,
  clientOverride?: SupabaseClient | null,
): Promise<UserProfile | null> {
  const client = clientOverride ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("users")
    .upsert(
      {
        // Write the owning auth.users id so first-time OAuth users can INSERT
        // their own row (users.id is NOT NULL and RLS requires auth.uid() = id).
        ...(user.id ? { id: user.id } : {}),
        github_id: user.github_id ?? null,
        username: user.username ?? "",
        email: user.email ?? "",
        avatar_url: user.avatar_url ?? null,
      },
      { onConflict: "id", ignoreDuplicates: false },
    )
    .select()
    .maybeSingle();
  if (error) {
    console.error("[upsertUser] Supabase error:", error.message, error.details, error.hint);
    return null;
  }
  return data;
}

export async function syncGithubProfile(
  userId: string,
  providerToken: string,
  githubId?: string | null,
  githubHandle?: string | null,
  clientOverride?: SupabaseClient | null,
): Promise<UserProfile | null> {
  const client = clientOverride ?? db();
  if (!client) return null;

  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${providerToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "gig-alpha",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API request failed (${res.status})`);
  }

  const data = (await res.json()) as GitHubProfileData;
  const { data: profile, error } = await client
    .from("users")
    .update({
      github_id: githubId ?? data.login ?? null,
      github_handle: githubHandle ?? data.login ?? null,
      username: data.name ?? data.login ?? "",
      avatar_url: data.avatar_url ?? null,
      bio: data.bio ?? null,
      company: data.company ?? null,
      location: data.location ?? null,
      followers_count: data.followers ?? 0,
      public_repos_count: data.public_repos ?? 0,
      github_updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Could not write GitHub profile: ${error.message}`);
  }
  return profile;
}

export async function getRepositories(
  filter?: RepositoriesFilter,
  clientOverride?: SupabaseClient | null,
): Promise<Repository[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  let query = client.from("repositories").select();
  if (filter?.optedInOnly) {
    query = query.eq("opted_in", true);
  }
  if (filter?.owner) {
    query = query.eq("owner", filter.owner);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export async function getRepositoryById(
  id: string,
): Promise<Repository | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("repositories")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getOpenTasks(
  filter?: OpenTasksFilter,
  clientOverride?: SupabaseClient | null,
): Promise<Task[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  let query = client.from("tasks").select().eq("status", "open");
  if (filter?.repositoryId) {
    query = query.eq("repository_id", filter.repositoryId);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

export interface TaskWithRepository {
  task: Task;
  repository: Repository | null;
}

export async function getOpenTasksWithRepositories(
  filter?: { repositoryIds?: string[]; limit?: number },
  clientOverride?: SupabaseClient | null,
): Promise<TaskWithRepository[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  let query = client
    .from("tasks")
    .select("*, repositories(*)")
    .eq("status", "open");
  if (filter?.repositoryIds && filter.repositoryIds.length > 0) {
    query = query.in("repository_id", filter.repositoryIds);
  }
  if (filter?.limit) {
    query = query.limit(filter.limit);
  }
  query = query.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map((row) => ({
    task: {
      id: row.id,
      repository_id: row.repository_id,
      title: row.title,
      description: row.description ?? null,
      issue_url: row.issue_url ?? null,
      difficulty: row.difficulty,
      technology: row.technology ?? null,
      status: row.status,
      reward_amount: row.reward_amount ?? null,
      reward_currency: row.reward_currency,
      created_at: row.created_at ?? null,
    },
    repository: row.repositories ?? null,
  }));
}

export async function countActiveClaimsForTasks(
  taskIds: string[],
  clientOverride?: SupabaseClient | null,
): Promise<number> {
  const client = clientOverride ?? db();
  if (!client || taskIds.length === 0) return 0;
  const { count, error } = await client
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .in("task_id", taskIds);
  if (error) return 0;
  return count ?? 0;
}

export async function getTaskById(id: string): Promise<Task | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("tasks")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getTasksByRepository(
  repositoryId: string,
): Promise<Task[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("tasks")
    .select()
    .eq("repository_id", repositoryId);
  if (error) return [];
  return data ?? [];
}

export async function claimTask(
  taskId: string,
  userId: string,
): Promise<Claim | null> {
  const client = db();
  if (!client) return null;
  const { data: existing } = await client
    .from("claims")
    .select()
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (existing) return existing;
  const { data, error } = await client
    .from("claims")
    .insert({ task_id: taskId, user_id: userId, status: "active" })
    .select()
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getClaimsByUser(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<Claim[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  const { data, error } = await client
    .from("claims")
    .select()
    .eq("user_id", userId)
    .order("claimed_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getActiveClaimForTask(
  taskId: string,
): Promise<Claim | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("claims")
    .select()
    .eq("task_id", taskId)
    .eq("status", "active")
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function setClaimStatus(
  claimId: string,
  status: string,
  clientOverride?: SupabaseClient | null,
): Promise<boolean> {
  const client = clientOverride ?? db();
  if (!client) return false;
  const { error } = await client
    .from("claims")
    .update({ status })
    .eq("id", claimId);
  return !error;
}

export async function getWalletByUser(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<Wallet | null> {
  const client = clientOverride ?? db();
  if (!client) return null;
  const { data, error } = await client
    .from("wallets")
    .select()
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getWalletTransactions(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<WalletTransaction[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  const wallet = await getWalletByUser(userId, client);
  if (!wallet) return [];
  const { data, error } = await client
    .from("wallet_transactions")
    .select()
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export interface ClaimedTask {
  task: Task | null;
  claim: Claim;
}

export async function getClaimedTasksByUser(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<ClaimedTask[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  const { data, error } = await client
    .from("claims")
    .select("*, tasks(*)")
    .eq("user_id", userId)
    .order("claimed_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((row) => ({
    claim: {
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      status: row.status,
      claimed_at: row.claimed_at,
    },
    task: row.tasks ?? null,
  }));
}

export async function submitPR(
  input: SubmitPRInput,
): Promise<Submission | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("submissions")
    .insert({
      task_id: input.task_id,
      user_id: input.user_id,
      claim_id: input.claim_id,
      pr_url: input.pr_url,
      pr_number: input.pr_number ?? null,
      pr_status: "pending",
    })
    .select()
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getSubmissionsByUser(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<Submission[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  const { data, error } = await client
    .from("submissions")
    .select()
    .eq("user_id", userId)
    .order("submitted_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getSubmissionById(
  id: string,
): Promise<Submission | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("submissions")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function updateSubmissionStatus(
  id: string,
  status: string,
): Promise<Submission | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("submissions")
    .update({ pr_status: status })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function createContribution(
  input: CreateContributionInput,
): Promise<Contribution | null> {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("contributions")
    .insert({
      user_id: input.user_id,
      task_id: input.task_id,
      submission_id: input.submission_id,
      status: input.status ?? "verified",
      reviewer: input.reviewer ?? null,
      merged_at: input.merged_at ?? null,
    })
    .select()
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getContributionsByUser(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<Contribution[]> {
  const client = clientOverride ?? db();
  if (!client) return [];
  const { data, error } = await client
    .from("contributions")
    .select()
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return data ?? [];
}

export async function getContributionCount(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<number> {
  const client = clientOverride ?? db();
  if (!client) return 0;
  const { count, error } = await client
    .from("contributions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}

export async function getFullProfile(
  userId: string,
  clientOverride?: SupabaseClient | null,
): Promise<Profile> {
  const client = clientOverride ?? db();
  if (!client) {
    return {
      user: null,
      wallet: null,
      submissions_count: 0,
      contributions_count: 0,
    };
  }

  const userPromise = client
    .from("users")
    .select()
    .eq("id", userId)
    .maybeSingle();
  const walletPromise = client
    .from("wallets")
    .select()
    .eq("user_id", userId)
    .maybeSingle();
  const submissionsPromise = client
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const contributionsPromise = client
    .from("contributions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const [userRes, walletRes, submissionsRes, contributionsRes] =
    await Promise.all([
      userPromise,
      walletPromise,
      submissionsPromise,
      contributionsPromise,
    ]);

  return {
    user: userRes.data,
    wallet: walletRes.data,
    submissions_count: submissionsRes.count ?? 0,
    contributions_count: contributionsRes.count ?? 0,
  };
}

export const __dbClient = supabaseAdmin ?? supabase;
