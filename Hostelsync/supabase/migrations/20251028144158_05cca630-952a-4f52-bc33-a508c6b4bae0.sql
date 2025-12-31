-- Add storage policies for complaint photos in profile-photos bucket

-- Allow authenticated users to upload complaint photos
CREATE POLICY "Students can upload complaint photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = 'complaints'
);

-- Allow users to view complaint photos
CREATE POLICY "Anyone can view complaint photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = 'complaints'
);

-- Allow admins to delete complaint photos
CREATE POLICY "Admins can delete complaint photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos' AND
  (storage.foldername(name))[1] = 'complaints' AND
  public.has_role(auth.uid(), 'admin'::user_role)
);