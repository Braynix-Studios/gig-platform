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

const DEV_FALLBACK_NAME = 'Developer';
const BIZ_FALLBACK_NAME = 'Business Sponsor';
const DEV_FALLBACK_EMAIL = '';
const BIZ_FALLBACK_EMAIL = '';

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
    reputationScore: '0',
    reputationBadge: 'NEW',
    reputationFooter: 'Reputation score based on verified PR contributions',
    verifiedContributions: '0',
    contributionsFooter: 'Verified open-source contributions',
    lockedTasks: '0',
    lockedFooter: 'Locked escrow',
    walletBalance: '\u20b90',
    walletFooter: 'Ready for UPI bank withdrawal (Min \u20b9500)',
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
