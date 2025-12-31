-- Simplify RLS on rooms so everyone can read, admins/wardens can modify

-- Remove existing room policies
DROP POLICY IF EXISTS "Admins can manage rooms via user_roles" ON public.rooms;
DROP POLICY IF EXISTS "Everyone can view rooms" ON public.rooms;
DROP POLICY IF EXISTS "Warden can update rooms via user_roles" ON public.rooms;

-- Admins can INSERT rooms
CREATE POLICY "Admins insert rooms via user_roles"
ON public.rooms
AS PERMISSIVE
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Admins can UPDATE rooms
CREATE POLICY "Admins update rooms via user_roles"
ON public.rooms
AS PERMISSIVE
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can DELETE rooms
CREATE POLICY "Admins delete rooms via user_roles"
ON public.rooms
AS PERMISSIVE
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Wardens can UPDATE rooms
CREATE POLICY "Wardens update rooms via user_roles"
ON public.rooms
AS PERMISSIVE
FOR UPDATE
USING (has_role(auth.uid(), 'warden'::user_role));

-- Everyone (including unauthenticated users) can view room list
CREATE POLICY "Everyone can view rooms"
ON public.rooms
AS PERMISSIVE
FOR SELECT
USING (true);
