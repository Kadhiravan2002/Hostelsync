-- Replace SELECT policy to allow all authenticated roles to view anonymous complaints
DROP POLICY IF EXISTS "Users can view their own complaints and staff can view all" ON public.complaints;

CREATE POLICY "View complaints by role and anonymity"
ON public.complaints
FOR SELECT
TO authenticated
USING (
  -- Anyone authenticated can view anonymous complaints
  (is_anonymous = true) OR
  -- Users can view their own complaints (anonymous or not)
  (submitted_by = auth.uid()) OR
  -- Staff roles can view all complaints
  (get_current_user_role() = ANY (ARRAY['admin'::user_role, 'warden'::user_role, 'advisor'::user_role, 'hod'::user_role, 'principal'::user_role]))
);