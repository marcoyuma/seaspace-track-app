import { ReactElement } from "react";
import styled from "styled-components";

const StyledStat = styled.div`
    /* Box */
    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-100);
    border-radius: var(--border-radius-lg);

    padding: var(--spacing-card-padding);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.2rem;
`;

// Icon + number sit side by side on one row; label sits on its own row below, full width.
const TopRow = styled.div`
    display: flex;
    align-items: center;
    gap: 1.2rem;
`;

// Neutral grey badge for every card — matches the reference dashboard's uniform icon badges,
// replacing the old per-card color prop (blue/green/indigo/yellow). Only Stats.tsx renders
// Stat, so dropping the color prop entirely is safe.
const Icon = styled.div`
    width: 4.4rem;
    height: 4.4rem;
    aspect-ratio: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    background-color: var(--color-grey-100);

    & svg {
        width: 2rem;
        height: 2rem;
        color: var(--color-grey-700);
    }
`;

const Value = styled.p`
    font-size: var(--font-size-display);
    line-height: 1;
    font-weight: 500;
`;

// Size matches the h2 Heading used by SalesChart/TodayArrivalsSection (2rem) — the old 1.3rem read
// as fine print next to those section headings. Weight kept lighter than the heading's 600
// so the label doesn't compete with the big number above it.
const Title = styled.h5`
    font-size: var(--font-size-heading);
    font-weight: 400;
    color: var(--color-grey-500);
`;

interface StatProps {
    icon: ReactElement;
    title: string;
    value: number | string;
}
function Stat({ icon, title, value }: StatProps) {
    return (
        <StyledStat>
            <TopRow>
                <Icon>{icon}</Icon>
                <Value>{value}</Value>
            </TopRow>
            <Title>{title}</Title>
        </StyledStat>
    );
}

export default Stat;
