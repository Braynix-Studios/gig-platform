import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/auth');
  }

  if (session.role === 'developer') {
    redirect('/dashboard/developer');
  }

  if (session.role === 'business') {
    redirect('/dashboard/business');
  }

  redirect('/auth');
}
