-- First, let's add key tracking fields to the profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS key_number TEXT CHECK (key_number IN ('A', 'B')),
ADD COLUMN IF NOT EXISTS key_issued_at TIMESTAMP WITH TIME ZONE;

-- Update rooms table structure
ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS key_a_holder UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS key_b_holder UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_room_id ON public.profiles(room_id);
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON public.rooms(floor);

-- Function to populate all 333 rooms if they don't exist
DO $$
DECLARE
  room_num TEXT;
  floor_num INT;
BEGIN
  -- Ground Floor: Rooms 1-33
  FOR i IN 1..33 LOOP
    room_num := i::TEXT;
    floor_num := 0;
    INSERT INTO public.rooms (room_number, floor, capacity, occupied)
    VALUES (room_num, floor_num, 2, 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- First Floor: Rooms 100-133
  FOR i IN 100..133 LOOP
    room_num := i::TEXT;
    floor_num := 1;
    INSERT INTO public.rooms (room_number, floor, capacity, occupied)
    VALUES (room_num, floor_num, 2, 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Second Floor: Rooms 200-233
  FOR i IN 200..233 LOOP
    room_num := i::TEXT;
    floor_num := 2;
    INSERT INTO public.rooms (room_number, floor, capacity, occupied)
    VALUES (room_num, floor_num, 2, 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  -- Third Floor: Rooms 300-333
  FOR i IN 300..333 LOOP
    room_num := i::TEXT;
    floor_num := 3;
    INSERT INTO public.rooms (room_number, floor, capacity, occupied)
    VALUES (room_num, floor_num, 2, 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Create trigger to update room occupied count
CREATE OR REPLACE FUNCTION public.update_room_occupancy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.room_id IS NOT NULL THEN
      UPDATE public.rooms
      SET occupied = (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE room_id = NEW.room_id
      )
      WHERE id = NEW.room_id;
    END IF;
    
    IF TG_OP = 'UPDATE' AND OLD.room_id IS NOT NULL AND OLD.room_id != NEW.room_id THEN
      UPDATE public.rooms
      SET occupied = (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE room_id = OLD.room_id
      )
      WHERE id = OLD.room_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.room_id IS NOT NULL THEN
      UPDATE public.rooms
      SET occupied = (
        SELECT COUNT(*)
        FROM public.profiles
        WHERE room_id = OLD.room_id
      )
      WHERE id = OLD.room_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_room_occupancy ON public.profiles;
CREATE TRIGGER trigger_update_room_occupancy
AFTER INSERT OR UPDATE OF room_id OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_room_occupancy();

-- Warden can manage keys (drop and recreate to avoid conflict)
DROP POLICY IF EXISTS "Warden can update key assignments" ON public.rooms;
CREATE POLICY "Warden can update key assignments"
ON public.rooms
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'warden'::user_role);