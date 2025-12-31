-- Fix function search path issues
ALTER FUNCTION public.get_current_user_role() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public', 'auth';

-- Drop the placeholder function
DROP FUNCTION IF EXISTS public.create_admin_account();