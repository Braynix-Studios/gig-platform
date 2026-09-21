import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient, isSupabaseConfigured, supabaseAdmin, type SupabaseCookieMethods } from '@/lib/supabaseClient';
import { createSession as createSupabaseSession } from '@/lib/supabaseAuth';
import {
  upsertUser,
  syncGithubProfile,
  getUserByGithubId,
  getUserByEmail,
  cleanGithubHandle,
} from '@/lib/db-operations';

function getCookieMethods(cookieStore: Awaited<ReturnType<typeof cookies>>): SupabaseCookieMethods {
  return {
    getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (cookiesToSet) => {
      cookiesToSet.forEach(({ name, value, options }) => {
        cookieStore.set(name, value, options);
      });
    },
  };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const oauthError = request.nextUrl.searchParams.get('error');

  let success = false;
  let finalRole = 'developer';
  let errorCode: string | null = oauthError
    ? oauthError === 'access_denied'
      ? 'access_denied'
      : 'oauth_failed'
    : null;

  if (!errorCode && isSupabaseConfigured && code) {
    try {
      const cookieStore = await cookies();
      const cookieMethods = getCookieMethods(cookieStore);
      const supabase = createSupabaseServerClient(cookieMethods);

      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.session) {
        const session = data.session;

        // Persist the Supabase session in SSR cookies.
        await createSupabaseSession(session);

        // DB writes below run as the service role: the `authenticated` role
        // cannot write `role`/`github_id`/`email`/`company` (migrations
        // 0002/0003/0005), and the identity here is already verified via
        // the code exchange. Falls back to the user-scoped client if no
        // service key is configured.
        const dbClient = supabaseAdmin ?? supabase;

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!userError && user) {
          const githubIdentity =
            user.identities?.find((id) => id.provider === 'github') || user.identities?.[0];
          const rawGithubId =
            githubIdentity?.identity_data?.sub ||
            githubIdentity?.id ||
            user.user_metadata?.github_id ||
            user.user_metadata?.provider_id ||
            null;
          const githubId = rawGithubId ? String(rawGithubId) : null;

          const rawHandle =
            githubIdentity?.identity_data?.user_name ||
            githubIdentity?.identity_data?.preferred_username ||
            githubIdentity?.identity_data?.login ||
            user.user_metadata?.user_name ||
            user.user_metadata?.preferred_username ||
            user.user_metadata?.github_handle ||
            null;

          const githubHandle = cleanGithubHandle(rawHandle);

          // Resolve role: prefer an existing profile row (so an established business user who
          // connects GitHub keeps their role). Any new OAuth user strictly defaults to 'developer'.
          // Business roles require trusted onboarding/membership, not self-asserted OAuth metadata.
          let role = 'developer';
          const existingByGithub = githubId
            ? await getUserByGithubId(githubId, dbClient)
            : null;
          const existingProfile =
            existingByGithub ??
            (user.email ? await getUserByEmail(user.email, dbClient) : null);
          if (existingProfile?.role) {
            role = existingProfile.role;
          }
          finalRole = role;

          // Server-side upsert (service role): links github_id, github_handle, and assigns
          // the resolved role, which user-scoped clients cannot write.
          const profile = await upsertUser(
            {
              id: user.id,
              github_id: githubId,
              github_handle: githubHandle,
              username: user.user_metadata?.full_name || githubHandle || user.email?.split('@')[0] || 'Developer',
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url || null,
              role,
            },
            dbClient,
          );

          if (profile) {
            // Fetch authoritative GitHub profile data (avatar URL, bio, stats) and store it locally
            await syncGithubProfile(
              user.id,
              session.provider_token,
              githubId,
              githubHandle,
              dbClient,
            ).catch((syncErr) => {
              console.error('[GitHub OAuth Callback] Profile sync failed', syncErr);
            });

            success = true;
          } else {
            errorCode = 'profile_upsert_failed';
          }
        } else {
          errorCode = 'session_missing';
        }
      } else if (error) {
        errorCode = 'github_exchange_failed';
      }
    } catch (err) {
      console.error('[GitHub OAuth Callback]', err);
      errorCode = 'oauth_failed';
    }
  } else if (!errorCode) {
    errorCode = isSupabaseConfigured ? 'missing_authorization_code' : 'supabase_not_configured';
  }

  if (errorCode) {
    console.error('[GitHub OAuth Callback]', errorCode);
  }

  redirect(
    success
      ? finalRole === 'business'
        ? '/dashboard/business'
        : '/dashboard/developer'
      : `/auth?error=${encodeURIComponent(errorCode ?? 'oauth_failed')}`,
  );
}