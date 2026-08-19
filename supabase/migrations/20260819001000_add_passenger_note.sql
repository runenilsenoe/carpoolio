ALTER TABLE public.car_members
ADD COLUMN note TEXT CHECK (char_length(note) <= 200);
