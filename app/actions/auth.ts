'use server';

import { redirect } from 'next/navigation';
import {
  createSession,
  createSessionWithSupabase,
  deleteSession,
  isLegacySessionEnabled,
  signInWithEmailPassword,
} from '@/lib/session';

export type AuthFormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  errors?: Record<string, string[]>;
};

const invalidCredentialsMessage = 'Invalid credentials. Please verify your email and password.';
const supabaseNotConfiguredMessage = 'Supabase is not configured';

type Role = 'developer' | 'business';

function getLegacySession(email: string, password: string, role: Role) {
  const devEmail = process.env.TEST_DEV_EMAIL || 'dev@gig.dev';
  const devPassword = process.env.TEST_DEV_PASSWORD || 'password123';
  const bizEmail = process.env.TEST_BIZ_EMAIL || 'biz@gig.dev';
  const bizPassword = process.env.TEST_BIZ_PASSWORD || 'password123';

  if (role === 'business') {
    if (email.toLowerCase() !== bizEmail.toLowerCase() || password !== bizPassword) {
      return null;
    }

    return {
      userId: 'biz-user-01',
      email,
      role,
      name: 'Enterprise Sponsor',
    };
  }

  if (email.toLowerCase() !== devEmail.toLowerCase() || password !== devPassword) {
    return null;
  }

  return {
    userId: 'dev-user-01',
    email,
    role,
    name: 'Alex Rivers',
  };
}

async function createLegacySessionAndRedirect(
  email: string,
  password: string,
  role: Role,
  targetDashboard: string
): Promise<AuthFormState> {
  const session = getLegacySession(email, password, role);

  if (!session) {
    return {
      status: 'error',
      message: invalidCredentialsMessage,
    };
  }

  await createSession(session);
  redirect(targetDashboard);
}

export async function loginAction(
  prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = (formData.get('email') as string)?.trim();
  const password = formData.get('password') as string;
  const rawRole = (formData.get('role') as string)?.trim() || 'developer';
  const role: Role = rawRole === 'business' ? 'business' : 'developer';
  const targetDashboard = role === 'business' ? '/dashboard/business' : '/dashboard/developer';

  if (!email || !password) {
    return {
      status: 'error',
      message: 'Please provide both email and password.',
    };
  }

  let signInResult;

  try {
    signInResult = await signInWithEmailPassword(email, password);
  } catch (error) {
    signInResult = { session: null, error: error instanceof Error ? error : new Error('Unknown error') };
  }

  if (signInResult.error) {
    // Dev-only demo fallback: only when legacy sessions are explicitly enabled
    // AND Supabase is not configured at all. Real credential failures never
    // fall back to the demo accounts.
    if (
      isLegacySessionEnabled() &&
      signInResult.error.message === supabaseNotConfiguredMessage
    ) {
      return createLegacySessionAndRedirect(email, password, role, targetDashboard);
    }

    return {
      status: 'error',
      message: invalidCredentialsMessage,
    };
  }

  if (!signInResult.session) {
    return {
      status: 'error',
      message: invalidCredentialsMessage,
    };
  }

  await createSessionWithSupabase(signInResult.session);

  // BUG-005 FIX: Derive redirect path from actual authenticated DB role, not client form data
  const { getSession } = await import('@/lib/session');
  const session = await getSession();
  const dbRole = session?.role || 'developer';
  const finalDashboard = dbRole === 'business' ? '/dashboard/business' : '/dashboard/developer';

  redirect(finalDashboard);
}

export async function logoutAction(): Promise<void> {
  await deleteSession();
  redirect('/auth');
}
