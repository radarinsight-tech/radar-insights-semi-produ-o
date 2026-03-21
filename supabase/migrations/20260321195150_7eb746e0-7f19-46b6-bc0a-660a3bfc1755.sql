
-- Confirm email for test user so they can login
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE id = '1c4380b3-c372-4832-bdf6-18cf12e1b3e8' 
AND email_confirmed_at IS NULL;
