export type DashboardRole = 'developer' | 'business';

export interface DashboardStats {
  walletLabel?: string;
  walletValue?: string;
  walletSubtext?: string;
  walletHref?: string;
  reputationScore?: number;
  reputationValue?: string;
  reputationBadge?: string;
  tasksCount?: number;
  prsCount?: number;
  walletBalance?: string;
  lockedBalance?: string;
  counts?: Record<string, string>;
}

export interface SidebarStats {
  walletLabel?: string;
  walletValue?: string;
  walletSubtext?: string;
  walletHref?: string;
  reputationScore?: number;
  reputationValue?: string;
  reputationBadge?: string;
  tasksCount?: number;
  prsCount?: number;
  walletBalance?: string;
  lockedBalance?: string;
  counts?: Record<string, string>;
}

const DEV_FALLBACK_NAME = 'Alex Rivers';
const BIZ_FALLBACK_NAME = 'Enterprise Sponsor';
const DEV_FALLBACK_EMAIL = 'dev@gig.dev';
const BIZ_FALLBACK_EMAIL = 'biz@gig.dev';

function isUsableEmail(email: unknown): email is string {
  return (
    typeof email === 'string' &&
    email.trim().length > 0 &&
    email.trim().toLowerCase() !== 'pass'
  );
}

export function normalizeDisplayName(
  session: Pick<{ name?: string | null; role?: DashboardRole | null }, 'name' | 'role'> | null | undefined,
  roleFallback?: DashboardRole,
): string {
  const name = session?.name?.trim();
  if (name) return name;
  const role = session?.role ?? roleFallback;
  return role === 'business' ? BIZ_FALLBACK_NAME : DEV_FALLBACK_NAME;
}

export function normalizeEmail(
  session: Pick<{ email?: string | null; role?: DashboardRole | null }, 'email' | 'role'> | null | undefined,
  roleFallback?: DashboardRole,
): string {
  if (session && isUsableEmail(session.email)) return session.email.trim();
  const role = session?.role ?? roleFallback;
  return role === 'business' ? BIZ_FALLBACK_EMAIL : DEV_FALLBACK_EMAIL;
}

export function normalizeHandle(
  session: Pick<{ email?: string | null; name?: string | null; role?: DashboardRole | null }, 'email' | 'name' | 'role'> | null | undefined,
): string {
  if (session && isUsableEmail(session.email)) return session.email.trim();
  return normalizeDisplayName(session);
}

function getDeveloperStatsFallback() {
  return {
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
}

export function getSidebarStatsSync(role: DashboardRole): SidebarStats {
  if (role === 'business') {
    return {
      walletLabel: 'Escrow Vault',
      walletValue: '$32,500.00',
      walletSubtext: '$14,200 locked in bounties',
      walletHref: '/dashboard/business?tab=billing',
      counts: { 'Tasks Backlog': '8', 'Talent Pool': '42' },
    };
  }
  const dev = getDeveloperStatsFallback();
  return {
    walletLabel: 'GIG Wallet',
    walletValue: '\u20b94,850.00',
    walletSubtext: 'Above \u20b9500 UPI threshold',
    walletHref: '/dashboard/developer?tab=wallet',
    reputationValue: dev.reputationScore,
    reputationBadge: dev.reputationBadge,
    counts: { Tasks: dev.lockedTasks, 'Verified PRs': dev.verifiedContributions },
  };
}
