-- Allow task_id to be NULL for withdrawal transactions (which are not tied to a task)
ALTER TABLE public.wallet_transactions ALTER COLUMN task_id DROP NOT NULL;

-- Add withdrawal_id for idempotency tracking on withdrawal transactions
ALTER TABLE public.wallet_transactions ADD COLUMN IF NOT EXISTS withdrawal_id varchar(255) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_withdrawal_id ON public.wallet_transactions(withdrawal_id);
