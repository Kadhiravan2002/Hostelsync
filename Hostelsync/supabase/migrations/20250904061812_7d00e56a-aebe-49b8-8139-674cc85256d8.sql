-- Fix incorrect routing: local outings should go to warden, not advisor
UPDATE outing_requests 
SET current_stage = 'warden' 
WHERE outing_type = 'local' AND current_stage = 'advisor';