-- Add email preferences fields to profiles
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false;
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS email_preferences_token text DEFAULT (encode(gen_random_bytes(32), 'hex'));
ALTER TABLE public.buyer_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false;
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS email_preferences_token text DEFAULT (encode(gen_random_bytes(32), 'hex'));
ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;

-- Create indexes for token lookups
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_preferences_token ON public.buyer_profiles(email_preferences_token);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_preferences_token ON public.seller_profiles(email_preferences_token);

-- Update existing profiles to have tokens if they don't
UPDATE public.buyer_profiles 
SET email_preferences_token = encode(gen_random_bytes(32), 'hex') 
WHERE email_preferences_token IS NULL;

UPDATE public.seller_profiles 
SET email_preferences_token = encode(gen_random_bytes(32), 'hex') 
WHERE email_preferences_token IS NULL;