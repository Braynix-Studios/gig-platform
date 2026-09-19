import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createToken,
  verifyToken,
  isLegacySessionEnabled,
  getSecret,
  type SessionPayload,
} from '../lib/session-token';

const TEST_SECRET = 'unit-test-secret-0123456789';
const DEFAULT_SECRET = 'gig-dev-default-secret-key-replace-in-prod-32chars';

const basePayload = {
  userId: 'dev-user-01',
  email: 'dev@gig.dev',
  role: 'developer' as const,
  name: 'Alex Rivers',
};

function payload(expiresInMs = 3_600_000): SessionPayload {
  return { ...basePayload, expiresAt: Date.now() + expiresInMs };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('SESSION_SECRET', TEST_SECRET);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('ENABLE_LEGACY_SESSION', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createToken / verifyToken', () => {
  it('signs and verifies a token round-trips the payload', () => {
    const p = payload();
    const token = createToken(p);
    const result = verifyToken(token);
    expect(result).toEqual(p);
  });

  it('rejects a token with tampered data', () => {
    const token = createToken(payload());
    const [, signature] = token.split('.');
    const tampered = `${Buffer.from(JSON.stringify({ ...payload(), name: 'Hacker' })).toString('base64url')}.${signature}`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects a token with a tampered signature', () => {
    const token = createToken(payload());
    expect(verifyToken(`${token.slice(0, -2)}zz`)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = createToken(payload(-60_000));
    expect(verifyToken(token)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifyToken('')).toBeNull();
    expect(verifyToken('no-dot-here')).toBeNull();
    expect(verifyToken('a.b.c')).toBeNull();
    expect(verifyToken('notbase64!.notbase64!')).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const token = createToken(payload());
    vi.stubEnv('SESSION_SECRET', 'a-completely-different-secret');
    expect(verifyToken(token)).toBeNull();
  });
});

describe('getSecret', () => {
  it('returns the configured secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'strong-prod-secret');
    expect(getSecret()).toBe('strong-prod-secret');
  });

  it('throws in production when the secret is the default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', DEFAULT_SECRET);
    expect(() => getSecret()).toThrow(/SESSION_SECRET/);
  });

  it('throws in production when the secret is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', '');
    expect(() => getSecret()).toThrow(/SESSION_SECRET/);
  });

  it('falls back to the default secret in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('SESSION_SECRET', '');
    expect(getSecret()).toBe(DEFAULT_SECRET);
  });
});

describe('isLegacySessionEnabled', () => {
  it('is enabled only with the flag outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ENABLE_LEGACY_SESSION', 'true');
    expect(isLegacySessionEnabled()).toBe(true);
  });

  it('is disabled without the flag', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isLegacySessionEnabled()).toBe(false);
  });

  it('is hard-disabled in production even when the flag is set', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ENABLE_LEGACY_SESSION', 'true');
    expect(isLegacySessionEnabled()).toBe(false);
  });

  it('is hard-disabled in production without the flag', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isLegacySessionEnabled()).toBe(false);
  });
});