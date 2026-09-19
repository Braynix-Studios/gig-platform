import { supabaseAdmin, supabase, createServerClientWithCookies } from '@/lib/supabaseClient';
import {
  type Profile,
  type ClaimedTask,
  type WalletTransaction,
  type Submission,
  type SubmissionReview,
  type Contribution,
  type Task,
  getFullProfile,
  getClaimedTasksByUser,
  getWalletTransactions,
  getSubmissionsByUser,
  getContributionsByUser,
  getOpenTasks,
  getOpenTasksWithRepositories,
  getClaimsByUser,
  getRepositories,
  getPendingSubmissionsForCompany,
  countActiveClaimsForTasks,
} from '@/lib/db-operations';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type DashboardRole,
  type DashboardStats,
  type SidebarStats,
  normalizeDisplayName,
  normalizeEmail,
  normalizeHandle,
  getSidebarStatsSync,
} from '@/lib/dashboard-stats-defaults';

export {
  type DashboardRole,
  type DashboardStats,
  type SidebarStats,
  normalizeDisplayName,
  normalizeEmail,
  normalizeHandle,
  getSidebarStatsSync,
};

function supabaseDb(): SupabaseClient | null {
  return supabaseAdmin ?? supabase;
}

function formatBalance(inr: number): string {
  const amount = Number(inr) || 0;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DeveloperStats {
  reputationScore: string;
  reputationBadge: string;
  reputationFooter: string;
  verifiedContributions: string;
  contributionsFooter: string;
  lockedTasks: string;
  lockedFooter: string;
  walletBalance: string;
  walletFooter: string;
}

const DEV_FALLBACK: DeveloperStats = {
  reputationScore: '98.4',
  reputationBadge: 'TOP 2%',
  reputationFooter: '0\u2013100 Weighted Score \u00b7 Top 2% Network',
  verifiedContributions: '24',
  contributionsFooter: 'Across 6 production open-source repositories',
  lockedTasks: '2',
  lockedFooter: '\u20b94,700 in locked escrow \u00b7 48h lock active',
  walletBalance: '\u20b94,850',
  walletFooter: 'Ready for instant UPI bank withdrawal (Min \u20b9500)',
};

export async function getDeveloperStats(userId?: string): Promise<DeveloperStats> {
  if (userId && supabaseDb()) {
    try {
      const profile = await getFullProfile(userId);
      if (profile.user) {
        const balance = profile.wallet?.available_balance ?? 0;
        return {
          reputationScore: DEV_FALLBACK.reputationScore,
          reputationBadge: DEV_FALLBACK.reputationBadge,
          reputationFooter: DEV_FALLBACK.reputationFooter,
          verifiedContributions: String(profile.contributions_count),
          contributionsFooter: DEV_FALLBACK.contributionsFooter,
          lockedTasks: String(profile.submissions_count),
          lockedFooter: DEV_FALLBACK.lockedFooter,
          walletBalance: `\u20b9${balance}`,
          walletFooter: DEV_FALLBACK.walletFooter,
        };
      }
    } catch {
      // fall through to fallback
    }
  }
  return DEV_FALLBACK;
}

export async function getSidebarStats(role: DashboardRole, userId?: string): Promise<SidebarStats> {
  if (role === 'business') {
    const db = supabaseAdmin !== supabase ? supabaseAdmin : null;
    if (!db || !userId) {
      return getSidebarStatsSync('business');
    }
    try {
      const [walletRes, tasksRes, usersRes, userRes] = await Promise.all([
        db.from('wallets').select('available_balance').eq('user_id', userId).maybeSingle(),
        db.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        db.from('users').select('*', { count: 'exact', head: true }).eq('role', 'developer'),
        db.from('users').select('company').eq('id', userId).maybeSingle(),
      ]);

      if (walletRes.error || tasksRes.error || usersRes.error || userRes.error || walletRes.data == null) {
        return getSidebarStatsSync('business');
      }

      const balance = walletRes.data.available_balance ?? 0;
      const taskBacklog = tasksRes.count ?? 0;
      const talentPool = usersRes.count ?? 0;

      const company = userRes.data?.company ?? null;
      let issuePoolCount = 0;
      if (company) {
        const repoRes = await db.from('repositories').select('id').eq('owner', company);
        const repoIds = (repoRes.data ?? []).map((r: { id: string }) => r.id);
        if (repoIds.length > 0) {
          const poolRes = await db
            .from('tasks')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open')
            .in('repository_id', repoIds);
          issuePoolCount = poolRes.count ?? 0;
        }
      }

      return {
        walletLabel: 'Escrow Vault',
        walletValue: formatBalance(balance),
        walletSubtext: '$14,200 locked in bounties',
        walletHref: '/dashboard/business?tab=billing',
        counts: {
          'Tasks Backlog': String(taskBacklog),
          'Talent Pool': String(talentPool),
          'Issue Pool': String(issuePoolCount),
        },
      };
    } catch {
      return getSidebarStatsSync('business');
    }
  }

  // Independent sources: stats + open-task count resolve in parallel.
  const db = supabaseAdmin !== supabase ? supabaseAdmin : null;
  const [dev, issuePoolCount] = await Promise.all([
    getDeveloperStats(userId),
    (async () => {
      if (!db) return 0;
      try {
        const poolRes = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'open');
        return poolRes.count ?? 0;
      } catch {
        return 0;
      }
    })(),
  ]);
  return {
    walletLabel: 'GIG Wallet',
    walletValue: dev.walletBalance,
    walletSubtext: 'Above \u20b9500 UPI threshold',
    walletHref: '/dashboard/developer?tab=wallet',
    reputationValue: dev.reputationScore,
    reputationBadge: dev.reputationBadge,
    counts: {
      Tasks: dev.lockedTasks,
      'Verified PRs': dev.verifiedContributions,
      'Issue Pool': String(issuePoolCount),
    },
  };
}

export async function getDeveloperDashboard(userId: string) {
  let client: SupabaseClient | null = null;
  try {
    client = await createServerClientWithCookies();
  } catch {
    client = null;
  }

  let profile: Profile | null = null;
  let claimedTasks: ClaimedTask[] = [];
  let transactions: WalletTransaction[] = [];
  let submissions: Submission[] = [];
  let contributions: Contribution[] = [];

  if (client) {
    try {
      const [p, c, t, s, co] = await Promise.all([
        getFullProfile(userId, client),
        getClaimedTasksByUser(userId, client),
        getWalletTransactions(userId, client),
        getSubmissionsByUser(userId, client),
        getContributionsByUser(userId, client),
      ]);
      profile = p;
      claimedTasks = c;
      transactions = t;
      submissions = s;
      contributions = co;
    } catch {
      // fall through to fallback
    }
  }

  const user = profile?.user ?? null;
  const wallet = profile?.wallet ?? null;
  const walletBalance = wallet?.available_balance ?? 0;
  const displayName = user?.github_handle || user?.username || user?.email?.split('@')[0] || 'Developer';
  const githubHandle = user?.github_handle || user?.github_id || null;

  const stats = profile?.user
    ? {
        reputationScore: String(98.4),
        reputationBadge: 'TOP 2%',
        reputationFooter: '0\u2013100 Weighted Score \u00b7 Top 2% Network',
        verifiedContributions: String(profile.contributions_count),
        contributionsFooter:
          contributions.length > 0
            ? `Across ${new Set(contributions.map((c) => c.task_id)).size} tasks`
            : 'Across 6 production open-source repositories',
        lockedTasks: String(profile.submissions_count),
        lockedFooter: 'Locked escrow \u00b7 48h lock active',
        walletBalance: `\u20b9${walletBalance}`,
        walletFooter: 'Ready for instant UPI bank withdrawal (Min \u20b9500)',
      }
    : null;

  return {
    profile,
    user,
    wallet,
    claimedTasks,
    transactions,
    submissions,
    contributions,
    stats,
    displayName,
    githubHandle,
    handle: user?.email || profile?.user?.email || displayName,
  };
}

export interface WorkspaceMetric {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}

export interface BacklogTask {
  id: string;
  title: string;
  repo: string;
  budget: string;
  applicantsCount: number;
  status: 'Active' | 'Reviewing' | 'Open for Bids' | 'Queued';
  assignee?: string;
  priority: 'Critical' | 'High' | 'Standard';
  targetRelease: string;
}

export interface TalentContributor {
  id: string;
  name: string;
  githubHandle: string;
  reputation: number;
  mergedPRs: number;
  specialties: string[];
  status: 'Available' | 'Assigned' | 'Top Contributor';
}

export interface EscrowDisbursal {
  id: string;
  date: string;
  recipient: string;
  taskTitle: string;
  amount: string;
  status: 'Settled' | 'Processing';
  txHash: string;
}

export function getWorkspaceMetrics(): WorkspaceMetric[] {
  return [
    { label: 'Active Engineering Bounties', value: '8', subtext: '4 in progress, 4 accepting bids', highlight: true },
    { label: 'Vetted Talent Pool', value: '42', subtext: 'Cryptographically certified contributors' },
    { label: 'Escrow Vault Secured', value: '$32,500', subtext: '100% smart contract collateralized' },
    { label: 'Avg PR Merge Velocity', value: '4.2 hrs', subtext: 'Automated verification test pass' },
  ];
}

export function getBacklogTasks(): BacklogTask[] {
  return [
    { id: 'task-b1', title: 'Next.js 16 Turbopack Bundle Analyzer & Cache Optimizer', repo: 'enterprise/core-runtime', budget: '$1,200 USDC', applicantsCount: 3, status: 'Active', assignee: 'Alex Rivers', priority: 'Critical', targetRelease: 'v0.2.0-rc1' },
    { id: 'task-b2', title: 'Zero-Knowledge Proof Merkle Tree Verification Engine', repo: 'enterprise/zk-contracts', budget: '$2,500 USDC', applicantsCount: 6, status: 'Open for Bids', priority: 'High', targetRelease: 'v0.2.0' },
    { id: 'task-b3', title: 'Automated Pull Request Proof-of-Work Evidence Auditor', repo: 'enterprise/audit-suite', budget: '$950 USDC', applicantsCount: 1, status: 'Reviewing', assignee: 'Alex Rivers', priority: 'High', targetRelease: 'v0.1.9' },
    { id: 'task-b4', title: 'Multi-Region Distributed SQLite Sync & LibSQL Replica Gate', repo: 'enterprise/storage-mesh', budget: '$3,200 USDC', applicantsCount: 0, status: 'Queued', priority: 'Standard', targetRelease: 'v0.3.0' },
  ];
}

export function getTalentPool(): TalentContributor[] {
  return [
    { id: 'dev-01', name: 'Alex Rivers', githubHandle: '@alexrivers-gig', reputation: 98.4, mergedPRs: 24, specialties: ['Next.js 16', 'React 19', 'HMAC Auth', 'TypeScript'], status: 'Assigned' },
    { id: 'dev-02', name: 'Elena Rostova', githubHandle: '@erostova-crypto', reputation: 99.1, mergedPRs: 38, specialties: ['Rust', 'ZK-SNARKs', 'Elliptic Curve Cryptography'], status: 'Top Contributor' },
    { id: 'dev-03', name: 'Marcus Chen', githubHandle: '@mchen-sys', reputation: 96.8, mergedPRs: 19, specialties: ['Distributed Systems', 'Go', 'LibSQL / SQLite'], status: 'Available' },
    { id: 'dev-04', name: 'Priya Patel', githubHandle: '@ppatel-cloud', reputation: 97.5, mergedPRs: 31, specialties: ['Security Auditing', 'CI/CD Pipelines', 'Docker / K8s'], status: 'Available' },
  ];
}

export function getRecentDisbursals(): EscrowDisbursal[] {
  return [
    { id: 'dis-882', date: '2026-09-12', recipient: 'Alex Rivers', taskTitle: 'Implement HMAC-SHA256 Session Middleware Gate', amount: '$1,500 USDC', status: 'Settled', txHash: '0x8f2a...4b19' },
    { id: 'dis-879', date: '2026-09-10', recipient: 'Elena Rostova', taskTitle: 'Circuit Verification Module for Proof Generation', amount: '$2,500 USDC', status: 'Settled', txHash: '0x4d19...3c22' },
    { id: 'dis-865', date: '2026-09-08', recipient: 'Alex Rivers', taskTitle: 'Migrate Client Auth State to Async HTTP-Only Cookies', amount: '$1,200 USDC', status: 'Settled', txHash: '0x3c7e...9a42' },
    { id: 'dis-851', date: '2026-09-02', recipient: 'Marcus Chen', taskTitle: 'High-Concurrency Database Connection Pooling Engine', amount: '$1,800 USDC', status: 'Settled', txHash: '0x9a7b...8821' },
  ];
}

export interface BusinessDashboard {
  displayName: string;
  displayEmail: string;
  githubHandle?: string | null;
  metrics: WorkspaceMetric[];
  backlogTasks: BacklogTask[];
  talentPool: TalentContributor[];
  disbursals: EscrowDisbursal[];
}

export async function getBusinessDashboard(): Promise<BusinessDashboard | null> {
  let client: SupabaseClient | null = null;
  try {
    client = await createServerClientWithCookies();
  } catch {
    client = null;
  }

  let githubHandle: string | null = null;
  let openTasks: Task[] = [];

  if (client) {
    try {
      // getUser and the task list are independent: resolve in parallel.
      const [userRes, tasks] = await Promise.all([
        client.auth.getUser(),
        getOpenTasks({}, client),
      ]);
      const user = userRes.data?.user;
      if (user) {
        githubHandle = user.user_metadata?.github_handle || user.user_metadata?.github_id || null;
      }
      openTasks = tasks;
    } catch {
      // fall through to fallback
    }
  }

  const backlogTasks: BacklogTask[] =
    openTasks.length > 0
      ? openTasks.map((t) => ({
          id: t.id,
          title: t.title,
          repo: t.technology || t.issue_url?.replace(/^https?:\/\/github\.com\//, '') || 'gig/repo',
          budget: `${t.reward_amount ?? 0} ${t.reward_currency || 'INR'}`,
          applicantsCount: 0,
          status: (t.status === 'open' ? 'Open for Bids' : 'Queued') as BacklogTask['status'],
          priority: (t.difficulty === 'hard' ? 'High' : 'Standard') as BacklogTask['priority'],
          targetRelease: 'v0.1.0',
        }))
      : [];

  const displayName = 'Enterprise Sponsor';
  const displayEmail = 'biz@gig.dev';

  return {
    displayName,
    displayEmail,
    githubHandle,
    metrics: getWorkspaceMetrics(),
    backlogTasks,
    talentPool: getTalentPool(),
    disbursals: getRecentDisbursals(),
  };
}

export interface IssuePoolIssue {
  id: string;
  title: string;
  repo: string;
  description?: string | null;
  issueUrl?: string | null;
  tags: string[];
  difficulty: string;
  technology?: string | null;
  reward: number;
  rewardCurrency: string;
  createdAt?: string | null;
  timeAgo: string;
  claimedByMe?: boolean;
  submittedByMe?: boolean;
}

export interface IssuePoolJourneyStep {
  num: number;
  title: string;
  desc: string;
}

export interface IssuePoolData {
  role: 'developer' | 'business';
  displayName: string;
  initials: string;
  company: string | null;
  issues: IssuePoolIssue[];
  openCount: number;
  claimedByMe: number;
  claimedTotal: number;
  rewardTotal: number;
  rewardCurrency: string;
  matchScore: string;
  matchLabel: string;
  matchSub: string;
  recommended: string[];
  journey: IssuePoolJourneyStep[];
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return 'recently';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return 'recently';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function initialsFrom(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function issuePoolJourneyFor(role: 'developer' | 'business'): IssuePoolJourneyStep[] {
  if (role === 'business') {
    return [
      { num: 1, title: 'Post issue', desc: 'Create a task spec with clear acceptance criteria' },
      { num: 2, title: 'Fund escrow', desc: 'Rewards stay locked in the vault until verified' },
      { num: 3, title: 'Review PRs', desc: 'Inspect pull requests and accept merged work' },
      { num: 4, title: 'Pay out', desc: 'Verified contributions disburse straight to devs' },
    ];
  }
  return [
    { num: 1, title: 'Browse', desc: 'Pick an issue that matches your skill set' },
    { num: 2, title: 'Claim', desc: 'Lock the issue for up to 48 hours' },
    { num: 3, title: 'Submit PR', desc: 'Open a pull request against the repository' },
    { num: 4, title: 'Get paid', desc: 'Verified PRs credit directly to your wallet' },
  ];
}

function buildEmptyIssuePool(
  role: 'developer' | 'business',
  userId: string,
  name?: string,
  company?: string | null,
): IssuePoolData {
  const displayName =
    name ||
    (role === 'business' ? 'Enterprise Sponsor' : 'Developer');
  return {
    role,
    displayName,
    initials: initialsFrom(displayName) || (role === 'business' ? 'CO' : 'DV'),
    company: company ?? null,
    issues: [],
    openCount: 0,
    claimedByMe: 0,
    claimedTotal: 0,
    rewardTotal: 0,
    rewardCurrency: 'INR',
    matchScore: role === 'business' ? '0%' : '82%',
    matchLabel: role === 'business' ? 'Engagement' : 'Match score',
    matchSub:
      role === 'business'
        ? 'issues claimed by developers'
        : 'how well your profile fits the pool',
    recommended: [],
    journey: issuePoolJourneyFor(role),
  };
}

export async function getIssuePoolData(
  role: 'developer' | 'business',
  userId: string,
): Promise<IssuePoolData> {
  const client: SupabaseClient | null = supabaseAdmin ?? supabase;
  if (!client || !userId) {
    return buildEmptyIssuePool(role, userId);
  }

  try {
    const profile = await getFullProfile(userId, client);
    const user = profile?.user ?? null;
    const company = user?.company ?? null;

    let repositoryIds: string[] | undefined;
    if (role === 'business') {
      if (!company) {
        return buildEmptyIssuePool(role, userId, user?.username, company);
      }
      const repos = await getRepositories({ owner: company }, client);
      repositoryIds = repos.map((r) => r.id);
      if (repositoryIds.length === 0) {
        return buildEmptyIssuePool(role, userId, user?.username, company);
      }
    }

    const joined = await getOpenTasksWithRepositories(
      role === 'business' ? { repositoryIds } : {},
      client,
    );

    const issues: IssuePoolIssue[] = joined.map(({ task, repository }) => ({
      id: task.id,
      title: task.title,
      repo: repository ? `${repository.owner}/${repository.name}` : 'gig/repo',
      description: task.description ?? null,
      issueUrl: task.issue_url ?? null,
      tags: [
        ...(task.technology ? [task.technology] : []),
        task.difficulty,
      ],
      difficulty: task.difficulty,
      technology: task.technology ?? null,
      reward: task.reward_amount ?? 0,
      rewardCurrency: task.reward_currency || 'INR',
      createdAt: task.created_at ?? null,
      timeAgo: timeAgo(task.created_at),
    }));

    const openCount = issues.length;
    const rewardTotal = issues.reduce((sum, issue) => sum + issue.reward, 0);

    let claimedByMe = 0;
    let claimedTotal = 0;
    const claimedTaskIds = new Set<string>();
    const submittedTaskIds = new Set<string>();
    if (role === 'developer') {
      // Claims and submissions are independent of each other: fetch in parallel.
      const [claims, submissions] = await Promise.all([
        getClaimsByUser(userId, client),
        getSubmissionsByUser(userId, client),
      ]);
      const active = claims.filter((c) => c.status === 'active');
      claimedByMe = active.length;
      claimedTotal = claimedByMe;
      active.forEach((c) => claimedTaskIds.add(c.task_id));
      submissions.forEach((s) => submittedTaskIds.add(s.task_id));
    } else {
      claimedTotal = await countActiveClaimsForTasks(
        joined.map((j) => j.task.id),
        client,
      );
    }

    const issuesWithClaim: IssuePoolIssue[] = issues.map((issue) =>
      role === 'developer'
        ? {
            ...issue,
            claimedByMe: claimedTaskIds.has(issue.id),
            submittedByMe: submittedTaskIds.has(issue.id),
          }
        : issue,
    );

    const contributionsCount = profile?.contributions_count ?? 0;
    const displayName =
      user?.username ||
      user?.email?.split('@')[0] ||
      (role === 'business' ? 'Enterprise Sponsor' : 'Developer');

    const recommended: string[] =
      role === 'business'
        ? Array.from(
            new Set(
              joined
                .map((j) =>
                  j.repository
                    ? `${j.repository.owner}/${j.repository.name}`
                    : '',
                )
                .filter(Boolean),
            ),
          ).slice(0, 3)
        : Array.from(
            new Set(issues.map((i) => i.technology).filter(Boolean) as string[]),
          ).slice(0, 3);

    const matchScore =
      role === 'business'
        ? `${openCount > 0 ? Math.round((claimedTotal / openCount) * 100) : 0}%`
        : `${Math.min(96, 80 + claimedByMe * 4 + contributionsCount * 2)}%`;

    return {
      role,
      displayName,
      initials: initialsFrom(displayName) || (role === 'business' ? 'CO' : 'DV'),
      company,
      issues: issuesWithClaim,
      openCount,
      claimedByMe,
      claimedTotal,
      rewardTotal,
      rewardCurrency: issues[0]?.rewardCurrency ?? 'INR',
      matchScore,
      matchLabel: role === 'business' ? 'Engagement' : 'Match score',
      matchSub:
        role === 'business'
          ? 'of your issues claimed by devs'
          : 'how well your profile fits the pool',
      recommended,
      journey: issuePoolJourneyFor(role),
    };
  } catch {
    return buildEmptyIssuePool(role, userId);
  }
}

export async function getBusinessReviews(userId?: string): Promise<SubmissionReview[]> {
  if (!userId) return [];
  const client: SupabaseClient | null = supabaseAdmin ?? supabase;
  if (!client) return [];
  const profile = await getFullProfile(userId, client);
  const company = profile?.user?.company ?? null;
  if (!company) return [];
  return getPendingSubmissionsForCompany(company, client);
}
