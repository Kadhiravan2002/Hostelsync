-- Ensure room occupancy stays in sync with profiles
DROP TRIGGER IF EXISTS update_room_occupancy_trigger ON public.profiles;

CREATE TRIGGER update_room_occupancy_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_room_occupancy();