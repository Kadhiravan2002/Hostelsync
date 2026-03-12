-- Update RLS policy to allow all staff roles to view complaints
DROP POLICY IF EXISTS "Users can view their own complaints" ON public.complaints;

CREATE POLICY "Users can view their own complaints and staff can view all" 
ON public.complaints 
FOR SELECT 
USING (
  ((NOT is_anonymous) AND (submitted_by = auth.uid())) OR 
  (get_current_user_role() = ANY (ARRAY['admin'::user_role, 'warden'::user_role, 'advisor'::user_role, 'hod'::user_role, 'principal'::user_role]))
);