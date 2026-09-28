import { useMemo } from "react";
import { format } from "date-fns";
import { useBookingRoster } from "./useBookingRoster";
import { BookingRosterRow } from "../types/dashboard.schema";

/**
 * Today's confirmed arrivals — guests scheduled to check in today who haven't arrived yet.
 *
 * Built on useBookingRoster (admin_booking_roster scoped to today) rather than a fourth
 * roster fetcher, so it shares that query's cache entry. The RPC filters by stay-date
 * *overlap*, which also returns guests mid-stay, so the arrival filter happens here:
 * start_date is today, and status is still `confirmed` — a `checked_in` row is someone who
 * already walked in, and no longer something the front desk needs to prepare for.
 *
 * An empty result can mean "no arrivals today" OR "the signed-in account has no
 * public.staff row" — both render as the same empty state by design (see
 * ADMIN-PANEL-CONTEXT.md: "pemanggil yang tidak berhak mendapat 0 baris, bukan error").
 */
export function useTodayArrivals() {
    const { isPending, roster, error } = useBookingRoster();

    const arrivals = useMemo(() => {
        const todayISO = format(new Date(), "yyyy-MM-dd");

        return roster
            .filter(
                (row: BookingRosterRow) =>
                    row.start_date === todayISO && row.status === "confirmed",
            )
            .sort((a, b) => a.stay_name.localeCompare(b.stay_name));
    }, [roster]);

    return { isPending, arrivals, error };
}
