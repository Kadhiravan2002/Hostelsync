
-- 1. Drop and recreate get_safe_complaints with hostel_type
DROP FUNCTION IF EXISTS public.get_safe_complaints();

CREATE FUNCTION public.get_safe_complaints()
 RETURNS TABLE(id uuid, title text, description text, category text, status text, submitted_by uuid, is_anonymous boolean, admin_response text, responded_by uuid, responded_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, hostel_type hostel_type)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.title,
    c.description,
    c.category,
    c.status,
    CASE 
      WHEN c.is_anonymous THEN NULL 
      ELSE c.submitted_by 
    END as submitted_by,
    c.is_anonymous,
    c.admin_response,
    c.responded_by,
    c.responded_at,
    c.created_at,
    c.updated_at,
    c.hostel_type
  FROM public.complaints c
  WHERE 
    (public.has_role(auth.uid(), 'admin') OR
     public.has_role(auth.uid(), 'warden') OR
     public.has_role(auth.uid(), 'advisor') OR
     public.has_role(auth.uid(), 'hod') OR
     public.has_role(auth.uid(), 'principal'))
    OR
    (c.submitted_by = auth.uid() AND NOT c.is_anonymous)
    OR
    (c.submitted_by = auth.uid() AND c.is_anonymous);
$function$;

-- 2. Drop overly-broad warden policies that bypass hostel isolation
DROP POLICY IF EXISTS "Wardens can view student profiles" ON public.profiles;
DROP POLICY IF EXISTS "warden can select profiles" ON public.profiles;

-- 3. Create hostel-isolated warden profile SELECT policy
CREATE POLICY "Wardens can view students in their hostel"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'warden'::user_role) 
  AND (
    user_id = auth.uid()
    OR (
      role = 'student'::user_role
      AND hostel_type = (
        SELECT p.hostel_type FROM public.profiles p WHERE p.user_id = auth.uid()
      )
    )
  )
);

-- 4. Drop overly-broad warden outing/complaint policies
DROP POLICY IF EXISTS "warden can select outing requests" ON public.outing_requests;
DROP POLICY IF EXISTS "warden can select complaints" ON public.complaints;

-- 5. Ensure rooms unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rooms_room_number_hostel_type_key'
  ) THEN
    ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_number_hostel_type_key UNIQUE (room_number, hostel_type);
  END IF;
END $$;
