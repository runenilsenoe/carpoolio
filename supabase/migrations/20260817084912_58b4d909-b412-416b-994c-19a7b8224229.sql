
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME,
  destination TEXT,
  share_code TEXT NOT NULL UNIQUE,
  created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  available_seats INTEGER NOT NULL CHECK (available_seats >= 0 AND available_seats <= 20),
  pickup_location TEXT NOT NULL,
  departure_time TIME,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, driver_user_id)
);
GRANT ALL ON public.cars TO service_role;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER cars_updated_at BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX cars_event_id_idx ON public.cars(event_id);

CREATE TABLE public.car_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (car_id, user_id)
);
GRANT ALL ON public.car_members TO service_role;
ALTER TABLE public.car_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX car_members_car_id_idx ON public.car_members(car_id);

-- Atomic seat-safe join. Locks the car row so two people cannot take the last seat.
CREATE OR REPLACE FUNCTION public.join_car(_car_id UUID, _user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats INTEGER;
  v_driver UUID;
  v_event UUID;
  v_taken INTEGER;
BEGIN
  SELECT available_seats, driver_user_id, event_id INTO v_seats, v_driver, v_event
  FROM public.cars WHERE id = _car_id FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_driver = _user_id THEN RETURN 'is_driver'; END IF;

  IF EXISTS (SELECT 1 FROM public.car_members WHERE car_id = _car_id AND user_id = _user_id) THEN
    RETURN 'already_member';
  END IF;

  SELECT count(*) INTO v_taken FROM public.car_members WHERE car_id = _car_id;
  IF v_taken >= v_seats THEN RETURN 'full'; END IF;

  -- Leave any other car in the same event first
  DELETE FROM public.car_members cm
  USING public.cars c
  WHERE cm.car_id = c.id AND cm.user_id = _user_id AND c.event_id = v_event;

  INSERT INTO public.car_members (car_id, user_id) VALUES (_car_id, _user_id);
  RETURN 'ok';
END; $$;

REVOKE ALL ON FUNCTION public.join_car(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_car(UUID, UUID) TO service_role;
