-- ---------------------------------------------------------------------------
-- 0020 — admin_booking_access_code(): one code, on demand, always logged
-- ---------------------------------------------------------------------------
-- `bookings.access_code` is the 8-char hex code a guest scans or types to self
-- check in. Anyone holding it can complete a check-in without logging in, so
-- ADMIN-PANEL-CONTEXT2.md § "public.bookings" flags it as lightly sensitive.
--
-- Staff genuinely need it — a guest who lost their code calls the front desk,
-- and that is exactly what industry PMS tooling exposes to staff too. The
-- mitigations there are unique-per-booking codes, stay-bounded validity,
-- role scoping, and activity logs. Seaspace has ONE staff tier (see
-- 0018_drop_manager_role.sql), so role scoping isn't available to us and the
-- log below is the only remaining control. That makes it load-bearing, not
-- decorative.
--
-- The thing this design avoids is the code riding along in a broad payload:
-- admin_booking_roster() returns whole date ranges, so a code column there
-- would land every code in range in the browser's React Query cache on every
-- page load, including for bookings nobody opens. One booking, one explicit
-- human action, one log row.
--
-- plpgsql rather than sql, for the same reason as admin_export_guests() in
-- 0014: this function has a side effect, which the `language sql` read
-- functions deliberately avoid so their behaviour stays "just a scoped read".
-- ---------------------------------------------------------------------------

begin;

create table if not exists public.admin_access_code_log (
    id          bigint generated always as identity primary key,
    staff_id    uuid   not null references public.staff(id),
    booking_id  bigint not null references public.bookings(id),
    viewed_at   timestamptz not null default now()
);

-- RLS on with no policies at all, on purpose: only the security-definer
-- function below ever writes here, and nothing in the client may read it. An
-- audit trail the audited party can edit is not an audit trail.
alter table public.admin_access_code_log enable row level security;

create or replace function public.admin_booking_access_code(p_booking_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_code text;
begin
    -- Same contract as every other admin_* function: an unauthorized caller
    -- gets an empty result, never an error. See ADMIN-PANEL-CONTEXT2.md
    -- ("pemanggil yang tidak berhak mendapat 0 baris, bukan error").
    if not exists (select 1 from public.staff where id = auth.uid()) then
        return null;
    end if;

    select access_code into v_code
    from public.bookings
    where id = p_booking_id;

    -- Nothing was disclosed, so nothing is logged — a miss here means a bad or
    -- stale booking id, not a code view.
    if v_code is null then
        return null;
    end if;

    insert into public.admin_access_code_log (staff_id, booking_id)
    values (auth.uid(), p_booking_id);

    return v_code;
end;
$$;

revoke all on function public.admin_booking_access_code(bigint) from public;
grant execute on function public.admin_booking_access_code(bigint) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Five admin functions now, all security definer. Expect 5 rows,
-- prosecdef = true: admin_booking_roster, admin_booking_financials,
-- admin_new_guests_count, admin_guest_nationality_stats, admin_export_guests,
-- plus this one — six, once this migration lands.
select proname, prosecdef
from pg_proc
where proname like 'admin_%'
order by proname;

-- RLS on, zero policies. Expect relrowsecurity = true and no rows from
-- pg_policies.
select relrowsecurity from pg_class where relname = 'admin_access_code_log';
select policyname from pg_policies where tablename = 'admin_access_code_log';

-- From a logged-in staff session: the code comes back and the log grows by
-- exactly one. From a non-staff session: null, and the count does not move.
-- select public.admin_booking_access_code(<booking_id>);
-- select count(*) from public.admin_access_code_log;
