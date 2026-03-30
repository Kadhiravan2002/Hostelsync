
-- Create a database VIEW that dynamically computes student movement status
-- No manual status column, no cron jobs - purely computed from outing_requests + attendance

CREATE OR REPLACE VIEW public.student_live_status AS
SELECT
  p.user_id,
  p.full_name,
  p.student_id,
  p.hostel_type,
  p.department_id,
  p.room_id,
  p.photo_url,
  CASE
    -- Active approved outing: current datetime falls within the outing period
    WHEN EXISTS (
      SELECT 1 FROM public.outing_requests o
      WHERE o.student_id = p.user_id
        AND o.final_status = 'approved'
        AND (
          -- Local outing with times: same day, within time window
          (o.outing_type = 'local'
            AND CURRENT_DATE = o.from_date
            AND o.from_time IS NOT NULL
            AND o.to_time IS NOT NULL
            AND CURRENT_TIME >= o.from_time
            AND CURRENT_TIME <= o.to_time)
          OR
          -- Hometown outing: within date range (full days)
          (o.outing_type = 'hometown'
            AND CURRENT_DATE >= o.from_date
            AND CURRENT_DATE <= o.to_date)
        )
    ) THEN 'outside'

    -- Overdue: approved outing expired but no present attendance today
    WHEN EXISTS (
      SELECT 1 FROM public.outing_requests o
      WHERE o.student_id = p.user_id
        AND o.final_status = 'approved'
        AND (
          -- Local outing: past return time on outing day
          (o.outing_type = 'local'
            AND CURRENT_DATE = o.to_date
            AND o.to_time IS NOT NULL
            AND CURRENT_TIME > o.to_time)
          OR
          -- Hometown outing: past return date
          (o.outing_type = 'hometown'
            AND CURRENT_DATE > o.to_date)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.attendance a
      WHERE a.student_id = p.user_id
        AND a.date = CURRENT_DATE
        AND a.status = 'present'
    ) THEN 'overdue'

    -- Default: inside
    ELSE 'inside'
  END AS movement_status
FROM public.profiles p
WHERE p.role = 'student';

-- Grant access to authenticated users (view inherits RLS from underlying tables)
GRANT SELECT ON public.student_live_status TO authenticated;
GRANT SELECT ON public.student_live_status TO anon;
