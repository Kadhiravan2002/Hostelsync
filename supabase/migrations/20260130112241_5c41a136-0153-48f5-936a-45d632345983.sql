-- Fix the Girls Hostel warden assignment
UPDATE profiles 
SET hostel_type = 'girls' 
WHERE email = 'luna@gmail.com' AND role = 'warden' AND hostel_type IS NULL;