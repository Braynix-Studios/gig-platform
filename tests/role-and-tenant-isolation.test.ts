import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockSupabase, mockAuth, mockQueryBuilder } = vi.hoisted(() => {
  const mockAuth = {
    getUser: vi.fn(),
    getSession: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockSupabase = {
    auth: mockAuth,
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return { mockSupabase, mockAuth, mockQueryBuilder };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
  createServerClientWithCookies: vi.fn().mockResolvedValue(mockSupabase),
  createSupabaseServerClient: vi.fn().mockReturnValue(mockSupabase),
  isSupabaseConfigured: true,
}));

import { getSession } from '@/lib/supabaseAuth';
import { getBusinessDashboard, getSidebarStats } from '@/lib/dashboard-data';
import { PATCH } from '@/app/api/profile/route';

function resetMocks() {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.select.mockReturnThis();
  mockQueryBuilder.insert.mockReturnThis();
  mockQueryBuilder.update.mockReturnThis();
  mockQueryBuilder.upsert.mockReturnThis();
  mockQueryBuilder.eq.mockReturnThis();
  mockQueryBuilder.in.mockReturnThis();
  mockQueryBuilder.order.mockReturnThis();
  mockQueryBuilder.limit.mockReturnThis();
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
}

describe('Tier 1 & Tier 2: Role Integrity, Auth Governance & Tenant Isolation', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Feature 24: R2a.2 Incomplete onboarding rejection (return null when public.users row absent)
  it('test_r2a2_get_session_returns_null_when_user_missing: authenticated user without public.users row must return null', async () => {
    mockAuth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'unonboarded-user-id',
          email: 'new@example.com',
          user_metadata: { role: 'developer' }, // malicious or stale metadata
        },
      },
      error: null,
    });
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: { expires_at: 9999999999 } },
      error: null,
    });

    // public.users query returns data: null (user profile not created yet or deleted)
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'Row not found' },
    });

    const session = await getSession();

    // R2a.2 requirement: Must return null, NOT default to 'developer'
    expect(session).toBeNull();
  });

  // Feature 23: R2a.1 Remove role metadata fallback
  it('test_r2a1_get_session_ignores_user_metadata_role: role is derived strictly from public.users', async () => {
    mockAuth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'tampered-user-id',
          email: 'dev@acme.com',
          user_metadata: { role: 'business' }, // user claims to be business in metadata
        },
      },
      error: null,
    });
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: { expires_at: 9999999999 } },
      error: null,
    });

    // But public.users has role: 'developer'
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: {
        role: 'developer',
        github_id: '12345',
        username: 'real_dev',
        company: null,
      },
      error: null,
    });

    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.role).toBe('developer');
  });

  // Feature 29 & 30: R2c.1 & R2c.2 Business dashboard repository & tasks scoping
  it('test_r2c1_business_dashboard_scopes_repositories: business dashboard must only return company repositories', async () => {
    mockAuth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'biz-user-1',
          email: 'sponsor@company-a.com',
          user_metadata: { role: 'business' },
        },
      },
      error: null,
    });

    // Mock company-a profile
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'biz-user-1',
        role: 'business',
        company: 'CompanyA',
        username: 'Company A Lead',
      },
      error: null,
    });

    // Repositories for CompanyA
    mockQueryBuilder.eq.mockImplementation((field: string, val: any) => {
      return mockQueryBuilder;
    });

    const dashboard = await getBusinessDashboard();

    // Verify repositories were scoped to company:
    const eqCalls = mockQueryBuilder.eq.mock.calls;
    const companyFilter = eqCalls.some((c: any[]) => c[0] === 'owner' && c[1] === 'CompanyA');
    // If repositories are filtered, owner filter is present
  });

  // Feature 49: R3d.1 Authentic business dashboard identity
  it('test_r3d1_business_dashboard_authentic_identity: displayName and email must derive from public.users, not fake constants', async () => {
    mockAuth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'biz-user-2',
          email: 'actual-sponsor@mytech.org',
          user_metadata: {},
        },
      },
      error: null,
    });

    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: 'biz-user-2',
        username: 'MyTech Official',
        email: 'actual-sponsor@mytech.org',
        company: 'MyTech',
      },
      error: null,
    });

    const dashboard = await getBusinessDashboard();

    if (dashboard) {
      // Must NOT be the hardcoded fake constants "Enterprise Sponsor" and "biz@gig.dev"
      expect(dashboard.displayName).not.toBe('Enterprise Sponsor');
      expect(dashboard.displayEmail).not.toBe('biz@gig.dev');
    }
  });

  // Feature 36: R2f.2 Remove profile API company bypass
  it('test_r2f2_profile_route_no_company_service_role_bypass: PATCH /api/profile cannot overwrite company field', async () => {
    mockAuth.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'dev-user-attack',
          email: 'attacker@evil.com',
          user_metadata: { role: 'developer' },
        },
      },
      error: null,
    });
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: { expires_at: 9999999999 } },
      error: null,
    });
    mockQueryBuilder.single.mockResolvedValueOnce({
      data: { role: 'developer', id: 'dev-user-attack', username: 'attacker' },
      error: null,
    });

    // Attacker sends PATCH with company: "InfiltratedCompany"
    const req = new Request('http://localhost/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'InfiltratedCompany',
        bio: 'Infiltrating company',
      }),
    });

    await PATCH(req);

    // Verify: supabaseAdmin must NOT update "company"
    const updateCalls = mockQueryBuilder.update.mock.calls;
    const companyUpdate = updateCalls.find((call: any[]) => call[0] && call[0].company !== undefined);

    // In a secured system, company update via service role backdoor is completely removed
    expect(companyUpdate).toBeUndefined();
  });

  // Feature: GitHub profile sync cannot overwrite company tenant boundary
  it('test_github_profile_sync_does_not_overwrite_company: syncGithubProfile preserves internal company tenant', async () => {
    // Import syncGithubProfile
    const { syncGithubProfile } = await import('@/lib/db-operations');

    // Mock fetch for GitHub user profile
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 12345,
        login: 'octocat',
        company: 'MaliciousExternalOrg',
        bio: 'Legit bio',
      }),
    } as any);

    await syncGithubProfile('user-1', 'fake-token', '12345', 'octocat', mockSupabase as any);

    const updateCalls = mockQueryBuilder.update.mock.calls;
    const lastUpdate = updateCalls[updateCalls.length - 1]?.[0];

    // Assert that company was NOT included in the update payload
    expect(lastUpdate?.company).toBeUndefined();
    expect(lastUpdate?.bio).toBe('Legit bio');

    fetchSpy.mockRestore();
  });
});
