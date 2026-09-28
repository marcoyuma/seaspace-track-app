import styled from "styled-components";

// Moved verbatim from bookingsOverTimeChart.styles.ts — same badge/panel CSS as before, only
// relocated so it can render inside MainNav instead of the chart header (see MainNav.tsx /
// BookingDateRangeFilter.tsx).
export const DateRangeWrapper = styled.div`
    position: relative;
`;

export const DateRangeBadge = styled.button`
    display: flex;
    align-items: center;
    gap: 0.8rem;

    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-200);
    border-radius: 9999px;
    padding: 0.7rem 1.4rem;
    cursor: pointer;
    transition: border-color 0.2s;

    font: inherit;
    font-size: 1.3rem;
    font-weight: 500;
    color: var(--color-grey-600);
    white-space: nowrap;

    &:hover {
        border-color: red;
    }

    & svg {
        width: 1.6rem;
        height: 1.6rem;
        color: var(--color-grey-400);
        flex-shrink: 0;
    }
`;

// Position comes from the trigger's getBoundingClientRect (see BookingDateRangeFilter.tsx),
// not a relative offset — NavList (MainNav.tsx) sets overflow-x: auto, which per the CSS
// overflow spec forces overflow-y to auto too, clipping any absolutely-positioned descendant
// that pokes out below it. Rendered into document.body via createPortal + position: fixed
// instead, same escape hatch already used by Menus.tsx for row-action menus inside scrollable
// tables.
export const DateRangePanel = styled.div<{
    $position: { x: number; y: number } | null;
}>`
    position: fixed;
    top: ${(props) => props.$position?.y ?? 0}px;
    right: ${(props) => props.$position?.x ?? 0}px;
    z-index: 20;
    min-width: 24rem;
    max-width: calc(100vw - 3.2rem);

    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-100);
    box-shadow: var(--shadow-md);
    border-radius: var(--border-radius-md);
    padding: 1.6rem;

    display: flex;
    flex-direction: column;
    gap: 1.2rem;
`;

export const DateRangePanelLabel = styled.span`
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--color-grey-500);
`;

export const DateRangeInputRow = styled.div`
    display: flex;
    gap: 0.8rem;
`;

export const DateRangeInput = styled.input`
    width: 100%;
    border: 1px solid var(--color-grey-200);
    border-radius: var(--border-radius-sm);
    padding: 0.7rem 1rem;
    font-size: 1.4rem;
`;
