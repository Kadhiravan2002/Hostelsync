-- Drop the existing view
DROP VIEW IF EXISTS public.safe_complaints;

-- Create a SECURITY DEFINER function to replace the view
CREATE OR REPLACE FUNCTION public.get_safe_complaints()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  status text,
  submitted_by uuid,
  is_anonymous boolean,
  admin_response text,
  responded_by uuid,
  responded_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    c.updated_at
  FROM public.complaints c
  WHERE 
    -- Staff can see all complaints
    (public.has_role(auth.uid(), 'admin') OR
     public.has_role(auth.uid(), 'warden') OR
     public.has_role(auth.uid(), 'advisor') OR
     public.has_role(auth.uid(), 'hod') OR
     public.has_role(auth.uid(), 'principal'))
    OR
    -- Users can see their own non-anonymous complaints
    (c.submitted_by = auth.uid() AND NOT c.is_anonymous)
    OR
    -- Users can see anonymous complaints they submitted (by checking it's theirs)
    (c.submitted_by = auth.uid() AND c.is_anonymous);
$$;