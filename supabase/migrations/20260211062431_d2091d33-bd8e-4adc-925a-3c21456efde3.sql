
-- Add new departments (Mechanical Engineering already exists)
INSERT INTO public.departments (name, code) VALUES
  ('Aeronautical Engineering', 'AE'),
  ('Architecture', 'ARCH'),
  ('Computer Science and Business Systems', 'CSBS')
ON CONFLICT DO NOTHING;

-- Add guardian_email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_email text;
