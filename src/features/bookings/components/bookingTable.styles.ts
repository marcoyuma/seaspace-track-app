import styled, { css } from "styled-components";
import { media } from "../../../styles/breakpoints";

// Mirrors src/features/stays/components/stayTable.styles.ts exactly — same card/toolbar/
// header/row treatment, so the Booking table reads as the same table component family as
// Stays. Only the column count/proportions differ (no actions column, since the admin panel
// has no write access to bookings — see ADMIN-PANEL-CONTEXT.md).
export const BOOKING_TABLE_COLUMNS = "2fr 1.6fr 1.8fr 0.8fr 1.3fr 1.2fr";

// Below tablet, a 6-column grid has nowhere to put its columns — rows stack into cards
// instead (each row's Grid becomes a flex column), and TableRowItem/TableHeaderBar layer their
// own card/hidden-header treatment on top (see below).
const Grid = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.4rem;

    ${media.tablet(css`
        display: grid;
        grid-template-columns: ${BOOKING_TABLE_COLUMNS};
        column-gap: 1.6rem;
        align-items: center;
    `)}
`;

// Wraps one cell's mobile label + value as a label-left/value-right row. At tablet+ it
// dissolves via display:contents — CellLabel is display:none there, so only the value
// (Cell/StatusBadge/etc.) remains as the actual grid item, keeping the column count intact.
export const Field = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.8rem;

    ${media.tablet(css`
        display: contents;
    `)}
`;

export const CellLabel = styled.span`
    font-size: 1.1rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--color-grey-400);

    ${media.tablet(css`
        display: none;
    `)}
`;

export const TableCard = styled.div`
    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-100);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-card-padding);

    ${media.tablet(css`
        padding: 2.4rem;
    `)}
`;

export const TableToolbar = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1.2rem;
    margin-bottom: 2rem;
`;

export const TableTitle = styled.h2`
    font-size: var(--font-size-heading);
    font-weight: 600;
    color: var(--color-grey-800);
`;

// Groups TableTitle with TableCount so both sit as one flex item on the left of
// TableToolbar, opposite BookingTableOperations on the right.
export const TableTitleGroup = styled.div`
    display: flex;
    align-items: baseline;
    gap: 1rem;
`;

// Reflects totalCount (bookings for the selected date range, before search/status/price
// filters) — not sortedFiltered.length — so it answers "how many bookings in this range",
// not "how many rows are currently visible".
export const TableCount = styled.span`
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--color-grey-500);
`;

// Column labels are redundant with each row's own CellLabel once rows stack into cards, so
// the header bar hides entirely below tablet instead of trying to stack itself.
export const TableHeaderBar = styled(Grid)`
    display: none;

    background-color: var(--color-grey-50);
    border-radius: var(--border-radius-md);
    padding: 1.3rem 1.6rem;

    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-grey-500);

    ${media.tablet(css`
        display: grid;
    `)}
`;

// Each row is its own bordered card below tablet (stacked layout); reverts to a flat grid row
// with only a bottom divider at tablet+ (original desktop look, unchanged).
//
// The whole row is the button that opens BookingDetailModal, so the affordance lives here
// rather than on a child. It can't be wrapped in a <button>: at tablet+ each cell relies on
// Field's display:contents to stay a direct grid item, and an extra element between the grid
// and its cells collapses the 6-column layout. BookingRow puts role/tabIndex/onClick on this
// element itself instead.
export const TableRowItem = styled(Grid)`
    padding: 1.2rem 1.4rem;
    border: 1px solid var(--color-grey-100);
    border-radius: var(--border-radius-md);

    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
        background-color: var(--color-grey-50);
    }

    &:focus-visible {
        outline: 2px solid var(--color-brand-600);
        outline-offset: -2px;
    }

    &:not(:last-child) {
        margin-bottom: 0.8rem;
    }

    ${media.tablet(css`
        padding: 1.4rem 1.6rem;
        border: none;
        border-radius: 0;

        &:not(:last-child) {
            margin-bottom: 0;
            border-bottom: 1px solid var(--color-grey-100);
        }
    `)}
`;

export const TableEmpty = styled.p`
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-grey-500);
    text-align: center;
    padding: 4rem 0;
`;

/** Same pill primitive as stayTable.styles.ts's pillStyles — search box, Filter/Sort/Date range buttons. */
export const pillStyles = `
    display: flex;
    align-items: center;
    gap: 0.8rem;

    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-200);
    border-radius: 9999px;
    padding: 0.9rem 1.6rem;

    font-size: 1.4rem;
    font-weight: 500;
    color: var(--color-grey-600);
`;
