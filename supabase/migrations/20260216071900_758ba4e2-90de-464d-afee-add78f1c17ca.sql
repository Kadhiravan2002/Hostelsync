
-- Drop and recreate the student_live_status view with correct movement logic
DROP VIEW IF EXISTS public.student_live_status;

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
    -- 1) OUTSIDE: currently within an approved outing window
    WHEN latest_outing.id IS NOT NULL
      AND now() AT TIME ZONE 'Asia/Kolkata' >= (latest_outing.from_date + latest_outing.from_time)
      AND now() AT TIME ZONE 'Asia/Kolkata' <= (latest_outing.to_date + latest_outing.to_time)
    THEN 'outside'

    -- 2) OVERDUE: outing ended but no present attendance today
    WHEN latest_outing.id IS NOT NULL
      AND now() AT TIME ZONE 'Asia/Kolkata' > (latest_outing.to_date + latest_outing.to_time)
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.student_id = p.user_id
          AND a.date = (now() AT TIME ZONE 'Asia/Kolkata')::date
          AND a.status = 'present'
      )
    THEN 'overdue'

    -- 3) Default: Inside
    ELSE 'inside'
  END AS movement_status
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT o.id, o.from_date, o.from_time, o.to_date, o.to_time
  FROM public.outing_requests o
  WHERE o.student_id = p.user_id
    AND o.final_status = 'approved'
    AND o.from_time IS NOT NULL
    AND o.to_time IS NOT NULL
    -- Only consider outings that started today or are still relevant (end date >= today)
    AND o.to_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date
  ORDER BY o.from_date DESC, o.from_time DESC
  LIMIT 1
) latest_outing ON true
WHERE p.role = 'student';
