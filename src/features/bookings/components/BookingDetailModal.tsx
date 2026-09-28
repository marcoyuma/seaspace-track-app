import styled, { css } from "styled-components";
import { ButtonText } from "../../../ui/ButtonText/ButtonText";
import { SpinnerMini } from "../../../ui/SpinnerMini/SpinnerMini";
import { media } from "../../../styles/breakpoints";
import { BookingRow } from "../types/booking.types";
import { useBookingAccessCode } from "../hooks/useBookingAccessCode";
import {
    StatusBadge,
    formatDateLong,
    formatStatusLabel,
    formatTimestamp,
    statusStyleFor,
} from "./bookingStatus";
import {
    DetailField,
    DetailGrid,
    DetailLabel,
    DetailMuted,
    DetailValue,
    EmptyNotes,
    NotesBox,
} from "./bookingDetail.styles";

// Same 64rem budget as StayFormLayout's FormShell — a booking detail and a villa form are the
// same kind of surface, and ten fields at half that width wrap into an unreadable column.
// ui/Modal has no max-height of its own; content owns its scroll. Don't add a second vw cap
// here either: StyledModal already clamps to calc(100vw - 2.4rem).
const Shell = styled.div`
    width: 100%;
    max-width: 64rem;
    max-height: 85vh;
    overflow-y: auto;
    padding-right: 0.4rem;

    display: flex;
    flex-direction: column;
    gap: 2.4rem;

    ${media.tablet(css`
        max-height: 78vh;
    `)}
`;

const Header = styled.header`
    /* Room for Modal's own close button, which is absolutely positioned top-right. */
    padding-right: 3.2rem;
`;

const TitleRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.2rem;
`;

const Title = styled.h3`
    font-size: 1.8rem;
    font-weight: 600;
    color: var(--color-grey-800);
`;

const Subtitle = styled.p`
    font-size: 1.3rem;
    color: var(--color-grey-500);
    margin-top: 0.4rem;
`;

const Divider = styled.div`
    height: 1px;
    background-color: var(--color-grey-100);
`;

const PhoneLink = styled.a`
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-brand-600);

    &:hover {
        color: var(--color-brand-700);
    }
`;

const CodeRow = styled.div`
    display: flex;
    align-items: center;
    gap: 1.2rem;
    min-height: 2.4rem;
`;

const CodeText = styled.span`
    font-family: "Sono", monospace;
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    color: var(--color-grey-700);
`;

const RevealButton = styled(ButtonText)`
    font-size: 1.3rem;
`;

// Same treatment as BookingDataBox's Price strip: a fact staff should read without hunting
// for it, coloured by what it means rather than by where it sits.
const Timeline = styled.div<{ $color: string; $background: string }>`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.8rem;
    padding: 1.2rem 1.6rem;
    border-radius: var(--border-radius-sm);

    font-size: 1.3rem;
    font-weight: 500;
    color: ${({ $color }) => $color};
    background-color: ${({ $background }) => $background};
`;

const ACCESS_CODE_MASK = "••••••••";

interface BookingDetailModalProps {
    booking: BookingRow;
}

/**
 * Read-only detail view for one booking, opened from a Bookings table row or from the
 * dashboard's arrivals widget. No actions: the admin panel has no write authority over
 * public.bookings at all (see CLAUDE.md § "Aturan tegas").
 *
 * Every field is nullable in practice. A booking that came only from admin_booking_financials
 * — its guest account was deleted, so the roster's inner join drops it — has no guest name,
 * phone, guest count or notes, and renders "—" for each rather than erroring.
 *
 * @example
 * <Modal.Window name="booking-detail">
 *     {() => <BookingDetailModal booking={booking} />}
 * </Modal.Window>
 */
export function BookingDetailModal({ booking }: BookingDetailModalProps) {
    const { revealAccessCode, accessCode, isRevealing, isRevealed, error } =
        useBookingAccessCode();

    const statusStyle = statusStyleFor(booking.status);
    const phone =
        booking.phone &&
        `${booking.phoneCountryCode ?? ""}${booking.phone}`.trim();

    return (
        <Shell>
            <Header>
                <TitleRow>
                    <Title>{booking.stayName}</Title>
                    <StatusBadge
                        $color={statusStyle.color}
                        $background={statusStyle.background}
                    >
                        {formatStatusLabel(booking.status)}
                    </StatusBadge>
                </TitleRow>
                <Subtitle>
                    Booking #{booking.bookingId}
                    {booking.createdAt &&
                        ` · Booked ${formatTimestamp(booking.createdAt)}`}
                </Subtitle>
            </Header>

            <Divider />

            <DetailGrid>
                <DetailField>
                    <DetailLabel>Guest</DetailLabel>
                    {booking.guestName ? (
                        <DetailValue>{booking.guestName}</DetailValue>
                    ) : (
                        <DetailMuted>—</DetailMuted>
                    )}
                </DetailField>

                <DetailField>
                    <DetailLabel>Villa</DetailLabel>
                    <DetailValue>{booking.stayName}</DetailValue>
                </DetailField>

                {/* Full number here, masked in the table: a row is visible to anyone walking
                    past a screen, while this modal is opened deliberately — and staff need a
                    dialable number to chase today's arrivals. */}
                <DetailField>
                    <DetailLabel>Phone</DetailLabel>
                    {phone ? (
                        <PhoneLink href={`tel:${phone.replace(/\s/g, "")}`}>
                            {phone}
                        </PhoneLink>
                    ) : (
                        <DetailMuted>No phone on file</DetailMuted>
                    )}
                </DetailField>

                <DetailField>
                    <DetailLabel>Guests</DetailLabel>
                    {booking.numGuests !== null ? (
                        <DetailValue>
                            {booking.numGuests}{" "}
                            {booking.numGuests === 1 ? "guest" : "guests"}
                        </DetailValue>
                    ) : (
                        <DetailMuted>—</DetailMuted>
                    )}
                </DetailField>

                <DetailField>
                    <DetailLabel>Check-in</DetailLabel>
                    <DetailValue>{formatDateLong(booking.startDate)}</DetailValue>
                </DetailField>

                <DetailField>
                    <DetailLabel>Check-out</DetailLabel>
                    <DetailValue>{formatDateLong(booking.endDate)}</DetailValue>
                </DetailField>

                <DetailField>
                    <DetailLabel>Nights</DetailLabel>
                    {booking.numNights !== null ? (
                        <DetailValue>
                            {booking.numNights}{" "}
                            {booking.numNights === 1 ? "night" : "nights"}
                        </DetailValue>
                    ) : (
                        <DetailMuted>—</DetailMuted>
                    )}
                </DetailField>

                <DetailField>
                    <DetailLabel>Total price</DetailLabel>
                    {booking.totalPrice !== null ? (
                        <DetailValue>
                            Rp{booking.totalPrice.toLocaleString("id-ID")}
                        </DetailValue>
                    ) : (
                        <DetailMuted>—</DetailMuted>
                    )}
                </DetailField>

                {/* Masked until asked for: the reveal is a separate RPC call, and each one
                    writes an audit row. See 0020_admin_booking_access_code.sql. */}
                <DetailField $full>
                    <DetailLabel>Access code</DetailLabel>
                    <CodeRow>
                        {isRevealing ? (
                            <SpinnerMini />
                        ) : error ? (
                            <DetailMuted>Could not load the code</DetailMuted>
                        ) : accessCode ? (
                            <CodeText>{accessCode}</CodeText>
                        ) : isRevealed ? (
                            // The RPC answers null both for "this booking has no code yet"
                            // and for a caller without a public.staff row. Say so, rather
                            // than leaving the mask sitting there looking like a dead button.
                            <DetailMuted>
                                No access code for this booking
                            </DetailMuted>
                        ) : (
                            <>
                                <CodeText>{ACCESS_CODE_MASK}</CodeText>
                                <RevealButton
                                    type="button"
                                    onClick={() =>
                                        revealAccessCode(booking.bookingId)
                                    }
                                >
                                    Show
                                </RevealButton>
                            </>
                        )}
                    </CodeRow>
                </DetailField>
            </DetailGrid>

            {(booking.paidAt || booking.cancelledAt) && (
                <>
                    {booking.paidAt && (
                        <Timeline
                            $color="var(--color-green-700)"
                            $background="var(--color-green-100)"
                        >
                            Paid {formatTimestamp(booking.paidAt)}
                        </Timeline>
                    )}

                    {booking.cancelledAt && (
                        <Timeline
                            $color="var(--color-red-700)"
                            $background="var(--color-red-100)"
                        >
                            Cancelled {formatTimestamp(booking.cancelledAt)}
                        </Timeline>
                    )}
                </>
            )}

            <Divider />

            <DetailField $full>
                <DetailLabel>Guest notes</DetailLabel>
                {booking.guestNotes ? (
                    <NotesBox>{booking.guestNotes}</NotesBox>
                ) : (
                    <EmptyNotes>No notes from this guest</EmptyNotes>
                )}
            </DetailField>
        </Shell>
    );
}
