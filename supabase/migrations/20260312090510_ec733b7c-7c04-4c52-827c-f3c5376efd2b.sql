
-- Allow admin to delete from complaints
CREATE POLICY "Admins can delete complaints"
ON public.complaints
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from attendance
CREATE POLICY "Admins can delete attendance"
ON public.attendance
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from outing_requests
CREATE POLICY "Admins can delete outing_requests"
ON public.outing_requests
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from approval_history
CREATE POLICY "Admins can delete approval_history"
ON public.approval_history
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from user_roles
CREATE POLICY "Admins can delete user_roles"
ON public.user_roles
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));

-- Allow admin to delete from notices
CREATE POLICY "Admins can delete notices"
ON public.notices
FOR DELETE
TO public
USING (has_role(auth.uid(), 'admin'::user_role));
