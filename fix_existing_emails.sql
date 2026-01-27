-- Fix existing emails from .local to .com
UPDATE auth.users
SET email = REPLACE(email, '@ba9alino.local', '@ba9alino.com')
WHERE email LIKE '%@ba9alino.local';

UPDATE public.user_accounts
SET email = REPLACE(email, '@ba9alino.local', '@ba9alino.com')
WHERE email LIKE '%@ba9alino.local';

-- Show updated users
SELECT email, created_at FROM auth.users WHERE email LIKE '%@ba9alino.com';
