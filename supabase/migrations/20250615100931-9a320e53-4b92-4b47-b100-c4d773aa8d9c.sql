
-- Delete all products first (due to potential foreign key constraints)
DELETE FROM public.products;

-- Delete all user profiles
DELETE FROM public.profiles;

-- Delete all users from the auth schema (this will cascade to profiles due to foreign key)
DELETE FROM auth.users;

-- Reset any sequences if needed
SELECT setval(pg_get_serial_sequence('public.products', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('public.profiles', 'id'), 1, false);
