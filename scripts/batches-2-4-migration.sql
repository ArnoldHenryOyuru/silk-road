-- Batches 2-4 Migration for Live Supabase (Hardened)
-- Protects existing members (grandfathers existing approved accounts),
-- adds email verification timestamp, profile rejection recovery window,
-- paused subscription state, WhatsApp number blocklist, refund payout tracking,
-- persistent email OTP & rate-limit tables, and enforces live CHECK constraints.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

-- Grandfather existing approved members so they remain unaffected
UPDATE public.users u
SET email_verified_at = COALESCE(u.email_verified_at, u.created_at)
FROM public.profiles p
WHERE p.user_id = u.id AND p.status = 'approved';

-- Safely normalize legacy '+256...' phone numbers to '256...' where no duplicate exists
UPDATE public.users u
SET phone_number = substring(u.phone_number FROM 2)
WHERE u.phone_number ~ '^\+256[0-9]{9}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.phone_number = substring(u.phone_number FROM 2)
      AND u2.id <> u.id
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS draft_nudged_at timestamptz;

-- Replace profiles.status CHECK constraint to ensure 'draft', 'pending_review', 'approved', 'rejected' are valid
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected'));
END $$;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_remaining_ms bigint;

-- Replace subscriptions.status CHECK constraint to allow 'paused', 'refund_requested', etc.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'subscriptions'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;

  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'paused', 'refund_requested', 'expired', 'cancelled'));
END $$;

-- Ensure unique phone_number on public.users (Batch 1 guard reinforcement)
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique_idx
  ON public.users (phone_number)
  WHERE phone_number IS NOT NULL;

-- WhatsApp number blocklist (Batch 3)
CREATE TABLE IF NOT EXISTS public.blocked_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  reason text,
  blocked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_numbers ENABLE ROW LEVEL SECURITY;

-- Refund requests during 14-day rejection recovery window (Batch 3 + payout tracking)
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UGX',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'refunded', 'declined')),
  payout_ref text,
  admin_note text,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id)
);

ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS admin_note text;

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refund_requests' AND policyname = 'Users can view own refund requests'
  ) THEN
    CREATE POLICY "Users can view own refund requests"
      ON public.refund_requests FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Persistent 6-digit Email OTP records (survives server restarts & multi-instance deploys)
CREATE TABLE IF NOT EXISTS public.email_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  otp_key text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;

-- Persistent rate-limit hits (survives server restarts & multi-instance deploys)
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_created_idx
  ON public.rate_limit_hits (bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
