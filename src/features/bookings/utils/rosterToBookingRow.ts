import { BookingRosterRow } from "../../dashboard/types/dashboard.schema";
import { BookingRow } from "../types/booking.types";
import { nightsBetween } from "./nightsBetween";

/**
 * Maps an admin_booking_roster() row into the shared BookingRow shape, so BookingDetailModal
 * doesn't need to know it can be opened from two different places (the Bookings table, which
 * merges both RPCs, and the dashboard's arrivals widget, which only has the roster).
 *
 * `totalPrice` stays null: the roster doesn't return it, and admin_booking_financials filters
 * on created_at rather than stay dates, so it can't be joined in for a single day's arrivals.
 * The modal renders "—" for it.
 *
 * @example
 * <BookingDetailModal booking={rosterToBookingRow(row)} />
 */
export function rosterToBookingRow(row: BookingRosterRow): BookingRow {
    return {
        bookingId: row.booking_id,
        stayName: row.stay_name,
        guestName: row.guest_name,
        phoneCountryCode: row.phone_country_code,
        phone: row.phone,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status,
        numNights: nightsBetween(row.start_date, row.end_date),
        totalPrice: null,
        numGuests: row.num_guests ?? null,
        guestNotes: row.guest_notes ?? null,
        createdAt: row.created_at ?? null,
        paidAt: row.paid_at ?? null,
        cancelledAt: row.cancelled_at ?? null,
    };
}
