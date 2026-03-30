
-- Create email notification log table to prevent duplicate emails
CREATE TABLE public.email_notification_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone DEFAULT now(),
  error_message text
);

-- Enable RLS
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

-- Only staff can view logs
CREATE POLICY "Staff can view email logs"
ON public.email_notification_log
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR
  has_role(auth.uid(), 'warden'::user_role)
);

-- Edge function inserts via service role, but allow authenticated insert for the function
CREATE POLICY "Authenticated users can insert email logs"
ON public.email_notification_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Unique constraint to prevent duplicate emails per request
CREATE UNIQUE INDEX idx_email_log_unique_request ON public.email_notification_log (request_id);
