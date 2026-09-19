import { createClient } from '@supabase/supabase-js';
import { createServerClient, createBrowserClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';

const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /^replace-me$/i,
  /^changeme$/i,
  /^\s*$/,
];

function isConfigured(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
  );
}

function readEnv(primary: string | undefined, fallback: string | undefined): string | undefined {
  return isConfigured(primary) ? primary : isConfigured(fallback) ? fallback : undefined;
}

export const SUPABASE_URL = readEnv(process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = readEnv(
  process.env.SUPABASE_ANON_KEY,
  readEnv(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
);
export const SUPABASE_SERVICE_ROLE_KEY = readEnv(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
export const SUPABASE_COOKIE_NAME = process.env.SUPABASE_COOKIE_NAME || 'gig_supabase_auth_token';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!) : null;

export const supabaseAdmin =
  SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

export interface SupabaseCookieMethods {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: { name: string; value: string; options: CookieOptions }[]) => void;
}

const secureCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
};

export function createSupabaseServerClient(cookieMethods: SupabaseCookieMethods) {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: cookieMethods,
    cookieOptions: {
      name: SUPABASE_COOKIE_NAME,
      ...secureCookieOptions,
    },
  });
}

export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: {
      flowType: 'pkce',
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
    cookieOptions: {
      name: SUPABASE_COOKIE_NAME,
      ...secureCookieOptions,
    },
  });
}

export async function createServerClientWithCookies() {
  if (!isSupabaseConfigured) {
    return null;
  }
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const cookieMethods: SupabaseCookieMethods = {
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  };
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: cookieMethods,
    cookieOptions: {
      name: SUPABASE_COOKIE_NAME,
      ...secureCookieOptions,
    },
  });
}
