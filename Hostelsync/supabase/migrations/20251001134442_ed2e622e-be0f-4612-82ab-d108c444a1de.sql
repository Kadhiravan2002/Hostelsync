-- Update RLS policy for profiles to ensure staff can view student profiles
DROP POLICY IF EXISTS "Staff can view student profiles" ON public.profiles;
CREATE POLICY "Staff can view student profiles" 
ON public.profiles 
FOR SELECT 
USING (
  get_current_user_role() = ANY (ARRAY['admin'::user_role, 'warden'::user_role, 'advisor'::user_role, 'hod'::user_role, 'principal'::user_role])
);