import styled, { css } from "styled-components";
import { media } from "../../../styles/breakpoints";

// One label/value vocabulary shared by BookingDetailModal and the dashboard's arrivals card,
// so the same booking reads identically in both places — the card is what you click to open
// the modal, and a different type scale between them makes it feel like a different record.
//
// Deliberately icon-free. DataItem's brand-coloured icon column works for a short summary, but
// at ten fields it becomes ten competing accents and the labels stop being scannable.
//
// Spacing/weights mirror StayFormLayout's Grid/Field/Label so a read-only detail view and an
// edit form are recognisably the same surface — the same relationship stayTable.styles.ts has
// with bookingTable.styles.ts.

export const DetailGrid = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.6rem;

    ${media.tablet(css`
        grid-template-columns: 1fr 1fr;
        gap: 2rem 3.2rem;
    `)}
`;

/** `$full` spans both columns — for notes and anything with a long value. */
export const DetailField = styled.div<{ $full?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;
    grid-column: ${({ $full }) => ($full ? "1 / -1" : "auto")};
`;

// Matches bookingTable.styles.ts's CellLabel: the modal opens from a table row, so the field
// names should be the same ones the row already uses when it stacks into a card on mobile.
export const DetailLabel = styled.span`
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-grey-400);
`;

export const DetailValue = styled.span`
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-grey-700);
    overflow-wrap: anywhere;
`;

/** Absent data — never an error, just nothing to show. Same "—" the table row uses. */
export const DetailMuted = styled(DetailValue)`
    font-weight: 400;
    color: var(--color-grey-400);
`;

export const NotesBox = styled.div`
    background-color: var(--color-grey-50);
    border-radius: var(--border-radius-md);
    padding: 1.4rem 1.6rem;

    font-size: 1.4rem;
    line-height: 1.6;
    color: var(--color-grey-600);
    /* Guests type notes into a textarea, so their line breaks are meaningful. */
    white-space: pre-wrap;
    overflow-wrap: anywhere;
`;

export const EmptyNotes = styled(NotesBox)`
    font-style: italic;
    color: var(--color-grey-400);
`;
