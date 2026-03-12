-- Create attendance table
CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(user_id),
  hostel_type text NOT NULL,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  marked_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_date UNIQUE (student_id, date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Wardens can view attendance for their hostel
CREATE POLICY "Wardens view own hostel attendance"
ON public.attendance FOR SELECT
USING (
  has_role(auth.uid(), 'warden'::user_role)
  AND hostel_type = (SELECT p.hostel_type::text FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Wardens can insert attendance for their hostel
CREATE POLICY "Wardens insert own hostel attendance"
ON public.attendance FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'warden'::user_role)
  AND hostel_type = (SELECT p.hostel_type::text FROM public.profiles p WHERE p.user_id = auth.uid())
  AND marked_by = auth.uid()
);

-- Wardens can update same-day attendance for their hostel
CREATE POLICY "Wardens update same-day attendance"
ON public.attendance FOR UPDATE
USING (
  has_role(auth.uid(), 'warden'::user_role)
  AND hostel_type = (SELECT p.hostel_type::text FROM public.profiles p WHERE p.user_id = auth.uid())
  AND date = CURRENT_DATE
  AND marked_by = auth.uid()
);

-- Admins full access
CREATE POLICY "Admins full access to attendance"
ON public.attendance FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role));

-- Students can view their own attendance
CREATE POLICY "Students view own attendance"
ON public.attendance FOR SELECT
USING (student_id = auth.uid());