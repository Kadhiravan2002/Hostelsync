
-- Fix security definer warning: explicitly set SECURITY INVOKER
ALTER VIEW public.student_live_status SET (security_invoker = on);
