import crypto from 'node:crypto';

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'developer' | 'business';
  name: string;
  githubId?: string;
  expiresAt: number;
}

const DEFAULT_SECRET = 'gig-dev-default-secret-key-replace-in-prod-32chars';

// Legacy HMAC demo sessions are short-lived tokens used for the local demo
// login (dev@gig.dev / biz@gig.dev). They are off by default and NEVER honored
// in production, no matter what the environment variable says.
export function isLegacySessionEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.ENABLE_LEGACY_SESSION === 'true'
  );
}

export function getSecret(): string {
  const secret = process.env.SESSION_SECRET || DEFAULT_SECRET;
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_SECRET) {
    throw new Error(
      'SESSION_SECRET must be set to a strong, non-default value in production',
    );
  }
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function createToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(data);
  return `${data}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expectedSig = sign(data);
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSig);
    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }
    const payload: SessionPayload = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8'),
    );
    if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}