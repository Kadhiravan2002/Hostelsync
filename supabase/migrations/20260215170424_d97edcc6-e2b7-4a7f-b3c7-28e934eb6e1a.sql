
-- Fix security definer view warning by setting security_invoker
ALTER VIEW public.student_live_status SET (security_invoker = true);
