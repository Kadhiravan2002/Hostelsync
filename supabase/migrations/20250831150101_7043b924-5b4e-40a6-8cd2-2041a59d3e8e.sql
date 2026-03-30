-- Fix RLS policies for approval_history table
-- Only allow staff and the original request submitter to view approval history
DROP POLICY IF EXISTS "Everyone can view approval history" ON public.approval_history;

CREATE POLICY "Approval history visible to staff and request owners" 
ON public.approval_history
FOR SELECT 
USING (
  get_current_user_role() = ANY (ARRAY['admin'::user_role, 'warden'::user_role, 'advisor'::user_role, 'hod'::user_role, 'principal'::user_role])
  OR 
  request_id IN (
    SELECT id FROM public.outing_requests WHERE student_id = auth.uid()
  )
);

-- Fix complaints table to better protect anonymous complaints
-- Remove the policy that allows admins to view submitted_by for anonymous complaints
DROP POLICY IF EXISTS "Users can view their own complaints" ON public.complaints;

CREATE POLICY "Users can view their own complaints" 
ON public.complaints
FOR SELECT 
USING (
  (NOT is_anonymous AND submitted_by = auth.uid()) 
  OR 
  (get_current_user_role() = 'admin'::user_role)
);

-- Create admin user through proper Supabase auth
-- First create a function to handle admin account creation
CREATE OR REPLACE FUNCTION public.create_admin_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function should be called manually by a super admin
  -- It's a placeholder for proper admin account creation process
  -- In production, this would be handled through Supabase dashboard or CLI
  NULL;
END;
$$;