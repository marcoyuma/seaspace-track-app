import { format, parseISO } from "date-fns";
import styled from "styled-components";

// Booking status values live in the customer-site schema (public.bookings.status:
// confirmed | checked_in | checked_out | cancelled | no_show — see ADMIN-PANEL-CONTEXT.md
// § "public.bookings"). Anything unrecognized falls back to plain grey rather than crashing
// on an unmapped value.
//
// Shared by BookingRow, BookingDetailModal and the dashboard's arrivals widget so a status
// looks identical wherever it appears — the modal opens from a row, and a pill that changed
// colour on the way would read as a different booking.
const STATUS_STYLES: Record<string, { color: string; background: string }> = {
    confirmed: {
        color: "var(--color-blue-700)",
        background: "var(--color-blue-100)",
    },
    checked_in: {
        color: "var(--color-green-700)",
        background: "var(--color-green-100)",
    },
    checked_out: {
        color: "var(--color-silver-700)",
        background: "var(--color-silver-100)",
    },
    cancelled: {
        color: "var(--color-red-700)",
        background: "var(--color-red-100)",
    },
    no_show: {
        color: "var(--color-yellow-700)",
        background: "var(--color-yellow-100)",
    },
};

export const statusStyleFor = (status: string) =>
    STATUS_STYLES[status] ?? {
        color: "var(--color-grey-600)",
        background: "var(--color-grey-100)",
    };

/** `checked_in` → `checked in`. Statuses are snake_case in the database, prose in the UI. */
export const formatStatusLabel = (status: string) => status.replace("_", " ");

export const StatusBadge = styled.span<{ $color: string; $background: string }>`
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    width: fit-content;

    padding: 0.5rem 1.1rem;
    border-radius: 9999px;
    font-size: 1.2rem;
    font-weight: 600;

    color: ${({ $color }) => $color};
    background-color: ${({ $background }) => $background};
`;

/** Stay dates in list/table context: `3 Sep 2026`. */
export const formatDate = (isoDate: string) =>
    format(parseISO(isoDate), "d MMM yyyy");

/** Stay dates in the detail modal, where the weekday is worth the extra width. */
export const formatDateLong = (isoDate: string) =>
    format(parseISO(isoDate), "EEE, d MMM yyyy");

/** Lifecycle timestamps (created_at/paid_at/cancelled_at), which carry a time of day. */
export const formatTimestamp = (isoTimestamp: string) =>
    format(parseISO(isoTimestamp), "d MMM yyyy, HH:mm");
