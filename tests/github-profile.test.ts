import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanGithubHandle, syncGithubProfile, upsertUser } from '../lib/db-operations';

describe('cleanGithubHandle', () => {
  it('returns null for null, undefined, or empty string', () => {
    expect(cleanGithubHandle(null)).toBeNull();
    expect(cleanGithubHandle(undefined)).toBeNull();
    expect(cleanGithubHandle('')).toBeNull();
    expect(cleanGithubHandle('   ')).toBeNull();
  });

  it('rejects purely numeric IDs (prevents numeric github_id from leaking as handle)', () => {
    expect(cleanGithubHandle('123456')).toBeNull();
    expect(cleanGithubHandle('987654321')).toBeNull();
    expect(cleanGithubHandle('@123456')).toBeNull();
    expect(cleanGithubHandle('  123456  ')).toBeNull();
  });

  it('rejects dummy fallback values like "user", "none", "null", "undefined"', () => {
    expect(cleanGithubHandle('user')).toBeNull();
    expect(cleanGithubHandle('@user')).toBeNull();
    expect(cleanGithubHandle('USER')).toBeNull();
    expect(cleanGithubHandle('none')).toBeNull();
    expect(cleanGithubHandle('None')).toBeNull();
    expect(cleanGithubHandle('null')).toBeNull();
    expect(cleanGithubHandle('undefined')).toBeNull();
  });

  it('rejects invalid GitHub handles such as emails, invalid symbols, or bad hyphens', () => {
    expect(cleanGithubHandle('alex.rivers@gig.dev')).toBeNull();
    expect(cleanGithubHandle('john@gmail.com')).toBeNull();
    expect(cleanGithubHandle('-leadinghyphen')).toBeNull();
    expect(cleanGithubHandle('trailinghyphen-')).toBeNull();
    expect(cleanGithubHandle('double--hyphen')).toBeNull();
    expect(cleanGithubHandle('has space')).toBeNull();
    expect(cleanGithubHandle('user!name')).toBeNull();
  });

  it('accepts valid GitHub handles and trims leading @', () => {
    expect(cleanGithubHandle('torvalds')).toBe('torvalds');
    expect(cleanGithubHandle('@torvalds')).toBe('torvalds');
    expect(cleanGithubHandle('octocat')).toBe('octocat');
    expect(cleanGithubHandle('@octocat')).toBe('octocat');
    expect(cleanGithubHandle('acme-corp')).toBe('acme-corp');
    expect(cleanGithubHandle('@acme-corp')).toBe('acme-corp');
    expect(cleanGithubHandle('pranjal2410719')).toBe('pranjal2410719');
    expect(cleanGithubHandle('a-b-c-d')).toBe('a-b-c-d');
  });
});

describe('syncGithubProfile', () => {
  const fakeUserId = 'usr-test-123';
  let mockClient: any;
  let updatePayloadCapture: any = null;

  beforeEach(() => {
    updatePayloadCapture = null;
    mockClient = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockImplementation((payload) => {
          updatePayloadCapture = payload;
          return {
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: fakeUserId, ...payload },
                  error: null,
                }),
              }),
            }),
          };
        }),
        upsert: vi.fn().mockImplementation((payload) => {
          updatePayloadCapture = payload;
          return {
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...payload },
                error: null,
              }),
            }),
          };
        }),
      }),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches authenticated profile from https://api.github.com/user when providerToken is valid', async () => {
    const mockGithubUser = {
      login: 'octocat',
      id: 583231,
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      name: 'The Octocat',
      company: '@github',
      bio: 'Open source mascot',
      location: 'San Francisco',
      followers: 12000,
      public_repos: 8,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockGithubUser,
    } as any);

    const result = await syncGithubProfile(
      fakeUserId,
      'fake-provider-token',
      '583231',
      'octocat',
      mockClient,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/user',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-provider-token',
        }),
      }),
    );

    expect(result).not.toBeNull();
    expect(updatePayloadCapture).toMatchObject({
      github_id: '583231',
      github_handle: 'octocat',
      username: 'The Octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      bio: 'Open source mascot',
      location: 'San Francisco',
      followers_count: 12000,
      public_repos_count: 8,
    });
    // Invariant: External GitHub profile sync must NOT overwrite internal company tenant boundary
    expect(updatePayloadCapture.company).toBeUndefined();
  });

  it('falls back to public endpoint https://api.github.com/users/:handle when providerToken is absent', async () => {
    const mockPublicUser = {
      login: 'torvalds',
      id: 1024025,
      avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
      name: 'Linus Torvalds',
      company: 'Linux Foundation',
      bio: 'Linux and Git creator',
      location: 'Portland, OR',
      followers: 220000,
      public_repos: 6,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockPublicUser,
    } as any);

    const result = await syncGithubProfile(
      fakeUserId,
      null, // No provider token
      null,
      'torvalds',
      mockClient,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.github.com/users/torvalds',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'gig-alpha',
        }),
      }),
    );

    expect(result).not.toBeNull();
    expect(updatePayloadCapture).toMatchObject({
      github_id: '1024025',
      github_handle: 'torvalds',
      username: 'Linus Torvalds',
      avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
      followers_count: 220000,
      public_repos_count: 6,
    });
  });
});

describe('upsertUser', () => {
  it('sanitizes github_handle during upsert and passes through bio, company, avatar_url', async () => {
    let capturedPayload: any = null;
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((payload) => {
          capturedPayload = payload;
          return {
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: payload,
                error: null,
              }),
            }),
          };
        }),
      }),
    };

    await upsertUser(
      {
        id: 'user-xyz',
        github_handle: '@valid-user',
        username: 'Valid User',
        email: 'user@gig.dev',
        avatar_url: 'https://avatars.githubusercontent.com/u/1234?v=4',
        bio: 'Fullstack developer',
        company: 'Acme',
        location: 'Bengaluru',
        followers_count: 42,
        public_repos_count: 10,
      },
      mockClient as any,
    );

    expect(capturedPayload).toMatchObject({
      id: 'user-xyz',
      github_handle: 'valid-user', // leading @ stripped
      username: 'Valid User',
      email: 'user@gig.dev',
      avatar_url: 'https://avatars.githubusercontent.com/u/1234?v=4',
      bio: 'Fullstack developer',
      company: 'Acme',
      location: 'Bengaluru',
      followers_count: 42,
      public_repos_count: 10,
    });
  });

  it('filters out numeric IDs passed as github_handle during upsert', async () => {
    let capturedPayload: any = null;
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockImplementation((payload) => {
          capturedPayload = payload;
          return {
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: payload,
                error: null,
              }),
            }),
          };
        }),
      }),
    };

    await upsertUser(
      {
        id: 'user-123',
        github_handle: '987654321', // numeric ID passed accidentally
        username: 'Dev',
      },
      mockClient as any,
    );

    expect(capturedPayload.github_handle).toBeNull();
  });
});
