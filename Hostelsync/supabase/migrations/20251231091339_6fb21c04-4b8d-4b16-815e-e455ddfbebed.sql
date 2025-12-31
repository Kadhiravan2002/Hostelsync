-- Add Principal to outing_requests SELECT policy
DROP POLICY IF EXISTS "Staff can view outing requests" ON outing_requests;

CREATE POLICY "Staff can view outing requests" 
ON outing_requests 
FOR SELECT 
USING (
  (student_id = auth.uid()) OR 
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'warden'::user_role) OR 
  has_role(auth.uid(), 'advisor'::user_role) OR 
  has_role(auth.uid(), 'hod'::user_role) OR
  has_role(auth.uid(), 'principal'::user_role)
);

-- Add Principal to approval_history SELECT policy
DROP POLICY IF EXISTS "Staff and owners can view approval history" ON approval_history;

CREATE POLICY "Staff and owners can view approval history" 
ON approval_history 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'warden'::user_role) OR 
  has_role(auth.uid(), 'advisor'::user_role) OR 
  has_role(auth.uid(), 'hod'::user_role) OR 
  has_role(auth.uid(), 'principal'::user_role) OR 
  (request_id IN (SELECT outing_requests.id FROM outing_requests WHERE outing_requests.student_id = auth.uid()))
);