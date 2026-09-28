-- 0021_admin_staff_stays_bucket_writes.sql
-- Write (INSERT/UPDATE/DELETE) RLS policies on storage.objects for the
-- `stays` bucket, scoped to public.staff.
--
-- Run TWENTY-FIRST, after 0020_admin_booking_access_code.sql.
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this exists
-- ---------------------------------------------------------------------------
-- 0016 opened the four catalog TABLES to staff but no migration in this repo
-- touches Storage. When photo uploads started failing, this was written on
-- the assumption the bucket had no write policy at all. That turned out to be
-- wrong: the customer-site repo already grants bucket writes through
-- public.is_staff(), and the real failure was that function reading the
-- staff.role column 0018 dropped — fixed in 0022_is_staff_membership_only.sql.
--
-- These policies are therefore redundant with the customer-site ones, but
-- harmless (permissive policies are OR'd) and keep the admin panel's bucket
-- access defined in this repo rather than only in the other one. Either set
-- may be dropped later; keep at least one.
--
-- ---------------------------------------------------------------------------
-- Why the staff predicate, even with a single admin
-- ---------------------------------------------------------------------------
-- This Supabase project is shared with the customer site, so every guest who
-- signs up there is also `authenticated`. A policy of just `to authenticated`
-- would let any guest upload, overwrite, or delete villa photos. Membership in
-- public.staff is the same predicate 0016 uses for the tables.
--
-- No per-user folder rule (unlike the `guests` bucket): villa photos belong to
-- the team, not to whoever uploaded them.
--
-- UPDATE is needed as well as INSERT because uploadStayImages uses
-- `upsert: true`, which Storage executes as an update when the object exists.

drop policy if exists "staff insert stays bucket" on storage.objects;
drop policy if exists "staff update stays bucket" on storage.objects;
drop policy if exists "staff delete stays bucket" on storage.objects;

create policy "staff insert stays bucket"
    on storage.objects for insert to authenticated
    with check (
        bucket_id = 'stays'
        and exists (select 1 from public.staff where id = auth.uid())
    );

create policy "staff update stays bucket"
    on storage.objects for update to authenticated
    using (
        bucket_id = 'stays'
        and exists (select 1 from public.staff where id = auth.uid())
    )
    with check (
        bucket_id = 'stays'
        and exists (select 1 from public.staff where id = auth.uid())
    );

create policy "staff delete stays bucket"
    on storage.objects for delete to authenticated
    using (
        bucket_id = 'stays'
        and exists (select 1 from public.staff where id = auth.uid())
    );

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Expect 3 rows (INSERT, UPDATE, DELETE).
select policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'staff % stays bucket'
order by cmd;

-- Review every policy on storage.objects by eye: nothing else should grant
-- writes on bucket_id = 'stays', and nothing here should touch 'guests'.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects';
