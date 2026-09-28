import { useQuery } from "@tanstack/react-query";
import supabase from "../../../supabase/supabase";
import { useUser } from "../../authentication/hooks/useUser";

// Client-side gate for catalog-write UI entry points (nav link, /stays routes). Not a security
// boundary by itself — the RLS policies in 0016_admin_staff_catalog_writes.sql are what actually
// enforce this — but checking here avoids a staff member who isn't provisioned yet from filling
// out a whole "Add Villa" form only to hit an RLS 401 on submit.
//
// Reads the caller's own public.staff row, which the self-read policy in
// 0014_admin_staff_access.sql already allows. .maybeSingle() (not .single()) because a
// non-staff authenticated user legitimately has zero rows there — that's an expected outcome,
// not an error.
//
// Membership is the whole answer: 0018_drop_manager_role.sql collapsed the staff/manager
// tiers, so there is nothing to read beyond "does a row exist". Selecting id rather than *
// keeps that explicit.
export const useIsStaff = () => {
    const { user, isUserLoading } = useUser();

    const { data, isPending } = useQuery({
        queryKey: ["staff", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("staff")
                .select("id")
                .eq("id", user!.id)
                .maybeSingle();

            if (error) {
                console.error(error);
                throw new Error(
                    "server error, staff status could not be checked",
                );
            }

            return data;
        },
        enabled: !!user?.id,
    });

    return {
        isStaff: !!data,
        isLoading: isUserLoading || isPending,
    };
};
