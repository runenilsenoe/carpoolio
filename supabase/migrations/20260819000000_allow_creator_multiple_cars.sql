ALTER TABLE public.cars
DROP CONSTRAINT IF EXISTS cars_event_id_driver_user_id_key;

CREATE OR REPLACE FUNCTION public.enforce_guest_car_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.events
    WHERE id = NEW.event_id AND created_by_user_id = NEW.driver_user_id
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.event_id::text),
    hashtext(NEW.driver_user_id::text)
  );

  IF EXISTS (
    SELECT 1 FROM public.cars
    WHERE event_id = NEW.event_id AND driver_user_id = NEW.driver_user_id
  ) THEN
    RAISE EXCEPTION 'A guest can add only one car per event'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cars_guest_limit ON public.cars;
CREATE TRIGGER cars_guest_limit
BEFORE INSERT ON public.cars
FOR EACH ROW EXECUTE FUNCTION public.enforce_guest_car_limit();
