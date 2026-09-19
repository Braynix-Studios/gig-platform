import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseServerClient, isSupabaseConfigured, type SupabaseCookieMethods } from './lib/supabaseClient';

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const cookieMethods: SupabaseCookieMethods = {
    getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
    },
  };

  const supabase = createSupabaseServerClient(cookieMethods);

  const { data: { session } } = await supabase.auth.getSession();

  // BUG-006 FIX: Protect /dashboard routes at the edge proxy layer
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth', request.url));
    }
  }

  return response;
}

export const config = {
  // Only dashboard routes need the session check. Marketing, auth, api,
  // and static assets skip middleware entirely (no edge overhead).
  // Dashboard server layouts re-verify the session, so coverage is retained.
  matcher: [
    '/dashboard/:path*',
  ],
};
