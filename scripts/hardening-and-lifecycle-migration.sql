-- Incremental Hardening & Lifecycle Migration for Live Supabase
-- Safe to run on databases where scripts/batches-2-4-migration.sql was already applied.

-- 1) Normalize legacy '+256...' phone numbers to '256...' cleanly when non-conflicting
UPDATE public.users u
SET phone_number = substring(u.phone_number FROM 2)
WHERE u.phone_number ~ '^\+256[0-9]{9}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.users u2
    WHERE u2.phone_number = substring(u.phone_number FROM 2)
      AND u2.id <> u.id
  );

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_unique_idx
  ON public.users (phone_number)
  WHERE phone_number IS NOT NULL;

-- 2) Draft 24h nudge tracking column & hardened profiles.status CHECK constraint
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS draft_nudged_at timestamptz;

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

-- 3) Hardened subscriptions.status CHECK constraint
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

-- 4) Refund payout tracking columns
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS admin_note text;

-- 5) Persistent email_otps table
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

-- 6) Persistent rate_limit_hits table
CREATE TABLE IF NOT EXISTS public.rate_limit_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_hits_bucket_created_idx
  ON public.rate_limit_hits (bucket_key, created_at DESC);

ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
