import { useMutation } from "@tanstack/react-query";
import supabase from "../../../supabase/supabase";

const getBookingAccessCode = async (bookingId: number): Promise<string | null> => {
    const { data, error } = await supabase.rpc("admin_booking_access_code", {
        p_booking_id: bookingId,
    });

    if (error) {
        console.error(error);
        throw new Error("server error, access code could not be loaded");
    }

    return data ?? null;
};

/**
 * Reveals one booking's self check-in code.
 *
 * A mutation rather than a query, deliberately: every call writes a row to
 * public.admin_access_code_log (see 0020_admin_booking_access_code.sql), so it must fire
 * exactly once per explicit human action — never on mount, never on a cache refetch, never on
 * window refocus. Nothing is cached either; closing and reopening the modal re-reveals, and
 * that second view is a second audited event, which is the correct record.
 *
 * A non-staff session gets null back rather than an error, and nothing is logged.
 *
 * @example
 * const { revealAccessCode, accessCode, isRevealing } = useBookingAccessCode();
 * <button onClick={() => revealAccessCode(booking.bookingId)}>Show</button>
 */
export function useBookingAccessCode() {
    const {
        mutate: revealAccessCode,
        data: accessCode,
        isPending: isRevealing,
        // `isRevealed` is what separates "not asked yet" from "asked, and the answer was
        // null" — the RPC returns null both for a booking with no code and for a caller
        // without a public.staff row. Without it a null answer is indistinguishable from an
        // untouched button, which reads as a broken control.
        isSuccess: isRevealed,
        error,
    } = useMutation({
        mutationFn: getBookingAccessCode,
    });

    return { revealAccessCode, accessCode, isRevealing, isRevealed, error };
}
