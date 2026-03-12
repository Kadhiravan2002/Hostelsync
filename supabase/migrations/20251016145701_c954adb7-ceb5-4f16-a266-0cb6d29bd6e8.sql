-- Step 1: Create user_roles table with proper structure
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 2: Create security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 3: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Update RLS policies on profiles table to restrict access

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Staff can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all profiles (using has_role function)
CREATE POLICY "Admins can view all profiles via user_roles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Wardens can view student profiles only
CREATE POLICY "Wardens can view student profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'warden') AND
  role = 'student'
);

-- Advisors can view student profiles
CREATE POLICY "Advisors can view student profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'advisor') AND
  role = 'student'
);

-- HODs can view student and staff profiles
CREATE POLICY "HODs can view profiles"
ON public.profiles
FOR SELECT
USING (
  public.has_role(auth.uid(), 'hod')
);

-- Principal can view all profiles
CREATE POLICY "Principal can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'principal'));

-- Step 5: Update other table policies to use has_role function

-- Update outing_requests policies
DROP POLICY IF EXISTS "Staff can view requests based on role" ON public.outing_requests;

CREATE POLICY "Staff can view outing requests"
ON public.outing_requests
FOR SELECT
USING (
  student_id = auth.uid() OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'warden') OR
  public.has_role(auth.uid(), 'advisor') OR
  public.has_role(auth.uid(), 'hod')
);

DROP POLICY IF EXISTS "Staff can update requests for approval" ON public.outing_requests;

CREATE POLICY "Staff can update outing requests"
ON public.outing_requests
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'warden') OR
  public.has_role(auth.uid(), 'advisor') OR
  public.has_role(auth.uid(), 'hod')
);

-- Update approval_history policies
DROP POLICY IF EXISTS "Approvers can create approval history" ON public.approval_history;

CREATE POLICY "Staff can create approval history"
ON public.approval_history
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'warden') OR
  public.has_role(auth.uid(), 'advisor') OR
  public.has_role(auth.uid(), 'hod')
);

DROP POLICY IF EXISTS "Approval history visible to staff and request owners" ON public.approval_history;

CREATE POLICY "Staff and owners can view approval history"
ON public.approval_history
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'warden') OR
  public.has_role(auth.uid(), 'advisor') OR
  public.has_role(auth.uid(), 'hod') OR
  public.has_role(auth.uid(), 'principal') OR
  request_id IN (
    SELECT id FROM outing_requests WHERE student_id = auth.uid()
  )
);

-- Update complaints policies
DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;

CREATE POLICY "Admins can update complaints via user_roles"
ON public.complaints
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Step 6: Fix anonymous complaints - mask submitted_by for anonymous complaints
CREATE OR REPLACE VIEW public.safe_complaints AS
SELECT 
  id,
  title,
  description,
  category,
  status,
  CASE WHEN is_anonymous THEN NULL ELSE submitted_by END as submitted_by,
  is_anonymous,
  created_at,
  updated_at,
  responded_by,
  responded_at,
  admin_response
FROM public.complaints;

-- Step 7: Update notices policy to require authentication and enforce target_roles
DROP POLICY IF EXISTS "Everyone can view notices" ON public.notices;

CREATE POLICY "Authenticated users can view notices for their role"
ON public.notices
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY(target_roles)
  )
);

-- Keep admin policy
DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;

CREATE POLICY "Admins can manage notices via user_roles"
ON public.notices
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 8: Update rooms policies
DROP POLICY IF EXISTS "Only admins can manage rooms" ON public.rooms;

CREATE POLICY "Admins can manage rooms via user_roles"
ON public.rooms
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Warden can update key assignments" ON public.rooms;

CREATE POLICY "Warden can update rooms via user_roles"
ON public.rooms
FOR UPDATE
USING (public.has_role(auth.uid(), 'warden'));

-- Step 9: Update departments policies
DROP POLICY IF EXISTS "Only admins can manage departments" ON public.departments;

CREATE POLICY "Admins can manage departments via user_roles"
ON public.departments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 10: Update admin_transfer_requests policies
DROP POLICY IF EXISTS "Admins manage admin transfer requests (all)" ON public.admin_transfer_requests;

CREATE POLICY "Admins manage transfer requests via user_roles"
ON public.admin_transfer_requests
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 11: Create RLS policies for user_roles table itself
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Step 12: Update get_current_user_role to use user_roles table
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_result user_role;
BEGIN
  SELECT role INTO user_role_result
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role_result;
END;
$$;

-- Step 13: Update handle_new_user trigger to insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $$
DECLARE
  user_role_value user_role;
  is_approved_value boolean;
BEGIN
  -- Determine role and approval status
  user_role_value := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student');
  is_approved_value := CASE 
    WHEN user_role_value = 'student' THEN true
    ELSE false
  END;

  -- Insert profile
  INSERT INTO public.profiles (user_id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_role_value,
    is_approved_value
  );

  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;