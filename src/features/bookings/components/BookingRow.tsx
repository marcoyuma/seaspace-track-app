import styled from "styled-components";
import { BookingRow as BookingRowData } from "../types/booking.types";
import { maskPhone } from "../utils/maskPhone";
import { CellLabel, Field, TableRowItem } from "./bookingTable.styles";
import { Modal } from "../../../ui/Modal/Modal";
import { BookingDetailModal } from "./BookingDetailModal";
import {
    StatusBadge,
    formatDate,
    formatStatusLabel,
    statusStyleFor,
} from "./bookingStatus";

// Mirrors src/features/stays/components/StayRow.tsx's cell styling verbatim (font sizes,
// colors, spacing) — only the content differs.
const GuestText = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
`;

const GuestName = styled.span`
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-grey-700);
`;

const GuestMeta = styled.span`
    font-size: 1.3rem;
    color: var(--color-grey-500);
`;

const Cell = styled.span`
    font-size: 1.4rem;
    color: var(--color-grey-600);
`;

const MutedCell = styled(Cell)`
    color: var(--color-grey-400);
`;

interface BookingRowProps {
    booking: BookingRowData;
}

export function BookingRow({ booking }: BookingRowProps) {
    const statusStyle = statusStyleFor(booking.status);

    return (
        // Modal is provided per row (not per table) so the "booking-detail" window name
        // doesn't collide across rows — each row gets its own open/close state, same as
        // StayRow. Both Modal and Modal.Open render no DOM of their own (a context provider
        // and a fragment), so TableRowItem stays the direct child of the table's row list and
        // the grid is untouched.
        <Modal>
            <Modal.Open opens="booking-detail">
                {(open: () => void) => (
                    <TableRowItem
                        role="button"
                        tabIndex={0}
                        aria-label={`Booking details for ${
                            booking.guestName ?? "deleted guest"
                        } at ${booking.stayName}`}
                        onClick={open}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                // Space would scroll the page; Enter would do nothing at all
                                // on a div. Both have to be wired by hand here because the
                                // grid rules out a real <button> (see bookingTable.styles.ts).
                                event.preventDefault();
                                open();
                            }
                        }}
                    >
                        <GuestText>
                            <GuestName>{booking.guestName ?? "—"}</GuestName>
                            {/* Masked here, full in the detail modal: a table row is visible
                                to anyone glancing at the screen. */}
                            <GuestMeta>
                                {maskPhone(
                                    booking.phoneCountryCode,
                                    booking.phone,
                                )}
                            </GuestMeta>
                        </GuestText>

                        <Field>
                            <CellLabel>Villa</CellLabel>
                            <Cell>{booking.stayName}</Cell>
                        </Field>

                        <Field>
                            <CellLabel>Stay Dates</CellLabel>
                            <Cell>
                                {formatDate(booking.startDate)} →{" "}
                                {formatDate(booking.endDate)}
                            </Cell>
                        </Field>

                        <Field>
                            <CellLabel>Nights</CellLabel>
                            {booking.numNights !== null ? (
                                <Cell>{booking.numNights}</Cell>
                            ) : (
                                <MutedCell>—</MutedCell>
                            )}
                        </Field>

                        <Field>
                            <CellLabel>Total Price</CellLabel>
                            {booking.totalPrice !== null ? (
                                <Cell>
                                    Rp{booking.totalPrice.toLocaleString("id-ID")}
                                </Cell>
                            ) : (
                                <MutedCell>—</MutedCell>
                            )}
                        </Field>

                        <Field>
                            <CellLabel>Status</CellLabel>
                            <StatusBadge
                                $color={statusStyle.color}
                                $background={statusStyle.background}
                            >
                                {formatStatusLabel(booking.status)}
                            </StatusBadge>
                        </Field>
                    </TableRowItem>
                )}
            </Modal.Open>

            <Modal.Window name="booking-detail">
                {() => <BookingDetailModal booking={booking} />}
            </Modal.Window>
        </Modal>
    );
}
