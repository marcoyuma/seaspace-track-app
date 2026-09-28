import { ReactNode, useEffect, useState } from "react";
import styled, { css } from "styled-components";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { HiOutlineExclamationCircle } from "react-icons/hi2";
import "leaflet/dist/leaflet.css";

import { SpinnerMini } from "../../../ui/SpinnerMini/SpinnerMini";
import {
    PlaceResult,
    reverseGeocode,
    searchPlaces,
} from "../services/geocoding";
import { MAX_FIT_ZOOM, zoomForPlaceType } from "../utils/placeZoom";
import { Label, TextInput } from "./StayFormLayout";
import { media } from "../../../styles/breakpoints";

/** Shortest query worth sending — one or two letters match half the country. */
const MIN_QUERY_LENGTH = 3;
/** Typing pause before searching. Long enough to skip most intermediate keystrokes. */
const SEARCH_DEBOUNCE_MS = 300;
/** Looser than search: this is confirmation after the map settles, not something staff wait on. */
const REVERSE_DEBOUNCE_MS = 500;

/**
 * Browser-visible by design: a free-quota basemap key, not a secret. CARTO has watermarked keyless
 * tiles with "API key required" since 2026-09-23 (docs.carto.com/faqs/carto-basemaps).
 *
 * Read through `import.meta.env`, not `process.env` — this is a Vite SPA, so `process` does not
 * exist in the browser and touching it throws during render.
 */
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY;

/**
 * CARTO Voyager tiles: OSMF's policy forbids production use of tile.openstreetmap.org, and Google
 * needs billing. Keyless still renders, just watermarked, so a missing key never breaks the page.
 * Leaflet fills {r} with "@2x" on retina screens.
 */
const TILE_URL = `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${
    CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : ""
}`;

// Module scope so it warns once per page load, not on every render of the picker.
if (!CARTO_API_KEY && import.meta.env.DEV) {
    console.warn(
        "VITE_CARTO_API_KEY is not set, so map tiles will carry CARTO's watermark. " +
            "Get a free key at https://carto.com/basemaps/apikey/",
    );
}

const Wrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
`;

// The suggestion list overlays the map instead of pushing it down — a list that reflows the
// form on every keystroke is the other half of what makes a picker feel unsteady.
const SearchArea = styled.div`
    position: relative;
`;

const Spinner = styled.div`
    position: absolute;
    top: 50%;
    right: 1.2rem;
    transform: translateY(-50%);
`;

const Results = styled.ul`
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    right: 0;
    z-index: 500;
    list-style: none;
    background-color: var(--color-grey-0);
    border: 1px solid var(--color-grey-200);
    border-radius: var(--border-radius-sm);
    box-shadow: var(--shadow-md);
    max-height: 22rem;
    overflow-y: auto;
`;

const ResultItem = styled.li`
    padding: 0.8rem 1.2rem;
    font-size: 1.3rem;
    cursor: pointer;
    border-bottom: 1px solid var(--color-grey-100);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background-color: var(--color-grey-100);
    }
`;

// Shorter on mobile (20rem vs the desktop 26rem) — approved tradeoff so a phone-sized modal
// doesn't need as much scrolling to get past the map to the rest of the form. Leaflet's own
// InvalidateSizeOnMount re-measure below still applies regardless of which height is active.
const MapShell = styled.div`
    position: relative;
    height: 20rem;
    border-radius: var(--border-radius-sm);
    overflow: hidden;
    border: 1px solid var(--color-grey-200);

    .leaflet-container {
        height: 100%;
        width: 100%;
    }

    ${media.tablet(css`
        height: 26rem;
    `)}
`;

/**
 * The pin is a static overlay at the centre of the viewport, not a Leaflet marker.
 *
 * `pointer-events: none` is load-bearing: the whole point of this pattern is that the drag
 * target is the entire map, so the pin must never swallow a drag that was meant for the map
 * underneath it.
 */
const CenterPin = styled.div`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -100%);
    z-index: 400;
    pointer-events: none;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50% 50% 50% 0;
    rotate: -45deg;
    background-color: var(--color-brand-600);
    border: 3px solid var(--color-grey-0);
    box-shadow: var(--shadow-md);
`;

const MapHint = styled.div`
    position: absolute;
    bottom: 1.2rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 400;
    pointer-events: none;
    background-color: var(--color-grey-0);
    color: var(--color-grey-600);
    font-size: 1.2rem;
    padding: 0.4rem 1.2rem;
    border-radius: 100px;
    box-shadow: var(--shadow-sm);
    white-space: nowrap;
`;

const EmptyMap = styled.div`
    height: 20rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 0 2.4rem;
    font-size: 1.3rem;
    color: var(--color-grey-500);
    background-color: var(--color-grey-50);
    border: 1px dashed var(--color-grey-200);
    border-radius: var(--border-radius-sm);

    ${media.tablet(css`
        height: 26rem;
    `)}
`;

const Readout = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 1.3rem;
    color: var(--color-grey-600);
`;

const Coordinates = styled.span`
    font-size: 1.2rem;
    color: var(--color-grey-500);
`;

// Deliberately not `StayFormLayout`'s popup-style `ErrorText`: that one anchors itself
// (`position: absolute`) against the nearest positioned ancestor, which here would be the
// surrounding `Field`, not the search box or map immediately above — it would float in the
// wrong place. This picker already juggles its own absolute-positioned layers (`Results`
// dropdown at z-index 500, the pin/hint over the map at 400), so its errors stay simple
// inline text instead of adding another one to referee.
const ErrorRow = styled.span`
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 1.2rem;
    color: var(--color-red-700);

    & svg {
        width: 1.4rem;
        height: 1.4rem;
        flex-shrink: 0;
    }
`;

function ErrorText({ children }: { children: ReactNode }) {
    return (
        <ErrorRow role="alert">
            <HiOutlineExclamationCircle />
            {children}
        </ErrorRow>
    );
}

/** Reports the map's centre — where the fixed pin points — once panning settles. */
function ReportCenterOnMove({
    onSettle,
}: {
    onSettle: (lat: number, lng: number) => void;
}) {
    const map = useMapEvents({
        moveend: () => {
            const { lat, lng } = map.getCenter();
            onSettle(lat, lng);
        },
    });
    return null;
}

/**
 * Moves the viewport to a chosen search result, scaled to what that result actually is: a city
 * fills the frame as a city, a building as a building.
 *
 * Driven only by search picks — never by the lat/lng props. Those props are updated *by* panning
 * (via `moveend`), so reacting to them here would fight the hand doing the panning.
 */
function FlyToResult({ result }: { result: PlaceResult | null }) {
    const map = useMap();

    useEffect(() => {
        if (!result) return;

        if (result.extent) {
            const [minLon, minLat, maxLon, maxLat] = result.extent;
            map.fitBounds(
                [
                    [minLat, minLon],
                    [maxLat, maxLon],
                ],
                { maxZoom: MAX_FIT_ZOOM },
            );
            return;
        }

        map.setView([result.lat, result.lng], zoomForPlaceType(result.type));
    }, [result, map]);

    return null;
}

/**
 * Leaflet measures its container once at init. Both forms mount inside a modal that animates
 * in (`transition: all 0.5s` on the modal shell), so the size measured on mount can be the
 * mid-animation one — which shows as tiles filling only part of the map, or grey gaps.
 * Re-measuring after the transition settles fixes it.
 *
 * MapShell's height also changes via a CSS media query (20rem mobile / 26rem tablet+), which
 * Leaflet can't detect on its own since it's not a resize it triggered — so this also
 * re-measures on window resize, which covers a breakpoint crossing (e.g. rotating a phone, or
 * a devtools viewport resize) while the modal is already open.
 */
function InvalidateSizeOnMount() {
    const map = useMap();

    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), 600);

        const handleResize = () => map.invalidateSize();
        window.addEventListener("resize", handleResize);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", handleResize);
        };
    }, [map]);

    return null;
}

interface StayLocationPickerProps {
    lat?: number;
    lng?: number;
    onCoordinatesChange: (lat: number, lng: number) => void;
    /** Called with a ready-to-use "{District}, Bali" string when staff pick a search result. */
    onLocationSuggest: (location: string) => void;
    error?: string;
}

/**
 * Place search + map position picker used by both stays forms in place of raw lat/lng inputs.
 *
 * Two stages on purpose (STAYS-INPUT-DECISIONS.md decision 2): searching a place name only ever
 * lands on an area, never on the villa itself, so the search gets staff to the right
 * neighbourhood and panning puts the pin on the building.
 *
 * The pin is fixed at the centre and the map moves under it — the pattern Airbnb, Uber and
 * Gojek all use for address entry. It makes the drag target the whole map rather than a small
 * marker, which is what makes fine positioning feel steady rather than fiddly.
 *
 * @example
 * <StayLocationPicker
 *     lat={stay.lat}
 *     lng={stay.lng}
 *     onCoordinatesChange={(lat, lng) => { setValue("lat", lat); setValue("lng", lng); }}
 *     onLocationSuggest={setSuggestedLocation}
 * />
 */
export function StayLocationPicker({
    lat,
    lng,
    onCoordinatesChange,
    onLocationSuggest,
    error,
}: StayLocationPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<PlaceResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [chosenResult, setChosenResult] = useState<PlaceResult | null>(null);
    const [address, setAddress] = useState("");

    // Must be a finiteness check, not just `typeof === "number"`: the create form registers
    // lat/lng as empty hidden inputs with `valueAsNumber`, which reads back as NaN — and NaN is
    // typeof "number", so a looser guard hands Leaflet [NaN, NaN] and it throws
    // "Invalid LatLng object" during render. NaN here means "no pin chosen yet".
    const pin: [number, number] | null =
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        typeof lng === "number" &&
        Number.isFinite(lng)
            ? [lat, lng]
            : null;

    // Search-as-you-type. The abort in cleanup is what keeps the list monotonic: without it a
    // slow request for "can" can resolve after a fast one for "canggu" and replace better
    // suggestions with worse ones.
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setResults([]);
            setSearchError("");
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setIsSearching(true);
            setSearchError("");
            try {
                const found = await searchPlaces(trimmed, controller.signal);
                setResults(found);
                if (found.length === 0)
                    setSearchError("No places in Indonesia matched that");
            } catch (err) {
                if (controller.signal.aborted) return;
                setSearchError(
                    err instanceof Error ? err.message : "Place search failed",
                );
            } finally {
                if (!controller.signal.aborted) setIsSearching(false);
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    // Names whatever the pin is now sitting on. Deliberately silent on failure — the
    // coordinates are valid regardless of whether OSM has anything to call that spot.
    const pinLat = pin?.[0];
    const pinLng = pin?.[1];

    useEffect(() => {
        if (typeof pinLat !== "number" || typeof pinLng !== "number") return;

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                setAddress(
                    await reverseGeocode(pinLat, pinLng, controller.signal),
                );
            } catch {
                setAddress("");
            }
        }, REVERSE_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [pinLat, pinLng]);

    const pickResult = (result: PlaceResult) => {
        onCoordinatesChange(result.lat, result.lng);
        onLocationSuggest(result.locationSuggestion);
        setChosenResult(result);
        setResults([]);
        setQuery(result.label);
    };

    return (
        <Wrapper>
            <Label htmlFor="place-search">Find the villa on the map</Label>

            <SearchArea>
                <TextInput
                    id="place-search"
                    type="text"
                    autoComplete="off"
                    placeholder="Start typing a place, e.g. Canggu"
                    $hasError={!!searchError || !!error}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    // Enter must not reach the surrounding form — it would submit the whole
                    // villa. There is nothing to trigger here; results arrive on their own.
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                    }}
                />

                {isSearching && (
                    <Spinner>
                        <SpinnerMini />
                    </Spinner>
                )}

                {/* Rendered inline rather than portalled: the Modal closes on any click whose
                    target isn't inside its ref, so a portalled dropdown would dismiss the
                    entire form. */}
                {results.length > 0 && (
                    <Results>
                        {results.map((result) => (
                            <ResultItem
                                key={`${result.lat},${result.lng},${result.label}`}
                                onClick={() => pickResult(result)}
                            >
                                {result.label}
                            </ResultItem>
                        ))}
                    </Results>
                )}
            </SearchArea>

            {searchError && <ErrorText>{searchError}</ErrorText>}

            {pin ? (
                <MapShell>
                    {/* Wheel zoom stays off: this map sits inside a tall scrolling modal, and a
                        map that eats the wheel traps staff halfway down the form. Leaflet's +/−
                        buttons remain available for zooming. */}
                    <MapContainer
                        center={pin}
                        zoom={16}
                        scrollWheelZoom={false}
                    >
                        {/* CARTO, matching the customer site's map. Attribution must stay
                            visible — it is a condition of CARTO's free tier. */}
                        <TileLayer
                            url={TILE_URL}
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                        <ReportCenterOnMove onSettle={onCoordinatesChange} />
                        <FlyToResult result={chosenResult} />
                        <InvalidateSizeOnMount />
                    </MapContainer>

                    <CenterPin />
                    <MapHint>Drag the map to put the pin on the villa</MapHint>
                </MapShell>
            ) : (
                <EmptyMap>
                    Start typing a place above, pick a suggestion, then drag the
                    map to put the pin on the villa itself.
                </EmptyMap>
            )}

            {pin && (
                <Readout>
                    {address && <span>{address}</span>}
                    <Coordinates>
                        {pin[0].toFixed(6)}, {pin[1].toFixed(6)}
                    </Coordinates>
                </Readout>
            )}

            {error && <ErrorText>{error}</ErrorText>}
        </Wrapper>
    );
}
