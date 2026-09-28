import { format } from "date-fns";
import styled from "styled-components";
import { HiOutlineUser } from "react-icons/hi2";
import { BookingRosterRow } from "../types/dashboard.schema";
import { nightsBetween } from "../../bookings/utils/nightsBetween";

const ListWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    min-width: 0;
    min-height: 0;
`;

const DateLabel = styled.p`
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-grey-600);
`;

const ListBox = styled.ul`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;

    &::-webkit-scrollbar {
        width: 0 !important;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;
`;

const BookingItem = styled.li`
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 1.2rem;
    padding: 1.2rem 0;
    border-bottom: 1px solid var(--color-grey-100);

    &:first-child {
        border-top: 1px solid var(--color-grey-100);
    }
`;

const BookingInfo = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    min-width: 0;
`;

const StayName = styled.span`
    font-size: 1.4rem;
    font-weight: 500;
    color: var(--color-grey-700);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const GuestRow = styled.div`
    display: flex;
    align-items: center;
    gap: 0.8rem;
    min-width: 0;
`;

const GuestAvatar = styled.div`
    width: 3.6rem;
    height: 3.6rem;
    aspect-ratio: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: var(--color-grey-100);

    & svg {
        width: 1.6rem;
        height: 1.6rem;
        color: var(--color-grey-700);
    }
`;

const GuestName = styled.span`
    font-size: 1.3rem;
    color: var(--color-grey-600);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const NightsBadge = styled.div`
    width: 3.2rem;
    height: 3.2rem;
    aspect-ratio: 1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background-color: var(--color-grey-100);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--color-grey-700);
`;

const Empty = styled.p`
    text-align: center;
    font-size: 1.5rem;
    font-weight: 500;
    color: var(--color-grey-500);
    margin-top: 0.8rem;
`;

interface BookingCalendarListProps {
    bookings: BookingRosterRow[];
    selectedDate: Date;
}

/**
 * Bookings active on `selectedDate` — receives already filtered + sorted rows from
 * BookingCalendarSection. Guest avatar is a generic icon, never a real photo: avatar_path is
 * deliberately never exposed to the admin panel through any RPC (see ADMIN-PANEL-CONTEXT.md
 * § "Akses baca staf ke data guest").
 */
export function BookingCalendarList({
    bookings,
    selectedDate,
}: BookingCalendarListProps) {
    return (
        <ListWrapper>
            <DateLabel>{format(selectedDate, "d MMMM yyyy")}</DateLabel>

            {bookings.length > 0 ? (
                <ListBox>
                    {bookings.map((row) => (
                        <BookingItem key={row.booking_id}>
                            <BookingInfo>
                                <StayName>
                                    #{row.booking_id} {row.stay_name}
                                </StayName>
                                <GuestRow>
                                    <GuestAvatar>
                                        <HiOutlineUser />
                                    </GuestAvatar>
                                    <GuestName>{row.guest_name}</GuestName>
                                </GuestRow>
                            </BookingInfo>
                            <NightsBadge>
                                {nightsBetween(row.start_date, row.end_date)}
                            </NightsBadge>
                        </BookingItem>
                    ))}
                </ListBox>
            ) : (
                <Empty>No bookings on this date</Empty>
            )}
        </ListWrapper>
    );
}
