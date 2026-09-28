-- 0022_is_staff_membership_only.sql
-- Rewrites public.is_staff() so it no longer reads public.staff.role, which
-- 0018_drop_manager_role.sql dropped.
--
-- Run TWENTY-SECOND, after 0021_admin_staff_stays_bucket_writes.sql.
-- Idempotent: safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this exists
-- ---------------------------------------------------------------------------
-- public.is_staff(min_role) was created by the customer-site repo's
-- 0015_staff_catalog_writes.sql, so no migration in THIS repo defines it. The
-- live `stays` bucket policies (and possibly others) call it. 0018 rewrote the
-- two admin_* functions that mentioned the tier, then dropped staff.role, but
-- is_staff() was missed. Postgres does not re-check a function body when a
-- column it uses is dropped, so is_staff() kept existing and now raises
-- "column role does not exist" every time it is called.
--
-- Storage reports that error as 503 DatabaseSchemaMismatch ("SQL function
-- is_staff"), so every photo upload failed. Adding 0021's policies did not
-- help: Postgres still evaluates the old policy, and its error aborts the
-- whole statement.
--
-- ---------------------------------------------------------------------------
-- Why keep the signature instead of dropping the function
-- ---------------------------------------------------------------------------
-- Existing policies depend on it (DROP FUNCTION would need CASCADE and would
-- silently remove them), and its exact signature lives in the other repo. The
-- DO block below re-creates every public.is_staff overload with its own
-- arguments, defaults, and security setting intact, and only swaps the body
-- to "has a row in public.staff" (the whole permission model since 0018). The
-- min_role argument is accepted and ignored so existing calls like
-- is_staff('manager') keep working.

do $$
declare
    fn record;
begin
    for fn in
        select p.oid,
               pg_get_function_arguments(p.oid) as args,
               p.prosecdef
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'is_staff'
    loop
        execute format(
            $f$
            create or replace function public.is_staff(%s)
            returns boolean
            language sql
            stable
            %s
            set search_path = ''
            as $body$
                select exists (select 1 from public.staff where id = auth.uid());
            $body$
            $f$,
            fn.args,
            case when fn.prosecdef then 'security definer' else 'security invoker' end
        );
    end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------

-- Expect at least one row, and body_mentions_role = false on every row.
-- prosrc (body only), not pg_get_functiondef: the latter includes the
-- min_role argument name and would always match.
select pg_get_function_identity_arguments(p.oid) as args,
       p.prosrc ilike '%role%' as body_mentions_role
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_staff';

-- Every policy that still calls is_staff(). All of them are now membership-only.
select schemaname, tablename, policyname, cmd
from pg_policies
where qual ilike '%is_staff%' or with_check ilike '%is_staff%';
