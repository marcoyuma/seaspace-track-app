import { useCallback, useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import {
    HiChevronDown,
    HiChevronUp,
    HiOutlineCalendarDays,
} from "react-icons/hi2";
import { Heading } from "../../../ui/Heading/Heading";
import { Spinner } from "../../../ui/Spinner/Spinner";
import { Modal } from "../../../ui/Modal/Modal";
import { media } from "../../../styles/breakpoints";
import { useTodayArrivals } from "../hooks/useTodayArrivals";
import { BookingDetailModal } from "../../bookings/components/BookingDetailModal";
import { rosterToBookingRow } from "../../bookings/utils/rosterToBookingRow";
import { TodayArrivalCard } from "./TodayArrivalCard";

// Takes over DurationChart's slot: grid-column 3/span 2 only means anything once
// DashboardLayout's 4-col grid exists (desktop). Below that this stacks full-width, and the
// 40rem row that would otherwise stretch it is gone — hence the explicit min-height, which is
// what keeps the notes box from collapsing to nothing.
const StyledSection = styled.div`
    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-100);
    border-radius: var(--border-radius-lg);

    padding: var(--spacing-card-padding);
    display: flex;
    flex-direction: column;
    gap: 2rem;
    min-height: 32rem;

    ${media.desktop(css`
        grid-column: 3 / span 2;
        min-height: 0;
    `)}
`;

const Header = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.2rem;
`;

const CountPill = styled.span`
    background-color: var(--color-grey-100);
    color: var(--color-grey-600);
    border-radius: 9999px;
    padding: 0.4rem 1.2rem;
    font-size: 1.3rem;
    font-weight: 600;
    flex-shrink: 0;
`;

const Body = styled.div`
    display: flex;
    align-items: stretch;
    gap: 1.6rem;
    flex: 1;
    min-height: 0;
`;

// Native scroll-snap rather than a translated track. It gets touch swipe, trackpad and wheel
// for free, and — unlike a transform carousel, which needs touch-action: none to receive
// vertical drags — it doesn't trap the page's own scroll on mobile: the container
// scroll-chains to the page once it hits an end. Mouse drag is the only part left to wire by
// hand (see the pointer handlers below), instead of reimplementing momentum and snapping.
const Viewport = styled.div`
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    scroll-snap-type: y mandatory;
    cursor: grab;

    &:active {
        cursor: grabbing;
    }

    &::-webkit-scrollbar {
        width: 0 !important;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;
`;

const Slide = styled.div`
    height: 100%;
    scroll-snap-align: start;
    scroll-snap-stop: always;
`;

const Rail = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
    flex-shrink: 0;
`;

const Dots = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
`;

const Dot = styled.button<{ $isActive: boolean }>`
    width: ${({ $isActive }) => ($isActive ? "1rem" : "0.6rem")};
    height: ${({ $isActive }) => ($isActive ? "1rem" : "0.6rem")};
    padding: 0;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;

    background-color: ${({ $isActive }) =>
        $isActive ? "var(--color-brand-600)" : "var(--color-grey-300)"};

    &:focus-visible {
        outline: 2px solid var(--color-brand-600);
        outline-offset: 2px;
    }
`;

const ArrowButton = styled.button`
    background: none;
    border: none;
    padding: 0.4rem;
    border-radius: var(--border-radius-sm);
    cursor: pointer;
    transition: all 0.2s;
    line-height: 0;

    &:hover:not(:disabled) {
        background-color: var(--color-grey-100);
    }

    &:disabled {
        opacity: 0.35;
        cursor: default;
    }

    & svg {
        width: 1.8rem;
        height: 1.8rem;
        color: var(--color-grey-500);
    }
`;

const EmptyState = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.2rem;
`;

const EmptyIcon = styled.div`
    width: 5.6rem;
    height: 5.6rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-grey-100);

    & svg {
        width: 2.4rem;
        height: 2.4rem;
        color: var(--color-grey-400);
    }
`;

const EmptyText = styled.p`
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-grey-500);
`;

// The dot rail is a fixed 3-slot window, not one dot per booking: the active dot sits in the
// middle, flanked by smaller neighbours, and the window slides so the active dot lands at the
// top on the first booking and the bottom on the last. Total count is read from the header
// pill instead, which is why the rail doesn't have to grow.
const DOT_WINDOW = 3;

function dotWindowStart(index: number, total: number): number {
    if (total <= DOT_WINDOW) return 0;
    return Math.min(Math.max(index - 1, 0), total - DOT_WINDOW);
}

/**
 * Today's confirmed arrivals, one booking filling the whole section, slid through vertically.
 *
 * Replaces DurationChart in the dashboard's second row. A donut of stay-length buckets over a
 * created_at window answered a question nobody asks in the morning; this answers the one they
 * do — who is arriving today, and what did they ask for.
 *
 * Clicking a card opens the same BookingDetailModal the Bookings table row opens.
 */
export function TodayArrivalsSection() {
    const { isPending, arrivals } = useTodayArrivals();

    const viewportRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const total = arrivals.length;

    // Derived from scroll position rather than held as the source of truth — otherwise a
    // swipe (which moves the scroll container directly, with no React involvement) and the
    // dot/arrow buttons would maintain two versions of "where are we" that drift apart.
    const handleScroll = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        window.requestAnimationFrame(() => {
            if (!viewport.clientHeight) return;
            const next = Math.round(viewport.scrollTop / viewport.clientHeight);
            setActiveIndex((current) => (current === next ? current : next));
        });
    }, []);

    const scrollToIndex = useCallback((index: number) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        viewport.scrollTo({
            top: index * viewport.clientHeight,
            behavior: "smooth",
        });
    }, []);

    // The arrivals list can shrink under us on a refetch (a guest checks in, so their row
    // drops out of the `confirmed` filter). Without this the widget would sit scrolled past
    // the end showing blank space.
    useEffect(() => {
        if (activeIndex > total - 1) {
            setActiveIndex(Math.max(total - 1, 0));
            viewportRef.current?.scrollTo({ top: 0 });
        }
    }, [total, activeIndex]);

    // Mouse drag. Touch already works through native scrolling, and hijacking it here would
    // fight the browser's own momentum, so pointerType "touch" is left alone deliberately.
    const dragState = useRef<{ startY: number; startScroll: number } | null>(null);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "touch" || !viewportRef.current) return;
        dragState.current = {
            startY: event.clientY,
            startScroll: viewportRef.current.scrollTop,
        };
        viewportRef.current.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragState.current;
        const viewport = viewportRef.current;
        if (!drag || !viewport) return;
        viewport.scrollTop = drag.startScroll - (event.clientY - drag.startY);
    };

    const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        const viewport = viewportRef.current;
        if (!dragState.current || !viewport) return;
        dragState.current = null;
        viewport.releasePointerCapture(event.pointerId);
        // Dragging bypasses scroll snapping (it only settles on user-driven scroll end, which
        // pointer-driven scrollTop writes don't trigger), so land the nearest slide by hand.
        scrollToIndex(
            Math.round(viewport.scrollTop / viewport.clientHeight),
        );
    };

    const windowStart = dotWindowStart(activeIndex, total);
    const visibleDots = Math.min(total, DOT_WINDOW);

    return (
        <StyledSection>
            <Header>
                <Heading as="h2">Arriving today</Heading>
                {!isPending && total > 0 && <CountPill>{total}</CountPill>}
            </Header>

            {isPending ? (
                <Spinner />
            ) : total === 0 ? (
                // An empty result here means either "nobody arrives today" or "this account
                // has no public.staff row" — the RPC answers 0 rows, not an error, for both.
                <EmptyState>
                    <EmptyIcon>
                        <HiOutlineCalendarDays />
                    </EmptyIcon>
                    <EmptyText>No confirmed arrivals today</EmptyText>
                </EmptyState>
            ) : (
                <Body>
                    <Viewport
                        ref={viewportRef}
                        onScroll={handleScroll}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                    >
                        {arrivals.map((booking) => (
                            <Slide key={booking.booking_id}>
                                {/* Modal per card, same as per row in the Bookings table —
                                    one shared window name would collide across slides. */}
                                <Modal>
                                    <Modal.Open opens="booking-detail">
                                        {(open: () => void) => (
                                            <TodayArrivalCard
                                                booking={booking}
                                                onOpen={open}
                                            />
                                        )}
                                    </Modal.Open>

                                    <Modal.Window name="booking-detail">
                                        {() => (
                                            <BookingDetailModal
                                                booking={rosterToBookingRow(
                                                    booking,
                                                )}
                                            />
                                        )}
                                    </Modal.Window>
                                </Modal>
                            </Slide>
                        ))}
                    </Viewport>

                    {total > 1 && (
                        <Rail>
                            <ArrowButton
                                type="button"
                                aria-label="Previous booking"
                                disabled={activeIndex === 0}
                                onClick={() => scrollToIndex(activeIndex - 1)}
                            >
                                <HiChevronUp />
                            </ArrowButton>

                            <Dots>
                                {Array.from({ length: visibleDots }, (_, offset) => {
                                    const index = windowStart + offset;
                                    return (
                                        <Dot
                                            key={index}
                                            type="button"
                                            $isActive={index === activeIndex}
                                            aria-label={`Go to booking ${index + 1} of ${total}`}
                                            aria-current={index === activeIndex}
                                            onClick={() => scrollToIndex(index)}
                                        />
                                    );
                                })}
                            </Dots>

                            <ArrowButton
                                type="button"
                                aria-label="Next booking"
                                disabled={activeIndex >= total - 1}
                                onClick={() => scrollToIndex(activeIndex + 1)}
                            >
                                <HiChevronDown />
                            </ArrowButton>
                        </Rail>
                    )}
                </Body>
            )}
        </StyledSection>
    );
}
