-- ---------------------------------------------------------------------------
-- 0019 — admin_booking_roster() returns the guest-supplied booking details
-- ---------------------------------------------------------------------------
-- The admin panel had no read path to `guest_notes` at all, so free text the
-- guest wrote at checkout ("late arrival ~22:00", "need a baby cot") was
-- invisible to the staff who need to act on it that morning. Same for
-- `num_guests`, and for the `paid_at`/`cancelled_at` timestamps that turn a
-- one-word status into something you can reason about.
--
-- These columns all exist on public.bookings already — ADMIN-PANEL-CONTEXT2.md
-- § "public.bookings" simply doesn't list them. Nothing about the booking write
-- boundary changes here: this is still a read-only, staff-gated function, and
-- the admin panel still cannot write a single booking row.
--
-- `access_code` is deliberately NOT added. This function returns whole date
-- ranges at a time (the Bookings table pulls a range, useMonthBookingRoster
-- pulls a month), so putting the self check-in code here would ship every code
-- in range to the browser on every page load, cached, for bookings nobody ever
-- opens. It gets its own one-row, audit-logged function instead — see 0020.
--
-- create or replace cannot change a function's `returns table` signature
-- ("cannot change return type of existing function"), so this drops and
-- recreates. Run it in ONE transaction: between the drop and the create, every
-- roster read in the app fails.
-- ---------------------------------------------------------------------------

begin;

drop function if exists public.admin_booking_roster(date, date);

create function public.admin_booking_roster(p_from date, p_to date)
returns table (
    booking_id          bigint,
    stay_name           text,
    guest_name          text,
    phone_country_code  text,
    phone               text,
    start_date          date,
    end_date            date,
    status              text,
    num_guests          integer,
    guest_notes         text,
    created_at          timestamptz,
    paid_at             timestamptz,
    cancelled_at        timestamptz
)
language sql
security definer
set search_path = public
as $$
    select b.id, s.name, g.full_name, g.phone_country_code, g.phone,
           b.start_date, b.end_date, b.status,
           -- bookings.num_guests is smallint; the cast is required, not
           -- cosmetic. Without it Postgres raises a return-type mismatch on
           -- every call ("Returned type smallint does not match expected type
           -- integer"). Declaring integer here keeps the JS side unchanged —
           -- both land as a plain number in JSON — and survives the column
           -- being widened later.
           b.num_guests::integer, b.guest_notes,
           b.created_at, b.paid_at, b.cancelled_at
    from public.bookings b
    join public.guests g on g.id = b.guest_id
    join public.stays s on s.id = b.stay_id
    where exists (select 1 from public.staff st where st.id = auth.uid())
      and b.start_date <= p_to
      and b.end_date >= p_from
    order by b.start_date;
$$;

revoke all on function public.admin_booking_roster(date, date) from public;
grant execute on function public.admin_booking_roster(date, date) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Still exactly one admin_booking_roster, still security definer.
-- Expect one row, prosecdef = true.
select proname, prosecdef
from pg_proc
where proname = 'admin_booking_roster';

-- Run from a LOGGED-IN STAFF SESSION, not the SQL Editor (which runs as
-- service role and always answers differently). Expect the five new columns
-- present, and no access_code column at all.
-- select * from public.admin_booking_roster(current_date, current_date);
