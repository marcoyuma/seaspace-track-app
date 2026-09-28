import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * Nights between two YYYY-MM-DD dates, derived the same way the real generated column
 * `bookings.num_nights` is computed.
 *
 * Needed because admin_booking_roster() doesn't return num_nights — that only comes from
 * admin_booking_financials(), which filters on created_at rather than stay-date overlap, so
 * the two can't simply be joined for a single day's arrivals.
 *
 * @example
 * nightsBetween("2026-09-03", "2026-09-06"); // 3
 */
export function nightsBetween(startDate: string, endDate: string): number {
    return differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
}
