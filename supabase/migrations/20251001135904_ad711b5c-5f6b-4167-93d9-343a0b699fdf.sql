-- Update the handle_new_user function to auto-approve students but not staff
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, role, is_approved)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'),
        -- Auto-approve students, but staff need admin approval
        CASE 
            WHEN COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student') = 'student' THEN true
            ELSE false
        END
    );
    RETURN NEW;
END;
$function$;

-- Create a function to check if user is approved
CREATE OR REPLACE FUNCTION public.is_user_approved(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
    SELECT COALESCE(
        (SELECT is_approved FROM public.profiles WHERE user_id = user_uuid),
        false
    );
$$;