import styled, { css } from "styled-components";
import { Spinner } from "../../../ui/Spinner/Spinner";
import { useBookingFinancials } from "../hooks/useBookingFinancials";
import { useTotalBookingsCount } from "../hooks/useTotalBookingsCount";
import { useNewGuestsCount } from "../hooks/useNewGuestsCount";
import Stats from "./Stats";
import { SalesChart } from "./SalesChart";
import { TodayArrivalsSection } from "./TodayArrivalsSection";
import { BookingCalendarSection } from "./BookingCalendarSection";
import { media } from "../../../styles/breakpoints";

// Below desktop, BookingCalendarSection and TodayArrivalsSection don't have room to share a row
// (the calendar alone is capped at 32rem wide), so everything stacks full-width in document
// order. The 4-column grid — and the grid-column spans that depend on it, set on
// BookingCalendarSection/TodayArrivalsSection/SalesChart themselves — only turns on at desktop.
const StyledDashboardLayout = styled.div`
    display: flex;
    flex-direction: column;
    gap: var(--spacing-section-gap);

    ${media.desktop(css`
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        grid-template-rows: auto 40rem auto;
        gap: 1.6rem;
    `)}
`;

function DashboardLayout() {
    const { bookingFinancials, isBookingFinancialsLoading, numDays } =
        useBookingFinancials();
    const { totalBookingsCount, isTotalBookingsLoading } =
        useTotalBookingsCount();
    const { newGuestsCount, isNewGuestsCountLoading } = useNewGuestsCount();

    if (
        isBookingFinancialsLoading ||
        isTotalBookingsLoading ||
        isNewGuestsCountLoading
    ) {
        return <Spinner />;
    }

    return (
        <StyledDashboardLayout>
            <Stats
                totalBookingsCount={totalBookingsCount}
                newGuestsCount={newGuestsCount}
                bookingFinancials={bookingFinancials}
            />
            <BookingCalendarSection />
            <TodayArrivalsSection />
            <SalesChart bookingFinancials={bookingFinancials} numDays={numDays} />
        </StyledDashboardLayout>
    );
}

export default DashboardLayout;
