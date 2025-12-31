-- Drop existing profile photo policies
DROP POLICY IF EXISTS "Users can upload their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;

-- Create new policies for profile photos uploaded to bucket root
CREATE POLICY "Users can upload own profile photo to root"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  name LIKE (auth.uid()::text || '.%') AND
  NOT name LIKE '%/%'  -- No folder path, root only
);

CREATE POLICY "Users can update own profile photo in root"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  name LIKE (auth.uid()::text || '.%') AND
  NOT name LIKE '%/%'
)
WITH CHECK (
  bucket_id = 'profile-photos' AND
  name LIKE (auth.uid()::text || '.%') AND
  NOT name LIKE '%/%'
);

CREATE POLICY "Everyone can view root profile photos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'profile-photos' AND
  NOT name LIKE 'complaints/%'  -- Exclude complaint photos from public view
);