import { supabaseAdmin } from '@/lib/supabaseClient';

async function seed() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not initialized');
  }

  console.log('Starting seed...');

  type SeedUser = {
    email: string;
    password: string;
    github_id: string;
    username: string;
    avatar_url: string;
    role: 'developer' | 'business';
    company?: string;
  };

  const usersData: SeedUser[] = [
    {
      email: 'dev@gig.dev',
      password: process.env.TEST_DEV_PASSWORD || 'password123',
      github_id: '123456',
      username: 'developer',
      avatar_url: 'https://github.com/developer.png',
      role: 'developer' as const,
    },
    {
      email: 'biz@gig.dev',
      password: process.env.TEST_BIZ_PASSWORD || 'password123',
      github_id: '789012',
      username: 'business',
      avatar_url: 'https://github.com/business.png',
      role: 'business' as const,
      company: 'org-alpha',
    },
  ];

  const authUserIds: string[] = [];

  for (const u of usersData) {
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingAuth.users.find((usr) => usr.email === u.email);

    let authUserId: string;
    if (existing) {
      authUserId = existing.id;
      console.log(`Auth user already exists: ${u.email} (${authUserId})`);
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { role: u.role },
      });
      if (error) throw error;
      authUserId = created.user.id;
      console.log(`Created auth user: ${u.email} (${authUserId})`);
    }
    authUserIds.push(authUserId);

    // Back-patch user_metadata.role so existing auth users are routed by their
    // intended role (lib/supabaseAuth.ts reads the role from user_metadata).
    const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      user_metadata: { role: u.role },
    });
    if (metaError) throw metaError;
    console.log(`Ensured auth role for ${u.email}: ${u.role}`);

    const { error: upsertError } = await supabaseAdmin.from('users').upsert({
      id: authUserId,
      github_id: u.github_id,
      username: u.username,
      email: u.email,
      avatar_url: u.avatar_url,
      role: u.role,
      ...(u.company ? { company: u.company } : {}),
    }, { onConflict: 'id' });
    if (upsertError) throw upsertError;
    console.log(`Upserted public.users row for ${u.username}`);
  }

  const [devUserId, bizUserId] = authUserIds;

  const reposData = [
    { github_repo_id: 'repo_001', name: 'repo-alpha', owner: 'org-alpha', url: 'https://github.com/org-alpha/repo-alpha', description: 'Alpha repository', opted_in: true },
    { github_repo_id: 'repo_002', name: 'repo-beta', owner: 'org-beta', url: 'https://github.com/org-beta/repo-beta', description: 'Beta repository', opted_in: true },
    { github_repo_id: 'repo_003', name: 'repo-gamma', owner: 'org-gamma', url: 'https://github.com/org-gamma/repo-gamma', description: 'Gamma repository', opted_in: false },
  ];

  const repoIds: string[] = [];
  for (const r of reposData) {
    const { data: existing } = await supabaseAdmin.from('repositories').select('id').eq('github_repo_id', r.github_repo_id).single();
    if (existing) {
      repoIds.push(existing.id);
      console.log(`Repository already exists: ${r.name} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('repositories').insert(r).select('id').single();
      if (error) throw error;
      repoIds.push(inserted.id);
      console.log(`Created repository: ${r.name} (${inserted.id})`);
    }
  }

  const tasksData = [
    { repository_id: repoIds[0], title: 'Fix login bug', description: 'Login fails on mobile', issue_url: 'https://github.com/org-alpha/repo-alpha/issues/1', difficulty: 'easy', technology: 'React', status: 'open', reward_amount: 500, reward_currency: 'INR' },
    { repository_id: repoIds[0], title: 'Add dark mode', description: 'Implement dark theme', issue_url: 'https://github.com/org-alpha/repo-alpha/issues/2', difficulty: 'medium', technology: 'CSS', status: 'open', reward_amount: 1000, reward_currency: 'INR' },
    { repository_id: repoIds[0], title: 'Optimize bundle size', description: 'Reduce JS bundle', issue_url: 'https://github.com/org-alpha/repo-alpha/issues/3', difficulty: 'hard', technology: 'Webpack', status: 'open', reward_amount: 2000, reward_currency: 'INR' },
    { repository_id: repoIds[1], title: 'Fix API timeout', description: 'API calls timeout', issue_url: 'https://github.com/org-beta/repo-beta/issues/1', difficulty: 'medium', technology: 'Node.js', status: 'open', reward_amount: 1500, reward_currency: 'INR' },
    { repository_id: repoIds[1], title: 'Add unit tests', description: 'Increase coverage', issue_url: 'https://github.com/org-beta/repo-beta/issues/2', difficulty: 'easy', technology: 'Jest', status: 'open', reward_amount: 800, reward_currency: 'INR' },
    { repository_id: repoIds[1], title: 'Refactor auth module', description: 'Clean up auth code', issue_url: 'https://github.com/org-beta/repo-beta/issues/3', difficulty: 'hard', technology: 'TypeScript', status: 'open', reward_amount: 2500, reward_currency: 'INR' },
    { repository_id: repoIds[2], title: 'Update dependencies', description: 'Upgrade packages', issue_url: 'https://github.com/org-gamma/repo-gamma/issues/1', difficulty: 'easy', technology: 'npm', status: 'open', reward_amount: 300, reward_currency: 'INR' },
    { repository_id: repoIds[2], title: 'Improve accessibility', description: 'ARIA labels', issue_url: 'https://github.com/org-gamma/repo-gamma/issues/2', difficulty: 'medium', technology: 'HTML', status: 'open', reward_amount: 1200, reward_currency: 'INR' },
    { repository_id: repoIds[2], title: 'Add CI pipeline', description: 'GitHub Actions', issue_url: 'https://github.com/org-gamma/repo-gamma/issues/3', difficulty: 'hard', technology: 'GitHub Actions', status: 'open', reward_amount: 1800, reward_currency: 'INR' },
    { repository_id: repoIds[2], title: 'Write documentation', description: 'API docs', issue_url: 'https://github.com/org-gamma/repo-gamma/issues/4', difficulty: 'easy', technology: 'Markdown', status: 'open', reward_amount: 600, reward_currency: 'INR' },
  ];

  const taskIds: string[] = [];
  for (const t of tasksData) {
    const { data: existing } = await supabaseAdmin.from('tasks').select('id').eq('title', t.title).eq('repository_id', t.repository_id).single();
    if (existing) {
      taskIds.push(existing.id);
      console.log(`Task already exists: ${t.title} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('tasks').insert(t).select('id').single();
      if (error) throw error;
      taskIds.push(inserted.id);
      console.log(`Created task: ${t.title} (${inserted.id})`);
    }
  }

  const claimsData = [
    { task_id: taskIds[0], user_id: devUserId, status: 'active' },
    { task_id: taskIds[3], user_id: devUserId, status: 'active' },
  ];

  const claimIds: string[] = [];
  for (const c of claimsData) {
    const { data: existing } = await supabaseAdmin.from('claims').select('id').eq('task_id', c.task_id).eq('user_id', c.user_id).single();
    if (existing) {
      claimIds.push(existing.id);
      console.log(`Claim already exists: task ${c.task_id} by user ${c.user_id} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('claims').insert(c).select('id').single();
      if (error) throw error;
      claimIds.push(inserted.id);
      console.log(`Created claim: task ${c.task_id} by user ${c.user_id} (${inserted.id})`);
    }
  }

  const submissionsData = [
    { task_id: taskIds[0], user_id: devUserId, claim_id: claimIds[0], pr_url: 'https://github.com/org-alpha/repo-alpha/pull/10', pr_number: '10', pr_status: 'merged' },
    { task_id: taskIds[3], user_id: devUserId, claim_id: claimIds[1], pr_url: 'https://github.com/org-beta/repo-beta/pull/5', pr_number: '5', pr_status: 'pending' },
  ];

  const submissionIds: string[] = [];
  for (const s of submissionsData) {
    const { data: existing } = await supabaseAdmin.from('submissions').select('id').eq('task_id', s.task_id).eq('user_id', s.user_id).single();
    if (existing) {
      submissionIds.push(existing.id);
      console.log(`Submission already exists: task ${s.task_id} by user ${s.user_id} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('submissions').insert(s).select('id').single();
      if (error) throw error;
      submissionIds.push(inserted.id);
      console.log(`Created submission: task ${s.task_id} by user ${s.user_id} (${inserted.id})`);
    }
  }

  const contributionsData = [
    { user_id: devUserId, task_id: taskIds[0], submission_id: submissionIds[0], status: 'verified', reviewer: 'admin', merged_at: new Date().toISOString() },
    { user_id: devUserId, task_id: taskIds[3], submission_id: submissionIds[1], status: 'verified', reviewer: 'admin', merged_at: new Date().toISOString() },
  ];

  const contributionIds: string[] = [];
  for (const c of contributionsData) {
    const { data: existing } = await supabaseAdmin.from('contributions').select('id').eq('task_id', c.task_id).eq('user_id', c.user_id).single();
    if (existing) {
      contributionIds.push(existing.id);
      console.log(`Contribution already exists: task ${c.task_id} by user ${c.user_id} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('contributions').insert(c).select('id').single();
      if (error) throw error;
      contributionIds.push(inserted.id);
      console.log(`Created contribution: task ${c.task_id} by user ${c.user_id} (${inserted.id})`);
    }
  }

  const walletsData = [
    { user_id: devUserId, available_balance: 5000, total_earned: 5000 },
    { user_id: bizUserId, available_balance: 0, total_earned: 0 },
  ];

  const walletIds: string[] = [];
  for (const w of walletsData) {
    const { data: existing } = await supabaseAdmin.from('wallets').select('id').eq('user_id', w.user_id).single();
    if (existing) {
      walletIds.push(existing.id);
      console.log(`Wallet already exists for user ${w.user_id} (${existing.id})`);
    } else {
      const { data: inserted, error } = await supabaseAdmin.from('wallets').insert(w).select('id').single();
      if (error) throw error;
      walletIds.push(inserted.id);
      console.log(`Created wallet for user ${w.user_id} (${inserted.id})`);
    }
  }

  const walletTxData = {
    wallet_id: walletIds[0],
    task_id: taskIds[0],
    contribution_id: contributionIds[0],
    amount: 500,
    currency: 'INR',
    type: 'TASK_REWARD',
    status: 'CREDITED',
  };

  const { data: existingTx } = await supabaseAdmin.from('wallet_transactions').select('id').eq('wallet_id', walletTxData.wallet_id).eq('task_id', walletTxData.task_id).eq('contribution_id', walletTxData.contribution_id).single();
  if (existingTx) {
    console.log(`Wallet transaction already exists (${existingTx.id})`);
  } else {
    const { data: inserted, error } = await supabaseAdmin.from('wallet_transactions').insert(walletTxData).select('id').single();
    if (error) throw error;
    console.log(`Created wallet transaction (${inserted.id})`);
  }

  console.log('Seed completed successfully!');
  console.log('Summary:');
  console.log(`  Users: ${authUserIds.length}`);
  console.log(`  Repositories: ${repoIds.length}`);
  console.log(`  Tasks: ${taskIds.length}`);
  console.log(`  Claims: ${claimIds.length}`);
  console.log(`  Submissions: ${submissionIds.length}`);
  console.log(`  Contributions: ${contributionIds.length}`);
  console.log(`  Wallets: ${walletIds.length}`);
  console.log(`  Wallet Transactions: 1`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
