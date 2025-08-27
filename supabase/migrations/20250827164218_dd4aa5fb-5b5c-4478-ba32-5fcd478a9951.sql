-- Update users table to match TipKoro specification
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'donator',
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS socials JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update users table constraints
ALTER TABLE public.users 
ALTER COLUMN role SET DEFAULT 'donator';

-- Add check constraint for roles
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users 
ADD CONSTRAINT users_role_check CHECK (role IN ('creator', 'donator', 'admin'));

-- Update subscriptions table to match specification
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS paid_until DATE,
ADD COLUMN IF NOT EXISTS last_payment_txn_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

-- Update subscriptions table - remove expires_at in favor of paid_until
-- We'll use paid_until as the main field
UPDATE public.subscriptions SET paid_until = expires_at::date WHERE paid_until IS NULL;

-- Update donations table to match specification  
ALTER TABLE public.donations
ADD COLUMN IF NOT EXISTS txn_id TEXT;

-- Update withdrawals table to match specification
ALTER TABLE public.withdrawals
ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'bkash';

-- Add check constraint for withdrawal methods
ALTER TABLE public.withdrawals
DROP CONSTRAINT IF EXISTS withdrawals_method_check;

ALTER TABLE public.withdrawals
ADD CONSTRAINT withdrawals_method_check CHECK (method IN ('bkash', 'nagad', 'bank'));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paid_until ON public.subscriptions(paid_until);
CREATE INDEX IF NOT EXISTS idx_donations_creator_id ON public.donations(creator_id);
CREATE INDEX IF NOT EXISTS idx_donations_txn_id ON public.donations(txn_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator_id ON public.withdrawals(user_id);

-- Update RLS policies for the new role-based system
-- Users table policies (update existing ones)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Public can view creator profiles" ON public.users
FOR SELECT 
USING (role = 'creator');

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Donations policies (allow anonymous donations)
DROP POLICY IF EXISTS "Anyone can create donations" ON public.donations;
CREATE POLICY "Anyone can create donations" ON public.donations
FOR INSERT 
WITH CHECK (true);

-- Subscriptions policies (only creators can manage their subscriptions)
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
CREATE POLICY "Creators can insert own subscriptions" ON public.subscriptions
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Creators can update own subscriptions" ON public.subscriptions
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Creators can view own subscriptions" ON public.subscriptions
FOR SELECT 
USING (auth.uid() = user_id);

-- Update the handle_new_user function to set proper defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, bio, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'User'),
    COALESCE(NEW.raw_user_meta_data ->> 'bio', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'donator')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = NEW.email,
    username = COALESCE(NEW.raw_user_meta_data ->> 'username', users.username),
    display_name = COALESCE(NEW.raw_user_meta_data ->> 'display_name', users.display_name),
    role = COALESCE(NEW.raw_user_meta_data ->> 'role', users.role);
  
  RETURN NEW;
END;
$$;