import styled from "styled-components";
import { BookingRosterRow } from "../types/dashboard.schema";
import { formatDateLong } from "../../bookings/components/bookingStatus";
import {
    DetailField,
    DetailLabel,
    DetailMuted,
    DetailValue,
    EmptyNotes,
    NotesBox,
} from "../../bookings/components/bookingDetail.styles";

// The whole card is the trigger for the detail modal, so it's a real button — unlike the
// Bookings table row, nothing here depends on display:contents, so there's no reason to
// hand-roll the semantics.
//
// Every block below is flex-shrink: 0 except the notes. Flex items shrink below their content
// height by default, and inside a fixed-height dashboard row that squeezed the labels into
// their own values — the notes box is the one part allowed to give way, because it scrolls.
const CardButton = styled.button`
    width: 100%;
    height: 100%;
    min-height: 0;

    display: flex;
    flex-direction: column;
    gap: 2rem;
    text-align: left;

    background: none;
    border: none;
    border-radius: var(--border-radius-md);
    padding: 0;
    cursor: pointer;

    &:focus-visible {
        outline: 2px solid var(--color-brand-600);
        outline-offset: 4px;
    }
`;

const Identity = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    min-width: 0;
    flex-shrink: 0;
`;

// Deliberately larger than the "Arriving today" section heading (2rem): this is the one thing
// on the card that should be readable at a glance from across the front desk. Not
// --font-size-heading-lg, which reaches 3rem at desktop and swamps a half-width card.
const StayName = styled.h3`
    font-size: 2.4rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--color-grey-800);
    overflow-wrap: anywhere;
`;

const GuestName = styled.p`
    font-size: 1.5rem;
    color: var(--color-grey-500);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const MetaGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.6rem 2.4rem;
    flex-shrink: 0;
`;

// Takes whatever height is left so the notes box fills the card instead of leaving dead space
// under a short booking, and scrolls internally so a long note never pushes the card past the
// dashboard's fixed 40rem row.
const NotesField = styled(DetailField)`
    flex: 1;
    min-height: 0;
`;

const ScrollingNotes = styled(NotesBox)`
    flex: 1;
    min-height: 6rem;
    overflow-y: auto;

    &::-webkit-scrollbar {
        width: 0 !important;
    }
    scrollbar-width: none;
`;

const ScrollingEmptyNotes = styled(EmptyNotes)`
    flex: 1;
    min-height: 6rem;
`;

interface TodayArrivalCardProps {
    booking: BookingRosterRow;
    onOpen: () => void;
}

/**
 * One arriving guest, rendered large enough to be read across a room: villa, guest, check-in
 * date, party size, and whatever they wrote at checkout.
 *
 * Shares its label/value styling with BookingDetailModal — this card is what you click to
 * open that modal, so the two are the same record at two zoom levels, not two designs.
 */
export function TodayArrivalCard({ booking, onOpen }: TodayArrivalCardProps) {
    return (
        <CardButton
            type="button"
            onClick={onOpen}
            aria-label={`Booking details for ${booking.guest_name} at ${booking.stay_name}`}
        >
            <Identity>
                <StayName>{booking.stay_name}</StayName>
                <GuestName>{booking.guest_name || "—"}</GuestName>
            </Identity>

            <MetaGrid>
                <DetailField>
                    <DetailLabel>Check-in</DetailLabel>
                    <DetailValue>{formatDateLong(booking.start_date)}</DetailValue>
                </DetailField>

                <DetailField>
                    <DetailLabel>Guests</DetailLabel>
                    {booking.num_guests != null ? (
                        <DetailValue>
                            {booking.num_guests}{" "}
                            {booking.num_guests === 1 ? "guest" : "guests"}
                        </DetailValue>
                    ) : (
                        <DetailMuted>—</DetailMuted>
                    )}
                </DetailField>
            </MetaGrid>

            <NotesField>
                <DetailLabel as="h4">Guest notes</DetailLabel>
                {booking.guest_notes ? (
                    <ScrollingNotes>{booking.guest_notes}</ScrollingNotes>
                ) : (
                    <ScrollingEmptyNotes>
                        No notes from this guest
                    </ScrollingEmptyNotes>
                )}
            </NotesField>
        </CardButton>
    );
}
