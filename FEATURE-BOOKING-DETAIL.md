# Feature spec — Booking Detail Modal + Today's Arrivals widget

> **Temporary document.** Lives only while this feature is in progress. Update it whenever a
> decision changes. Delete it once the feature ships and the durable parts have been folded into
> `CLAUDE.md` / `ADMIN-PANEL-CONTEXT2.md`.

Status: **code complete, migrations applied, first design pass reworked** — started 2026-09-03.

`npm run build` and `npm run lint` both pass (lint is back to the repo's 26 pre-existing
`no-console` errors, 0 warnings). Migrations `0019` and `0020` are live — verified against the
project: the roster accepts `select=guest_notes,num_guests,paid_at`, and
`admin_booking_access_code` answers (`null` to a non-staff caller) rather than 404-ing.

### Fixed after the first round of review

1. **Icons removed** from the detail view and the arrivals card — see §5.
2. **Modal widened** from 56rem to 64rem, matching the villa form.
3. **`Show` on the access code appeared to do nothing.** The RPC was fine; the UI treated a
   `null` answer as identical to "not clicked yet". Now distinguished via `isSuccess` — §5.
4. **Arrivals card text overlapped itself.** Flex shrink below content height — §6.
5. **Label/value styling extracted** to `bookingDetail.styles.ts` and shared by the modal and the
   card, which is where the inconsistency came from.

---

## 1. Why

Two gaps this feature closes:

1. **Booking rows are a dead end.** `BookingTable` renders six cells and stops. There is no detail
   surface anywhere in the app for a Seaspace booking, so `guest_notes` — free text the guest wrote
   at checkout, often the only place an arrival request lives ("late arrival ~22:00", "need a baby
   cot") — has never been readable by staff. Neither has `num_guests`.
2. **`DurationChart` did not earn its half of the dashboard.** A donut of stay-length buckets over a
   `created_at`-filtered window is a vanity metric. The 40rem slot next to the calendar should
   answer what staff actually open the dashboard for in the morning: *who is arriving today, and
   what did they ask for?*

---

## 2. Schema findings (validated live, not assumed)

`ADMIN-PANEL-CONTEXT2.md` § `public.bookings` omits several columns, which initially made this
feature look blocked on a customer-site schema change. It is not — **the doc is incomplete**.

Verified against the live project via PostgREST (`42703` on a missing column vs `200 []` on an
existing one blocked by RLS; types pulled from `invalid input syntax for type …` errors):

| Column | Exists on `public.bookings` | Type | Returned by `admin_booking_roster()` | By `admin_booking_financials()` |
| --- | --- | --- | --- | --- |
| `num_guests` | yes | **`smallint`** | no → **added in 0019** | no |
| `guest_notes` | yes | `text` | no → **added in 0019** | no |
| `created_at` | yes | `timestamptz` | no → **added in 0019** | yes |
| `paid_at` | yes | `timestamptz` | no → **added in 0019** | no |
| `cancelled_at` | yes | `timestamptz` | no → **added in 0019** | no |
| `access_code` | yes | `text` | no → **stays out**, see §4 | no |
| `notes`, `observations` | **no** | — | — | — |

`observations` / `numGuests` in `src/supabase/types/database.types.ts` and
`src/features/check-in-out/components/BookingDataBox.tsx` belong to the **legacy wild-oasis demo
schema**, not Seaspace. Unrelated to this work.

> `num_guests` being `smallint` matters: a `returns table (… num_guests integer …)` would fail at
> runtime with a return-type mismatch on every call. `0019` casts it explicitly.

---

## 3. Decisions

| Question | Decision |
| --- | --- |
| Read path | Widen `admin_booking_roster()` — migration `0019` |
| Extra fields | `num_guests`, `guest_notes`, `created_at`, `paid_at`, `cancelled_at` |
| `access_code` | Not in the roster. Separate one-row RPC + audit log — migration `0020` |
| Modal trigger | Whole table row clickable |
| Widget scope | `start_date = today` **and** `status = 'confirmed'` |
| Widget shape | One booking fills the section; slide between them; vertical 3-dot sliding-window indicator + count |
| Widget navigation | Click dots + swipe/drag + up/down arrows |
| Widget card click | Opens the same modal |
| Phone | Masked in the table, full in the modal |
| `DurationChart.tsx` | Deleted |

---

## 4. Why `access_code` is not in the roster

Researched, not guessed. Hotel PMS and vacation-rental tooling **do** show per-reservation access
codes to staff — it is operationally necessary when a guest loses theirs. The mitigations used in
practice are unique-per-booking codes, stay-bounded validity, auto-revocation, role scoping, and
activity logs — *not* hiding the code from staff. Seaspace has **one staff tier**
(`0018_drop_manager_role.sql`), so role scoping is unavailable and the audit log becomes the only
remaining control.

The real problem is the **delivery shape**, not staff visibility. Attaching `access_code` to
`admin_booking_roster()` would ship every code in a date range to the browser on every page load —
the Bookings table pulls a whole range, `useMonthBookingRoster` pulls a whole month — where it sits
in the React Query cache and devtools even for bookings nobody opens. That is exactly the pattern
OWASP's secrets guidance warns against: a secret riding along in a broad payload instead of being
fetched on demand.

Hence a narrow, logged, one-row-at-a-time function, mirroring this repo's own precedent
(`admin_export_guests()` → `public.admin_export_log`, added in `0014`).

References:
[Hotel PMS User Permissions](https://www.smartorder.ai/resources/blog/hotel-pms-user-permissions/) ·
[Airbnb Self Check-In](https://www.hostfully.com/blog/airbnb-check-in-process/) ·
[Vacation Rental Access Control](https://remotelock.com/industry/vacation-rental) ·
[OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) ·
[OWASP: query-string exposure](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)

---

## 5. Layout — shared detail vocabulary

`src/features/bookings/components/bookingDetail.styles.ts` holds one label/value language used by
**both** the modal and the dashboard card, because the card is what you click to open the modal —
two type scales for the same record makes them read as two different things.

- `DetailLabel` — 1.1rem / 600 / uppercase / grey-400, matching `bookingTable.styles.ts`'s
  `CellLabel`, which is what the table row already shows when it stacks into a card on mobile.
- `DetailValue` — 1.5rem / 500 / grey-700. `DetailMuted` for absent data.
- `DetailGrid` / `DetailField` — spacing and stacking mirror `StayFormLayout`'s `Grid`/`Field`, so
  a read-only detail view and an edit form are recognisably the same surface.

**No icons.** `ui/DataItem`'s brand-coloured icon column works for a short summary, but at ten
fields it becomes ten competing accents and the labels stop being scannable. `DataItem` itself is
left alone — the legacy `BookingDataBox` still uses it.

### `BookingDetailModal`

Max-width **64rem**, the same budget as `StayFormLayout`'s `FormShell`. `ui/Modal` has no
max-height of its own; content owns its scroll (`85vh`, `78vh` at tablet+).

```
┌────────────────────────────────────────────────────────────────────┐
│ Riverside Stone Lodge   [ confirmed ]                          ×   │
│ Booking #156 · Booked 5 Jul 2026, 07:00                            │
├────────────────────────────────────────────────────────────────────┤
│  GUEST                             VILLA                           │
│  Adriana Lopes                     Riverside Stone Lodge           │
│                                                                    │
│  PHONE                             GUESTS                          │
│  +62 812 3456 7890                 4 guests                        │
│                                                                    │
│  CHECK-IN                          CHECK-OUT                       │
│  Tue, 1 Sep 2026                   Fri, 4 Sep 2026                 │
│                                                                    │
│  NIGHTS                            TOTAL PRICE                     │
│  3 nights                          Rp8.400.000                     │
│                                                                    │
│  ACCESS CODE                                                       │
│  ••••••••  Show                                                    │
├────────────────────────────────────────────────────────────────────┤
│  Paid 12 Aug 2026, 07:00        (green-100/green-700)              │  only when paid_at
│  Cancelled 1 Sep 2026, 09:03    (red-100/red-700)                  │  only when cancelled_at
├────────────────────────────────────────────────────────────────────┤
│  GUEST NOTES                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Late arrival, around 22:00. Please leave the key at reception.│  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

- **Phone**: full here, as a `tel:` link. `maskPhone` stays in use for the table only. A guest
  with no number on file reads "No phone on file", not a bare dash — the dash looked like the
  field had failed to load.
- **Money**: `Rp{n.toLocaleString("id-ID")}`, matching `BookingRow.tsx`.
- **Dates**: `EEE, d MMM yyyy` for stay dates; `d MMM yyyy, HH:mm` for timestamps.
- **Access code**: masked `••••••••` + a `Show` button; the RPC fires only on click. Revealed code
  renders in `Sono` (the repo's mono family for codes). Never written to the URL.

  The reveal has **four** states, not two. `admin_booking_access_code` returns null both for a
  booking with no code yet and for a caller with no `public.staff` row, so `isSuccess` is what
  separates "asked, and the answer was null" from "not asked yet" — without it a null answer
  looks exactly like a dead button. States: masked → spinner → the code, "No access code for this
  booking", or "Could not load the code".

---

## 6. Layout — `TodayArrivalsSection`

Occupies `DurationChart`'s old slot: `grid-column: 3 / span 2` at desktop, full-width stacked below.

```
┌─ StyledSection ─────────────────────────────────────────────┐
│  grey-0 · 1px grey-100 · radius-lg · var(--spacing-card-padding)
│  flex column · gap 2rem · min-height 32rem                  │
│                                                             │
│  Arriving today                              ( 3 )          │ ← Heading as="h2" + count pill
│                                                             │
│  ┌── Viewport ──────────────────────────────────┐    ▲      │
│  │   Tuscan Twilight Villa                      │           │  2.4rem/600 grey-800
│  │   Amara L.                                   │    ·      │ ← dot rail: vertical,
│  │                                              │    ●      │   active = biggest,
│  │   CHECK-IN            GUESTS                 │    ·      │   neighbours smaller
│  │   Wed, 3 Sep 2026     2 guests               │           │
│  │                                              │    ▼      │
│  │   GUEST NOTES                                │           │
│  │   ┌────────────────────────────────────────┐ │           │
│  │   │ Late arrival, around 22:00. Please     │ │           │
│  │   │ leave the key at reception.            │ │           │
│  │   └────────────────────────────────────────┘ │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

The stay name is a fixed **2.4rem** — bigger than the 2rem section heading so it dominates, but
not `--font-size-heading-lg`, which reaches 3rem at desktop and swamps a half-width card.

**Every block in the card is `flex-shrink: 0` except the notes.** Flex items shrink below their
own content height by default, and inside the dashboard's fixed 40rem row that squeezed each
label into its own value — the labels and dates rendered on top of each other. The notes box is
the one part allowed to give way, because it scrolls.

### Transport: native scroll-snap, not a transform carousel

```css
/* Viewport */  flex: 1; min-height: 0; overflow-y: auto; scroll-snap-type: y mandatory;
/* Slide    */  height: 100%; scroll-snap-align: start;
```

Deliberate, and the smallest correct choice. It gives touch swipe, trackpad and wheel for free
and — unlike a transform carousel with `touch-action: none` — does **not** trap the page's own
vertical scroll on mobile: the container scroll-chains to the page at its ends. Mouse drag is then
a short pointer handler writing `scrollTop`, instead of reimplementing momentum and snap physics.

Active index is **derived** from scroll position (`Math.round(scrollTop / clientHeight)`, throttled
with `requestAnimationFrame`), never stored as the source of truth. Dots and arrows call
`scrollTo({ top: i * clientHeight, behavior: "smooth" })`.

### Dot rail

- `total ≤ 1` → rail hidden entirely (no dots, no arrows).
- `total ≤ 3` → `total` dots, active = current index.
- `total > 3` → always exactly 3 dots. `windowStart = clamp(index - 1, 0, total - 3)`; the active
  dot is the top one on the first booking, the bottom one on the last, and the middle one
  everywhere else.
- Active `1rem` / `--color-brand-600`; neighbours `0.6rem` / `--color-grey-300`; `transition: .2s`.
- Dots are buttons (`aria-label="Go to booking N"`); arrows are `HiChevronUp` / `HiChevronDown`,
  disabled at the ends.

### States

- Loading → `Spinner` inside the card.
- Empty → grey icon circle + "No confirmed arrivals today", card keeps its height so the dashboard
  grid doesn't jump. An empty result can mean "no arrivals" **or** "signed-in account has no
  `public.staff` row" — same empty state by design.

---

## 7. Files

**New**
- `src/supabase/migrations/0019_admin_booking_roster_guest_details.sql`
- `src/supabase/migrations/0020_admin_booking_access_code.sql`
- `src/features/bookings/components/BookingDetailModal.tsx`
- `src/features/bookings/components/bookingDetail.styles.ts`
- `src/features/bookings/components/bookingStatus.ts`
- `src/features/bookings/hooks/useBookingAccessCode.ts`
- `src/features/bookings/utils/nightsBetween.ts`
- `src/features/bookings/utils/rosterToBookingRow.ts`
- `src/features/dashboard/components/TodayArrivalsSection.tsx`
- `src/features/dashboard/components/TodayArrivalCard.tsx`
- `src/features/dashboard/hooks/useTodayArrivals.ts`

**Modified**
- `src/supabase/types/database.types.ts`
- `src/features/dashboard/types/dashboard.schema.ts`
- `src/features/dashboard/components/DashboardLayout.tsx`
- `src/features/dashboard/components/BookingCalendarList.tsx`
- `src/features/bookings/types/booking.types.ts`
- `src/features/bookings/services/readBookings.ts`
- `src/features/bookings/components/BookingRow.tsx`
- `src/features/bookings/components/bookingTable.styles.ts`
- `CLAUDE.md`, `ADMIN-PANEL-CONTEXT2.md`

**Deleted**
- `src/features/dashboard/components/DurationChart.tsx`

**Reused, not rewritten**: `ui/Modal` (+ `useOutsideClick`), `ui/DataItem`, `ui/Heading`,
`ui/Spinner`, `ui/ButtonText`, `styles/breakpoints`'s `media`, `bookings/utils/maskPhone`,
`dashboard/hooks/useBookingRoster` (revived from dead code), `BookingCalendarList`'s avatar and
empty-state styling.

---

## 8. Verification

No test suite exists (no vitest/jest/playwright, no `*.test.ts(x)`), so this is build + lint +
manual SQL, per `CLAUDE.md`.

**After applying the migrations** — structure in the SQL Editor, behaviour from a real staff session:

```sql
-- 1. Five admin functions, all security definer. Expect 5 rows, prosecdef = true.
select proname, prosecdef from pg_proc where proname like 'admin_%';

-- 2. From a LOGGED-IN STAFF SESSION (not the SQL Editor, which runs as service role
--    and always answers differently).
select exists (select 1 from public.staff where id = auth.uid()) as boleh_tulis;

-- 3. Same session: the five new columns are present, access_code is NOT.
select * from admin_booking_roster(current_date, current_date);

-- 4. The code comes back, and exactly one log row is written per call.
select admin_booking_access_code(<booking_id>);
select count(*) from admin_access_code_log;
```

A non-staff session calling `admin_booking_access_code` must return `null` **and** insert nothing.

The four zero-row invariant queries in `CLAUDE.md` should still return zero rows — these migrations
don't touch `stay_images`, but run them as the standing regression check.

**Frontend**: `npm run build` (`tsc -b && vite build`, the type check that stands in for tests) and
`npm run lint`.

**Manual**

1. Bookings page: hover highlights the row; click opens the modal; `Tab` reaches a row and
   `Enter`/`Space` opens it; outside click and the × close it. The grid still has 6 aligned columns
   at tablet+ and still stacks into cards below tablet — the `display: contents` trick in
   `bookingTable.styles.ts` is what's most likely to break.
2. Modal shows the full phone; the table row still shows the masked form.
3. `Show` fetches only on click — no `admin_booking_access_code` request on modal open.
4. Dashboard with 1 / 2 / 4 / 0 confirmed arrivals: rail hidden at 1, 2 dots at 2, 3 dots with a
   sliding window at 4, empty state at 0. Swipe / wheel / drag / arrows / dots all land on a
   snapped slide. On a phone, swiping past the last card scrolls the page rather than trapping the
   gesture.
5. A booking whose guest account was deleted (in financials, missing from roster) renders `—` for
   guest name, phone, guests and notes instead of erroring.

---

## 9. Open items

- [x] Migrations `0019` and `0020` applied to the live project.
- [ ] Mouse-drag on the widget verified in a real browser — the pointer handlers write `scrollTop`
      directly and then snap by hand on release, which is the one part `tsc` can't check.
- [ ] Reworked layout checked at tablet and mobile widths. The 2-column `DetailGrid` collapses to
      one column below 768px; the arrivals card's own `MetaGrid` stays 2-up at every width, which
      is worth a look on a narrow phone.
- [ ] Seed data has no `access_code` on at least some bookings and no `phone` on at least some
      guests — worth confirming whether that's true of production data too, or an artifact of the
      seed. It changes how often staff will hit "No access code for this booking".
- [ ] `BookingRosterList.tsx` + its `STATUS_TAG` map stay dead after this change (`useBookingRoster`
      is revived, but that component is still unrendered). Worth deleting — out of scope for now,
      flagged rather than assumed.
