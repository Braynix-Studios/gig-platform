import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockSupabase, mockUpdateChain, mockInsertChain } = vi.hoisted(() => {
  const mockUpdateChain: any = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: { available_balance: 500 }, error: null }),
    then: (onResolve: any) => Promise.resolve({ error: null }).then(onResolve),
  };

  const mockInsertChain: any = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'w-new', available_balance: 0, total_earned: 0 }, error: null }),
    then: (onResolve: any) => Promise.resolve({ error: null }).then(onResolve),
  };

  const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  };
  return { mockSupabase, mockUpdateChain, mockInsertChain };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
  createServerClientWithCookies: vi.fn().mockResolvedValue(mockSupabase),
  isSupabaseConfigured: true,
}));

vi.mock('@/lib/supabaseAuth', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'dev-user-1', role: 'developer' }),
}));

import {
  creditTopup,
  debitWallet,
  releaseReward,
  refundTaskEscrow,
  verifyReward,
} from '@/lib/db-operations';
import { POST as withdrawalPOST, PATCH as withdrawalPATCH } from '@/app/api/wallet/withdrawal/route';
import { getSession } from '@/lib/supabaseAuth';

function resetSupabase() {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.gt.mockReturnThis();
  mockSupabase.gte.mockReturnThis();
  mockSupabase.order.mockReturnThis();
  mockSupabase.limit.mockReturnThis();
  mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockSupabase.single.mockResolvedValue({ data: null, error: null });
  
  mockSupabase.update.mockReturnValue(mockUpdateChain);
  mockUpdateChain.eq.mockReturnThis();
  mockUpdateChain.gte.mockReturnThis();
  mockUpdateChain.select.mockReturnThis();
  mockUpdateChain.maybeSingle.mockResolvedValue({ data: { available_balance: 500 }, error: null });
  
  mockSupabase.insert.mockReturnValue(mockInsertChain);
  mockInsertChain.select.mockReturnThis();
  mockInsertChain.single.mockResolvedValue({ data: { id: 'w-new', available_balance: 0, total_earned: 0 }, error: null });
  mockInsertChain.then = (onResolve: any) => Promise.resolve({ error: null }).then(onResolve);

  mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null });
  (getSession as any).mockResolvedValue({ userId: 'dev-user-1', role: 'developer' });
}

describe('Adversarial Financial State Machine Stress Tests', () => {
  beforeEach(() => {
    resetSupabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // 1. creditTopup Atomicity and Rollback Stress Harness
  // =========================================================================
  describe('Objective 1: creditTopup Atomicity & Invariants', () => {
    it('empirical_topup_1_atomicity_rollback: rolls back wallet balance to initial value when ledger insert fails', async () => {
      const initialBalance = 1500;
      const topupAmount = 500;
      const walletData = { id: 'w-topup-test', user_id: 'biz-1', available_balance: initialBalance };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
      // Simulate ledger insert failure (e.g. database foreign key violation or disk error)
      mockInsertChain.then = (onResolve: any) => Promise.resolve({
        error: { message: 'Ledger table disk quota exceeded / write failure' },
      }).then(onResolve);

      const res = await creditTopup({ userId: 'biz-1', amount: topupAmount, currency: 'INR' }, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/write failure/i);

      // Verify that compensating rollback was issued
      const updateCalls = mockSupabase.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
      // First update was the increment (2000)
      expect(updateCalls[0][0]).toEqual({ available_balance: 2000 });
      // Second update MUST be the compensating rollback to initial balance (1500)
      expect(updateCalls[1][0]).toEqual({ available_balance: initialBalance });
    });

    it('empirical_topup_2_negative_and_zero_inputs: rejects non-positive topup amounts without mutating database', async () => {
      const resZero = await creditTopup({ userId: 'biz-1', amount: 0 }, mockSupabase as any);
      expect(resZero.ok).toBe(false);
      expect(resZero.error).toMatch(/positive/i);

      const resNeg = await creditTopup({ userId: 'biz-1', amount: -250 }, mockSupabase as any);
      expect(resNeg.ok).toBe(false);
      expect(resNeg.error).toMatch(/positive/i);

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('empirical_topup_3_creates_wallet_if_missing: creates new wallet with 0 base and applies topup atomically', async () => {
      // 1. wallet query returns null
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // 2. insert returns newly created wallet
      mockInsertChain.single.mockResolvedValueOnce({
        data: { id: 'w-new-created', user_id: 'biz-fresh', available_balance: 0, total_earned: 0 },
        error: null,
      });

      const res = await creditTopup({ userId: 'biz-fresh', amount: 1000 }, mockSupabase as any);

      expect(res.ok).toBe(true);
      expect(res.newBalance).toBe(1000);
      expect(mockSupabase.update).toHaveBeenCalledWith({ available_balance: 1000 });
    });
  });

  // =========================================================================
  // 2. Withdrawal Creation Lifecycle & Premature Balance Deduction Bug
  // =========================================================================
  describe('Objective 2: Withdrawal Lifecycle & Premature Deduction Audit', () => {
    it('empirical_withdrawal_1_request_produces_requested_status: produces status REQUESTED in transaction record', async () => {
      const walletData = { id: 'w-with-1', user_id: 'dev-user-1', available_balance: 2000 };
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null }); // wallet query
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // idempotency query

      const req = new Request('http://localhost/api/wallet/withdrawal', {
        method: 'POST',
        body: JSON.stringify({ amount: 500 }),
      });

      const res = await withdrawalPOST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.status).toBe('REQUESTED');

      // Verify transaction inserted with REQUESTED
      const txCall = mockSupabase.insert.mock.calls.find((call: any) => call[0]?.type === 'WITHDRAWAL');
      expect(txCall).toBeDefined();
      expect(txCall[0].status).toBe('REQUESTED');
    });

    it('empirical_withdrawal_2_audit_premature_deduction_in_fallback: detects whether fallback debitWallet prematurely decrements balance on REQUESTED', async () => {
      // In the fallback path, POST /api/wallet/withdrawal delegates to debitWallet({ status: 'REQUESTED' }).
      // This test observes whether wallets.update was invoked to decrement available_balance during withdrawal creation.
      const initialBalance = 1000;
      const withdrawalAmount = 500;
      const walletData = { id: 'w-audit-1', user_id: 'dev-user-1', available_balance: initialBalance };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const req = new Request('http://localhost/api/wallet/withdrawal', {
        method: 'POST',
        body: JSON.stringify({ amount: withdrawalAmount }),
      });

      const res = await withdrawalPOST(req);
      expect(res.status).toBe(200);

      // Audit observation: Did POST decrement the wallet balance?
      const balanceUpdateCall = mockSupabase.update.mock.calls.find((call: any) => 'available_balance' in call[0]);
      
      // Documenting empirical behavior:
      // In the canonical path, POST uses atomic_request_withdrawal RPC which does NOT decrement the balance.
      // R1c specifies: "The withdrawal route must create a REQUESTED record and not immediately decrement the balance."
      const prematurelyDecremented = Boolean(balanceUpdateCall && balanceUpdateCall[0].available_balance === (initialBalance - withdrawalAmount));
      
      expect(prematurelyDecremented).toBe(false);
    });

    it('empirical_withdrawal_3_double_deduction_or_confirmation_lockout: demonstrates interaction between POST decrement and PATCH decrement', async () => {
      // Scenario: Developer has 500 in wallet.
      // 1. Developer requests withdrawal of 500.
      // In fallback mode, POST calls debitWallet which sets available_balance = 0.
      // 2. Later, payout succeeds and PATCH is called with status = 'PAID'.
      // PATCH queries wallet balance:
      // If wallet balance is 0, PATCH checks `available_balance < amountToDebit (500)`.
      // Result: PATCH FAILS with "Insufficient balance to complete payout", locking the developer out of their payout!
      (getSession as any).mockResolvedValue({ userId: 'dev-user-1', role: 'developer' });

      // Simulate PATCH confirmation when balance was already debited to 0 by POST
      mockSupabase.maybeSingle
        // 1. txRecord check: owned by dev-user-1
        .mockResolvedValueOnce({
          data: {
            id: 'tx-withdraw-500',
            wallet_id: 'w-dev-1',
            status: 'REQUESTED',
            wallets: { user_id: 'dev-user-1' },
          },
          error: null,
        })
        // 2. tx query in fallback
        .mockResolvedValueOnce({
          data: {
            id: 'tx-withdraw-500',
            wallet_id: 'w-dev-1',
            amount: -500,
            status: 'REQUESTED',
          },
          error: null,
        })
        // 3. wallet balance query (it is 0 because POST deducted it already!)
        .mockResolvedValueOnce({
          data: {
            available_balance: 0,
          },
          error: null,
        });

      const patchReq = new Request('http://localhost/api/wallet/withdrawal', {
        method: 'PATCH',
        body: JSON.stringify({ transaction_id: 'tx-withdraw-500', payout_status: 'PAID' }),
      });

      const patchRes = await withdrawalPATCH(patchReq);
      const patchJson = await patchRes.json();

      // Empirical proof of lockout: PATCH rejects payout because POST already deducted the funds!
      expect(patchRes.status).toBe(400);
      expect(patchJson.error).toMatch(/insufficient balance/i);
    });
  });

  // =========================================================================
  // 3. verifyReward State Machine (PENDING -> VERIFIED)
  // =========================================================================
  describe('Objective 3: verifyReward Lifecycle', () => {
    it('empirical_verify_1_pending_to_verified: transitions PENDING transaction to VERIFIED', async () => {
      const txRecord = {
        id: 'tx-verify-1',
        wallet_id: 'w-dev-verify',
        amount: 500,
        status: 'PENDING',
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: txRecord, error: null });

      const res = await verifyReward({ transactionId: 'tx-verify-1' }, mockSupabase as any);

      expect(res.ok).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'VERIFIED' });
      expect(mockSupabase.update).toHaveBeenCalledWith({ eq: 'id' });
    });

    it('empirical_verify_2_idempotent_if_already_verified: does not re-update if already VERIFIED', async () => {
      const txRecord = {
        id: 'tx-already-verified',
        wallet_id: 'w-dev-verify',
        amount: 500,
        status: 'VERIFIED',
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: txRecord, error: null });

      const res = await verifyReward({ transactionId: 'tx-already-verified' }, mockSupabase as any);

      expect(res.ok).toBe(true);
      // No updates should have been issued
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_verify_3_reject_non_pending: rejects transactions not in PENDING status', async () => {
      const txRecord = {
        id: 'tx-already-released',
        wallet_id: 'w-dev-verify',
        amount: 500,
        status: 'AVAILABLE',
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: txRecord, error: null });

      const res = await verifyReward({ transactionId: 'tx-already-released' }, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not in PENDING/i);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_verify_4_transaction_not_found: returns error for non-existent transaction', async () => {
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const res = await verifyReward({ transactionId: 'tx-nonexistent' }, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Transaction not found/i);
    });
  });

  // =========================================================================
  // 4. releaseReward State Machine (VERIFIED -> AVAILABLE)
  // =========================================================================
  describe('Objective 4: releaseReward Lifecycle & Idempotency', () => {
    it('empirical_reward_1_advances_verified_to_available: atomically updates tx status and credits available_balance and total_earned', async () => {
      const initialBalance = 200;
      const initialEarned = 200;
      const rewardAmount = 800;

      const txRecord = {
        id: 'tx-reward-verified-1',
        wallet_id: 'w-dev-reward',
        amount: rewardAmount,
        status: 'VERIFIED',
      };
      const walletRecord = {
        id: 'w-dev-reward',
        available_balance: initialBalance,
        total_earned: initialEarned,
      };

      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: txRecord, error: null }) // query tx
        .mockResolvedValueOnce({ data: walletRecord, error: null }); // query wallet

      const res = await releaseReward({ transactionId: 'tx-reward-verified-1' }, mockSupabase as any);

      expect(res.ok).toBe(true);
      expect(res.newBalance).toBe(1000);

      // Verify wallet updated with balance and total_earned
      expect(mockSupabase.update).toHaveBeenCalledWith({
        available_balance: 1000,
        total_earned: 1000,
      });

      // Verify tx updated to AVAILABLE
      expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'AVAILABLE' });
    });

    it('empirical_reward_2_idempotent_if_already_available: does not double-credit if transaction already AVAILABLE', async () => {
      const txRecord = {
        id: 'tx-already-available',
        wallet_id: 'w-dev-reward',
        amount: 500,
        status: 'AVAILABLE',
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: txRecord, error: null });

      const res = await releaseReward({ transactionId: 'tx-already-available' }, mockSupabase as any);

      expect(res.ok).toBe(true);
      // No updates should have been issued
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_reward_3_rejects_non_verified_status: rejects transactions not in VERIFIED status', async () => {
      const txRecord = {
        id: 'tx-completed-state',
        wallet_id: 'w-dev-reward',
        amount: 500,
        status: 'COMPLETED', // Invalid initial state for releaseReward
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: txRecord, error: null });

      const res = await releaseReward({ transactionId: 'tx-completed-state' }, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not in VERIFIED/i);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_reward_4_compensating_rollback_on_tx_update_fail: reverts wallet balance if status update fails', async () => {
      const initialBalance = 100;
      const initialEarned = 100;
      const rewardAmount = 500;

      const txRecord = {
        id: 'tx-fail-update',
        wallet_id: 'w-dev-reward',
        amount: rewardAmount,
        status: 'VERIFIED',
      };
      const walletRecord = {
        id: 'w-dev-reward',
        available_balance: initialBalance,
        total_earned: initialEarned,
      };

      mockSupabase.maybeSingle
        .mockResolvedValueOnce({ data: txRecord, error: null }) // query tx
        .mockResolvedValueOnce({ data: walletRecord, error: null }); // query wallet

      // First update (wallet balance increment) succeeds
      mockUpdateChain.eq.mockReturnValueOnce(Promise.resolve({ error: null }));
      // Second update (tx status update) fails
      mockUpdateChain.eq.mockReturnValueOnce(Promise.resolve({ error: { message: 'Lock conflict on transaction row' } }));

      const res = await releaseReward({ transactionId: 'tx-fail-update' }, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Lock conflict/i);

      // Verify compensating rollback restored initial balance and initial earned
      expect(mockSupabase.update).toHaveBeenCalledWith({
        available_balance: initialBalance,
        total_earned: initialEarned,
      });
    });
  });

  // =========================================================================
  // 5. refundTaskEscrow Cancellation & Escrow Restoration
  // =========================================================================
  describe('Objective 5: refundTaskEscrow Invariants & Boundary Analysis', () => {
    it('empirical_refund_1_successful_cancellation_and_refund: cancels open task, unlocks escrow, and credits business wallet', async () => {
      const taskId = 'task-open-101';
      const businessId = 'biz-owner-101';
      const bounty = 3000;

      const taskRecord = {
        id: taskId,
        status: 'open',
        reward_amount: bounty,
        reward_currency: 'INR',
        escrow_locked: true,
      };

      const businessWallet = {
        id: 'w-biz-101',
        available_balance: 5000,
      };

      // 1. Query task
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: taskRecord, error: null });
      // 2. Query active claims (none)
      mockSupabase.gt.mockResolvedValueOnce({ data: [], error: null });
      // 3. Query business wallet
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: businessWallet, error: null });

      const res = await refundTaskEscrow(taskId, businessId, mockSupabase as any);

      expect(res.ok).toBe(true);
      expect(res.refundedAmount).toBe(bounty);
      expect(res.newBalance).toBe(8000);

      // Verify task canceled and escrow unlocked
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: 'canceled',
        escrow_locked: false,
      });

      // Verify business wallet credited
      expect(mockSupabase.update).toHaveBeenCalledWith({
        available_balance: 8000,
      });

      // Verify ESCROW_REFUND transaction logged
      expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
        wallet_id: 'w-biz-101',
        task_id: taskId,
        amount: bounty,
        type: 'ESCROW_REFUND',
        status: 'COMPLETED',
      }));
    });

    it('empirical_refund_2_blocks_refund_if_active_claim_exists: aborts refund if developer claim is currently active and unexpired', async () => {
      const taskId = 'task-claimed-102';
      const businessId = 'biz-owner-102';

      const taskRecord = {
        id: taskId,
        status: 'open',
        reward_amount: 2500,
        reward_currency: 'INR',
        escrow_locked: true,
      };

      // 1. Query task
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: taskRecord, error: null });
      // 2. Query active claims (active claim found!)
      mockSupabase.gt.mockResolvedValueOnce({
        data: [{ id: 'claim-active-1', status: 'active' }],
        error: null,
      });

      const res = await refundTaskEscrow(taskId, businessId, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/active claim exists/i);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_refund_3_blocks_refund_if_escrow_not_locked: rejects tasks where escrow was already released or unlocked', async () => {
      const taskId = 'task-unlocked-103';
      const businessId = 'biz-owner-103';

      const taskRecord = {
        id: taskId,
        status: 'open',
        reward_amount: 1000,
        reward_currency: 'INR',
        escrow_locked: false, // Escrow already unlocked!
      };

      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: taskRecord, error: null });

      const res = await refundTaskEscrow(taskId, businessId, mockSupabase as any);

      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Escrow is not locked/i);
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('empirical_refund_4_cross_tenant_ownership_stress: rejects refund when task repository does not belong to business company', async () => {
      // Stress test: Business Alice tries to refund Bob's task.
      // Task 999 belongs to Bob's repository, but Alice calls refundTaskEscrow(task999, aliceId).
      const taskRecord = {
        id: 'task-bob-999',
        status: 'open',
        reward_amount: 5000,
        reward_currency: 'INR',
        escrow_locked: true,
        repository_id: 'repo-bobs',
      };

      const aliceWallet = {
        id: 'w-alice',
        available_balance: 100,
      };

      // 1. Query task
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: taskRecord, error: null });
      // 2. Query business user Alice (company = Alice's company)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { company: 'Alice Corp' },
        error: null,
      });
      // 3. Query task repository (owner = Bob's company, different from Alice's)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { owner: 'Bob Corp' },
        error: null,
      });
      // 4. Query active claims (none)
      mockSupabase.gt.mockResolvedValueOnce({ data: [], error: null });
      // 5. Query business wallet (will not be reached due to tenant rejection)
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: aliceWallet, error: null });

      const res = await refundTaskEscrow('task-bob-999', 'alice-business-id', mockSupabase as any);

      // With tenant isolation fix, cross-tenant refund is rejected
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/not belong to your company/i);
    });
  });
});
