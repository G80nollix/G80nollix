-- Fix privacy issue in booking_details RLS policies
-- Problem: Public policy "Anyone can view product booking_details for availability check" 
--          exposes sensitive data (user_id, price, delivery_method, etc.) to anyone
-- Solution: Remove public policy, add admin-only policy, create secure SQL function

-- Step 1: Add admin-only SELECT policy FIRST (before removing public policy)
CREATE POLICY "Admins can view all booking_details"
  ON public.booking_details
  FOR SELECT
  TO authenticated
  USING (is_admin_user());

-- Step 2: Remove the problematic public policy
DROP POLICY IF EXISTS "Anyone can view product booking_details for availability check" 
  ON public.booking_details;

-- Step 3: Create secure SQL function for availability check
-- This function bypasses RLS (SECURITY DEFINER) but only returns unit_id and is_available
-- It does NOT expose sensitive data like user_id, price, delivery_method, etc.
CREATE OR REPLACE FUNCTION public.check_unit_availability(
  p_unit_ids uuid[],
  p_start_date timestamp with time zone,
  p_end_date timestamp with time zone
)
RETURNS TABLE (
  unit_id uuid,
  is_available boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as unit_id,
    NOT EXISTS (
      SELECT 1 
      FROM public.booking_details bd
      INNER JOIN public.bookings b ON b.id = bd.booking_id
      WHERE bd.unit_id = u.id
        AND bd.start_date <= p_end_date
        AND bd.end_date >= p_start_date
        AND b.status IN ('cart', 'confirmed')
        AND b.cart = false
    ) as is_available
  FROM unnest(p_unit_ids) u(id);
END;
$$;

-- Step 4: Grant execute permission to anon and authenticated users
-- This allows the frontend to call the function without exposing sensitive data
GRANT EXECUTE ON FUNCTION public.check_unit_availability(uuid[], timestamp with time zone, timestamp with time zone)
  TO anon, authenticated;

-- Step 5: Create additional function for getting booking_details dates (without sensitive data)
-- This function is needed for calendar/availability display where dates are required
-- It only returns: id, booking_id, unit_id, start_date, end_date (no user_id, price, etc.)
CREATE OR REPLACE FUNCTION public.get_booking_details_dates(
  p_unit_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  booking_id uuid,
  unit_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bd.id,
    bd.booking_id,
    bd.unit_id,
    bd.start_date,
    bd.end_date
  FROM public.booking_details bd
  INNER JOIN public.bookings b ON b.id = bd.booking_id
  WHERE bd.unit_id = ANY(p_unit_ids)
    AND b.status IN ('cart', 'confirmed')
    AND b.cart = false;  -- Solo prenotazioni confermate
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_booking_details_dates(uuid[])
  TO anon, authenticated;

-- Step 6: Create function for getting booking_details with time slots (for BookingDialog)
-- This function returns dates and time slots without sensitive data
CREATE OR REPLACE FUNCTION public.get_booking_details_with_time_slots(
  p_unit_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  booking_id uuid,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  ritiro_fasciaoraria_inizio text,
  ritiro_fasciaoraria_fine text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bd.booking_id,
    bd.start_date,
    bd.end_date,
    bd.ritiro_fasciaoraria_inizio,
    bd.ritiro_fasciaoraria_fine
  FROM public.booking_details bd
  INNER JOIN public.bookings b ON b.id = bd.booking_id
  WHERE bd.unit_id = p_unit_id
    AND bd.start_date >= p_start_date::timestamp with time zone
    AND bd.end_date <= p_end_date::timestamp with time zone
    AND b.status IN ('cart', 'confirmed')
    AND b.cart = false;  -- Solo prenotazioni confermate
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_booking_details_with_time_slots(uuid, date, date)
  TO anon, authenticated;

