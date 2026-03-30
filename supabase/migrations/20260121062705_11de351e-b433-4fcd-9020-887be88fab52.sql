-- Create hostel_type enum
CREATE TYPE public.hostel_type AS ENUM ('boys', 'girls');

-- Add hostel_type to profiles (for students and staff like wardens)
ALTER TABLE public.profiles 
ADD COLUMN hostel_type public.hostel_type NULL;

-- Add hostel_type to rooms (rooms belong to a specific hostel)
ALTER TABLE public.rooms 
ADD COLUMN hostel_type public.hostel_type NOT NULL DEFAULT 'boys';

-- Add hostel_type to notices (to target specific hostels)
ALTER TABLE public.notices 
ADD COLUMN hostel_type public.hostel_type NULL;

-- Add hostel_type to complaints (to track which hostel the complaint is from)
ALTER TABLE public.complaints 
ADD COLUMN hostel_type public.hostel_type NULL;

-- Create index for faster hostel-based queries
CREATE INDEX idx_profiles_hostel_type ON public.profiles(hostel_type);
CREATE INDEX idx_rooms_hostel_type ON public.rooms(hostel_type);
CREATE INDEX idx_complaints_hostel_type ON public.complaints(hostel_type);

-- Update existing student profiles to default to 'boys' hostel (current data)
UPDATE public.profiles SET hostel_type = 'boys' WHERE role = 'student';

-- Update existing warden profiles to default to 'boys' hostel
UPDATE public.profiles SET hostel_type = 'boys' WHERE role = 'warden';

-- Update existing complaints to 'boys' hostel
UPDATE public.complaints SET hostel_type = 'boys' WHERE hostel_type IS NULL;

COMMENT ON COLUMN public.profiles.hostel_type IS 'Hostel type for students and wardens (boys/girls)';
COMMENT ON COLUMN public.rooms.hostel_type IS 'Which hostel this room belongs to';
COMMENT ON COLUMN public.notices.hostel_type IS 'Target hostel for the notice (NULL = all hostels)';
COMMENT ON COLUMN public.complaints.hostel_type IS 'Hostel from which the complaint originated';