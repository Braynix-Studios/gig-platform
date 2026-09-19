import { cookies } from 'next/headers';
import {
  createToken,
  verifyToken,
  isLegacySessionEnabled,
  type SessionPayload,
} from './session-token';
import {
  createSession as createSupabaseSession,
  deleteSession as deleteSupabaseSession,
  getSession as getSupabaseSession,
  signInWithEmailPassword,
  signInWithGitHub,
  signOut,
} from './supabaseAuth';
import { isSupabaseConfigured } from './supabaseClient';

export type { SessionPayload };

export { isLegacySessionEnabled };

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'gig_session';

export async function createSession(
  payload: Omit<SessionPayload, 'expiresAt'>,
  supabaseSession?: { access_token: string; refresh_token: string; expires_at?: number }
): Promise<string> {
  if (isSupabaseConfigured && supabaseSession) {
    await createSupabaseSession(supabaseSession);
    return '';
  }
  if (!isLegacySessionEnabled()) {
    throw new Error('Legacy session creation is disabled (set ENABLE_LEGACY_SESSION=true outside production)');
  }
  const maxAge = 7 * 24 * 60 * 60;
  const expiresAt = Date.now() + maxAge * 1000;
  const token = createToken({ ...payload, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
    expires: new Date(expiresAt),
  });
  return token;
}

export async function getSession(): Promise<SessionPayload | null> {
  if (isSupabaseConfigured) {
    const supabaseSession = await getSupabaseSession();
    if (supabaseSession) return supabaseSession;
  }
  // The legacy HMAC cookie is only honored outside production when explicitly enabled.
  if (!isLegacySessionEnabled()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  if (isSupabaseConfigured) {
    await deleteSupabaseSession();
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export {
  createSupabaseSession as createSessionWithSupabase,
  deleteSupabaseSession as deleteSessionWithSupabase,
  getSupabaseSession as getSessionWithSupabase,
  signInWithEmailPassword,
  signInWithGitHub,
  signOut,
};