
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  user_role_value user_role;
  is_approved_value boolean;
  hostel_type_value hostel_type;
BEGIN
  user_role_value := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student');
  is_approved_value := CASE 
    WHEN user_role_value = 'student' THEN true
    ELSE false
  END;

  IF NEW.raw_user_meta_data->>'hostel_type' IS NOT NULL AND NEW.raw_user_meta_data->>'hostel_type' != '' THEN
    hostel_type_value := (NEW.raw_user_meta_data->>'hostel_type')::public.hostel_type;
  ELSE
    hostel_type_value := NULL;
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name, role, is_approved, hostel_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_role_value,
    is_approved_value,
    hostel_type_value
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
