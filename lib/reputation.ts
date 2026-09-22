// Reputation engine (P2 scaffold)
// Calculates a 0–100 reputation score from a developer's verified contributions.
// Scoring bands (for future calibration):
//   - 0 verified contributions: 0
//   - 1–4 verified contributions: 25 per contribution (capped at 100)
//   - 5+ verified contributions: 100
// Future work: weight by reward amount, difficulty tier, maintainer rating, and recency.

export interface ReputationInput {
  contributionCount: number;
  verifiedContributionCount?: number;
  totalEarned?: number;
}

export interface ReputationResult {
  score: number;
  tier: 'New' | 'Emerging' | 'Established' | 'Top Contributor';
  verifiedCount: number;
}

export function calculateReputation(input: ReputationInput): ReputationResult {
  const verified = input.verifiedContributionCount ?? input.contributionCount;
  let score = 0;
  if (verified <= 0) score = 0;
  else if (verified <= 4) score = Math.min(100, verified * 25);
  else score = 100;

  let tier: ReputationResult['tier'] = 'New';
  if (score >= 75) tier = 'Top Contributor';
  else if (score >= 50) tier = 'Established';
  else if (score >= 25) tier = 'Emerging';
  else tier = 'New';

  return {
    score,
    tier,
    verifiedCount: verified,
  };
}

export function tierLabel(tier: ReputationResult['tier']): string {
  return tier;
}
