-- Drop the existing unique constraint on room_number
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_room_number_key;

-- Add a unique constraint on (room_number, hostel_type) combination
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_number_hostel_unique UNIQUE (room_number, hostel_type);

-- Create rooms for girls hostel with same structure as boys hostel
-- Ground floor: rooms 1-33
INSERT INTO public.rooms (room_number, floor, capacity, occupied, hostel_type)
SELECT 
  room_number::text,
  0,
  2,
  0,
  'girls'::hostel_type
FROM generate_series(1, 33) AS room_number;

-- First floor: rooms 101-133
INSERT INTO public.rooms (room_number, floor, capacity, occupied, hostel_type)
SELECT 
  (100 + room_number)::text,
  1,
  2,
  0,
  'girls'::hostel_type
FROM generate_series(1, 33) AS room_number;

-- Second floor: rooms 201-233
INSERT INTO public.rooms (room_number, floor, capacity, occupied, hostel_type)
SELECT 
  (200 + room_number)::text,
  2,
  2,
  0,
  'girls'::hostel_type
FROM generate_series(1, 33) AS room_number;

-- Third floor: rooms 301-333
INSERT INTO public.rooms (room_number, floor, capacity, occupied, hostel_type)
SELECT 
  (300 + room_number)::text,
  3,
  2,
  0,
  'girls'::hostel_type
FROM generate_series(1, 33) AS room_number;