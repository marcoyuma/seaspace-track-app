import { subDays } from "date-fns";
import supabase from "../../../supabase/supabase";
import {
    bookingRosterSchema,
    bookingFinancialsSchema,
    ALL_TIME_LOOKBACK_DAYS,
} from "../../dashboard/types/dashboard.schema";
import { BookingRow } from "../types/booking.types";

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Merges admin_booking_roster() and admin_booking_financials() by booking_id — a union, so a
 * booking present in only one result keeps the other side's fields null. Financials filters by
 * `created_at`, not stay date, so it's read over a wide lookback and narrowed by stay overlap
 * below; passing this page's stay-date range straight through returned no prices at all.
 */
export const readBookings = async (from: Date, to: Date): Promise<BookingRow[]> => {
    const p_from = toDateString(from);
    const p_to = toDateString(to);

    // `created_at` is never in the future, but `to` can be in the past.
    const now = new Date();

    const [rosterResult, financialsResult] = await Promise.all([
        supabase.rpc("admin_booking_roster", { p_from, p_to }),
        supabase.rpc("admin_booking_financials", {
            p_from: toDateString(subDays(from, ALL_TIME_LOOKBACK_DAYS)),
            p_to: toDateString(to > now ? to : now),
        }),
    ]);

    if (rosterResult.error) {
        console.error(rosterResult.error);
        throw new Error("server error, booking roster could not be loaded");
    }
    if (financialsResult.error) {
        console.error(financialsResult.error);
        throw new Error("server error, booking financials could not be loaded");
    }

    const roster = bookingRosterSchema.parse(rosterResult.data);
    const financials = bookingFinancialsSchema.parse(financialsResult.data);

    const rows = new Map<number, BookingRow>();

    for (const entry of roster) {
        rows.set(entry.booking_id, {
            bookingId: entry.booking_id,
            stayName: entry.stay_name,
            guestName: entry.guest_name,
            phoneCountryCode: entry.phone_country_code,
            phone: entry.phone,
            startDate: entry.start_date,
            endDate: entry.end_date,
            status: entry.status,
            numNights: null,
            totalPrice: null,
            numGuests: entry.num_guests ?? null,
            guestNotes: entry.guest_notes ?? null,
            createdAt: entry.created_at ?? null,
            paidAt: entry.paid_at ?? null,
            cancelledAt: entry.cancelled_at ?? null,
        });
    }

    // Safe as string compare — both RPCs return dates as YYYY-MM-DD.
    const overlapsRange = (start: string, end: string) => start <= p_to && end >= p_from;

    for (const entry of financials) {
        if (!overlapsRange(entry.start_date, entry.end_date)) continue;

        const existing = rows.get(entry.booking_id);
        if (existing) {
            existing.numNights = entry.num_nights;
            existing.totalPrice = entry.total_price;
            // Only fills the gap left by a pre-0019 roster response; a roster row that
            // already carried created_at wins, since both come from the same column.
            existing.createdAt ??= entry.created_at;
            continue;
        }

        rows.set(entry.booking_id, {
            bookingId: entry.booking_id,
            stayName: entry.stay_name,
            guestName: null,
            phoneCountryCode: null,
            phone: null,
            startDate: entry.start_date,
            endDate: entry.end_date,
            status: entry.status,
            numNights: entry.num_nights,
            totalPrice: entry.total_price,
            // Financials never joins public.guests, so nothing guest-supplied is available
            // here. A row that only exists on this side is a booking whose guest account was
            // deleted (roster inner-joins guests) — it renders as "—", not as an error.
            numGuests: null,
            guestNotes: null,
            createdAt: entry.created_at,
            paidAt: null,
            cancelledAt: null,
        });
    }

    return Array.from(rows.values());
};
