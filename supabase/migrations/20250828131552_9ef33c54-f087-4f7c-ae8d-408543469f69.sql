-- Create enums (only if they don't exist)
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('admin', 'warden', 'advisor', 'hod', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.outing_type AS ENUM ('local', 'hometown');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_stage AS ENUM ('advisor', 'hod', 'warden', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create departments table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    room_number TEXT NOT NULL UNIQUE,
    floor INTEGER NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 2,
    occupied INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'student',
    student_id TEXT UNIQUE,
    staff_id TEXT UNIQUE,
    department_id UUID REFERENCES public.departments(id),
    room_id UUID REFERENCES public.rooms(id),
    year_of_study INTEGER,
    guardian_name TEXT,
    guardian_phone TEXT,
    local_address TEXT,
    permanent_address TEXT,
    photo_url TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create outing_requests table
CREATE TABLE IF NOT EXISTS public.outing_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    outing_type outing_type NOT NULL,
    reason TEXT NOT NULL,
    destination TEXT NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    from_time TIME,
    to_time TIME,
    contact_person TEXT,
    contact_phone TEXT,
    current_stage approval_stage NOT NULL DEFAULT 'advisor',
    final_status request_status NOT NULL DEFAULT 'pending',
    advisor_approved_at TIMESTAMP WITH TIME ZONE,
    advisor_approved_by UUID REFERENCES public.profiles(user_id),
    hod_approved_at TIMESTAMP WITH TIME ZONE,
    hod_approved_by UUID REFERENCES public.profiles(user_id),
    warden_approved_at TIMESTAMP WITH TIME ZONE,
    warden_approved_by UUID REFERENCES public.profiles(user_id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejected_by UUID REFERENCES public.profiles(user_id),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notices table
CREATE TABLE IF NOT EXISTS public.notices (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    target_roles user_role[] NOT NULL DEFAULT ARRAY['student']::user_role[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    submitted_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_response TEXT,
    responded_by UUID REFERENCES public.profiles(user_id),
    responded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_history table
CREATE TABLE IF NOT EXISTS public.approval_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.outing_requests(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    stage approval_stage NOT NULL,
    action TEXT NOT NULL,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- Create function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role AS $$
BEGIN
    RETURN (SELECT role FROM public.profiles WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR UPDATE USING (public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can insert profile during registration" ON public.profiles;
CREATE POLICY "Anyone can insert profile during registration" ON public.profiles
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Department policies
DROP POLICY IF EXISTS "Everyone can view departments" ON public.departments;
CREATE POLICY "Everyone can view departments" ON public.departments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage departments" ON public.departments;
CREATE POLICY "Only admins can manage departments" ON public.departments
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Room policies
DROP POLICY IF EXISTS "Everyone can view rooms" ON public.rooms;
CREATE POLICY "Everyone can view rooms" ON public.rooms
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only admins can manage rooms" ON public.rooms;
CREATE POLICY "Only admins can manage rooms" ON public.rooms
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Outing request policies
DROP POLICY IF EXISTS "Students can view their own requests" ON public.outing_requests;
CREATE POLICY "Students can view their own requests" ON public.outing_requests
    FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Staff can view requests based on role" ON public.outing_requests;
CREATE POLICY "Staff can view requests based on role" ON public.outing_requests
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'warden', 'advisor', 'hod'));

DROP POLICY IF EXISTS "Students can create their own requests" ON public.outing_requests;
CREATE POLICY "Students can create their own requests" ON public.outing_requests
    FOR INSERT WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Staff can update requests for approval" ON public.outing_requests;
CREATE POLICY "Staff can update requests for approval" ON public.outing_requests
    FOR UPDATE USING (public.get_current_user_role() IN ('admin', 'warden', 'advisor', 'hod'));

-- Notice policies
DROP POLICY IF EXISTS "Everyone can view notices" ON public.notices;
CREATE POLICY "Everyone can view notices" ON public.notices
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;
CREATE POLICY "Admins can manage notices" ON public.notices
    FOR ALL USING (public.get_current_user_role() = 'admin');

-- Complaint policies
DROP POLICY IF EXISTS "Users can view their own complaints" ON public.complaints;
CREATE POLICY "Users can view their own complaints" ON public.complaints
    FOR SELECT USING (submitted_by = auth.uid() OR public.get_current_user_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can submit complaints" ON public.complaints;
CREATE POLICY "Anyone can submit complaints" ON public.complaints
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update complaints" ON public.complaints;
CREATE POLICY "Admins can update complaints" ON public.complaints
    FOR UPDATE USING (public.get_current_user_role() = 'admin');

-- Approval history policies
DROP POLICY IF EXISTS "Everyone can view approval history" ON public.approval_history;
CREATE POLICY "Everyone can view approval history" ON public.approval_history
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Approvers can create approval history" ON public.approval_history;
CREATE POLICY "Approvers can create approval history" ON public.approval_history
    FOR INSERT WITH CHECK (public.get_current_user_role() IN ('admin', 'warden', 'advisor', 'hod'));

-- Create functions and triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_outing_requests_updated_at ON public.outing_requests;
CREATE TRIGGER update_outing_requests_updated_at
    BEFORE UPDATE ON public.outing_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notices_updated_at ON public.notices;
CREATE TRIGGER update_notices_updated_at
    BEFORE UPDATE ON public.notices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_complaints_updated_at ON public.complaints;
CREATE TRIGGER update_complaints_updated_at
    BEFORE UPDATE ON public.complaints
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create profile creation function and trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'student')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample data
INSERT INTO public.departments (name, code) VALUES
    ('Computer Science Engineering', 'CSE'),
    ('Electronics and Communication Engineering', 'ECE'),
    ('Mechanical Engineering', 'ME'),
    ('Civil Engineering', 'CE'),
    ('Electrical Engineering', 'EE'),
    ('Information Technology', 'IT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rooms (room_number, floor, capacity) VALUES
    ('101', 1, 2), ('102', 1, 2), ('103', 1, 2), ('104', 1, 2), ('105', 1, 2),
    ('201', 2, 2), ('202', 2, 2), ('203', 2, 2), ('204', 2, 2), ('205', 2, 2),
    ('301', 3, 2), ('302', 3, 2), ('303', 3, 2), ('304', 3, 2), ('305', 3, 2)
ON CONFLICT (room_number) DO NOTHING;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
DROP POLICY IF EXISTS "Profile photos are publicly accessible" ON storage.objects;
CREATE POLICY "Profile photos are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
CREATE POLICY "Users can upload their own profile photo" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-photos' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
CREATE POLICY "Users can update their own profile photo" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'profile-photos' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );