-- Persist the planned journey origin and primary destination for each field trip.
-- Nullable columns preserve compatibility with historical trips created before route planning.
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS start_location text,
  ADD COLUMN IF NOT EXISTS destination_city text;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_start_location_length_check
    CHECK (start_location IS NULL OR char_length(btrim(start_location)) BETWEEN 2 AND 200),
  ADD CONSTRAINT trips_destination_city_length_check
    CHECK (destination_city IS NULL OR char_length(btrim(destination_city)) BETWEEN 2 AND 120);

COMMENT ON COLUMN public.trips.start_location IS
  'Employee-declared journey starting point, such as office, home, or warehouse. Not live GPS.';
COMMENT ON COLUMN public.trips.destination_city IS
  'Primary destination city or territory for the planned field trip.';
