// Audit trail (P2 scaffold)
// Records immutable, append-only events for financial, reputation, and
// marketplace actions. Events are written through the audit RPC (service_role)
// so application code cannot tamper with history.
//
// The corresponding migration `supabase/migrations/0012_reputation_and_audit.sql`
// creates the `audit_logs` table and `atomic_append_audit_event` RPC.
//
// Implementation note: wire `atomic_append_audit_event` via the service_role
// client once the migration is applied.

export interface AuditEvent {
  actor_id: string;
  event_type: string; // 'TASK_CREATED', 'CLAIMED', 'PR_SUBMITTED', 'REVIEW', 'REWARD_PENDING', 'REWARD_VERIFIED', 'REWARD_REDEEMED', 'WITHDRAWAL_REQUESTED', 'WITHDRAWAL_PAID', etc.
  entity_type: string; // 'task', 'claim', 'submission', 'contribution', 'wallet', 'wallet_transaction', 'repository'
  entity_id: string;
  metadata?: Record<string, unknown>;
}

export async function appendAuditEvent(event: AuditEvent): Promise<{ ok: boolean; error?: string; eventId?: string }> {
  // TODO: call atomic_append_audit_event RPC via service_role client.
  return { ok: false, error: 'audit RPC not yet wired' };
}
