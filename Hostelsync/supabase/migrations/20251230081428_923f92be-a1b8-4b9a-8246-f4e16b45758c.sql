-- Fix departments not visible to unauthenticated users.
-- Root cause: restrictive FOR ALL policy was also applying to SELECT and AND-ing with the SELECT policy.

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (they were created as RESTRICTIVE)
DROP POLICY IF EXISTS "Admins can manage departments via user_roles" ON public.departments;
DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;

-- Public read access (safe: departments contain no PII)
CREATE POLICY "Everyone can view departments"
ON public.departments
AS PERMISSIVE
FOR SELECT
USING (true);

-- Admin full access (PERMISSIVE so it doesn't restrict reads for others)
CREATE POLICY "Admins can manage departments via user_roles"
ON public.departments
AS PERMISSIVE
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));
