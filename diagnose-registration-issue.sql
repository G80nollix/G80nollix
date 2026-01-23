-- ============================================
-- SCRIPT DI DIAGNOSTICA: Problema registrazione dopo migration
-- ============================================
-- Esegui queste query per capire perché la registrazione non funziona
-- ============================================

-- 1. Verifica che il trigger on_auth_user_created esista e sia abilitato
SELECT 
  tgname as trigger_name,
  CASE tgenabled 
    WHEN 'O' THEN '✅ Enabled' 
    WHEN 'D' THEN '❌ Disabled' 
    ELSE '⚠️ Unknown'
  END as status,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
  AND tgname = 'on_auth_user_created';

-- 2. Verifica che la funzione handle_new_user esista
SELECT 
  proname as function_name,
  pronamespace::regnamespace as schema,
  CASE 
    WHEN proname = 'handle_new_user' THEN '✅ Funzione per INSERT'
    ELSE '❓ Funzione sconosciuta'
  END as description
FROM pg_proc
WHERE proname = 'handle_new_user'
  AND pronamespace = 'public'::regnamespace;

-- 2b. Verifica che on_auth_user_updated NON esista (non lo usiamo nel dev)
SELECT 
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgrelid = 'auth.users'::regclass 
      AND tgname = 'on_auth_user_updated'
    ) THEN '✅ OK: on_auth_user_updated non esiste (come previsto)'
    ELSE '⚠️ ATTENZIONE: on_auth_user_updated esiste ancora (dovrebbe essere rimosso)'
  END as check_update_trigger;

-- 3. Verifica la struttura della tabella profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 4. Verifica i vincoli NOT NULL sulla tabella profiles
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'c'
ORDER BY conname;

-- 5. Verifica le RLS policies sulla tabella profiles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

-- 6. Verifica se RLS è abilitato sulla tabella profiles
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- 7. Verifica i foreign key constraints sulla tabella profiles
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition,
  confrelid::regclass as referenced_table
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'f'  -- Foreign key constraints
ORDER BY conname;

-- 8. Test: Prova a inserire un profilo di test (verrà rollback)
-- NOTA: Questo test fallirà se c'è un FK constraint errato
BEGIN;
  INSERT INTO public.profiles (
    id,
    email,
    first_name,
    last_name,
    user_type,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    'test@example.com',
    'Test',
    'User',
    'individual',
    NOW(),
    NOW()
  );
ROLLBACK;

-- Se la query #7 fallisce, mostra l'errore completo
-- Questo ti dirà esattamente quale vincolo o policy sta bloccando l'inserimento

