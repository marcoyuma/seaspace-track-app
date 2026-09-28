// Merge of admin_booking_roster() and admin_booking_financials() by booking_id — neither RPC
// alone carries everything a booking list needs (roster has guest identity, financials has
// nights/price), and their date filters aren't the same thing (roster: stay-date overlap,
// financials: created_at). A row that only came from one side of the union leaves the other
// side's fields null, rendered as "—" by BookingRow rather than treated as an error.
//
// The guest-detail fields (numGuests..cancelledAt) only ever come from the roster side — see
// 0019_admin_booking_roster_guest_details.sql — so a financials-only row leaves them null,
// same as guestName/phone. createdAt is the one exception: both RPCs carry it.
//
// This is also the shape BookingDetailModal consumes, from both the Bookings table and the
// dashboard's arrivals widget, so the widget maps its BookingRosterRow into this rather than
// the modal learning about two input types.
export interface BookingRow {
    bookingId: number;
    stayName: string;
    guestName: string | null;
    phoneCountryCode: string | null;
    phone: string | null;
    startDate: string;
    endDate: string;
    status: string;
    numNights: number | null;
    totalPrice: number | null;
    numGuests: number | null;
    guestNotes: string | null;
    createdAt: string | null;
    paidAt: string | null;
    cancelledAt: string | null;
}
