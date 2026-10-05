"use client";

import type {
  AddressSuggestionDTO,
  DeliveryQuoteDTO,
  GeocodedAddressDTO,
  GeoPoint,
  SavedAddressDTO,
} from "@dimsum/types";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, Home, LocateFixed, MapPin, PenLine, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Map } from "@/components/maps/map";
import { useRestaurant } from "@/components/shop/restaurant-context";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { currentPosition, GeolocationFailure } from "@/lib/geolocation";
import { haptics } from "@/lib/haptics";
import type { DeliveryAddress } from "@/lib/stores/order-prefs";
import { DeliveryAreaMap } from "./delivery-area-map";
import { DeliveryCheck } from "./delivery-check";

type Stage = "search" | "confirm";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const emptyDetails = { staircase: null, floor: null, apartment: null, intercom: null, riderNotes: null };

const LOWERCASE_WORDS = new Set(["di", "del", "della", "dello", "dei", "degli", "delle", "da", "e"]);

/**
 * Street and house number as typed, for a street missing from the map data:
 * "via adragna 12, palermo" → "Via Adragna", "12"; "via della liberta" → "Via della Liberta".
 */
function typedAddress(text: string): { street: string; number: string } {
  const head = (text.split(",")[0] ?? "").trim().replace(/\s+/g, " ");
  const m = head.match(/\s(\d{1,4})\s*\/?\s*([a-z])?$/i);
  const street = (m ? head.slice(0, m.index) : head)
    .split(" ")
    .map((w, i) =>
      i > 0 && LOWERCASE_WORDS.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
  return { street, number: m ? `${m[1]}${m[2] ?? ""}`.toUpperCase() : "" };
}

/**
 * Address entry: autocomplete → map with draggable pin → structured fields + rider details,
 * with a live zone check. Used by the header sheet, checkout and account address book.
 */
export function AddressPicker({
  initial,
  onConfirm,
  onSwitchToPickup,
  confirmLabel = "Conferma indirizzo",
  embedded = false,
}: {
  initial: DeliveryAddress | null;
  onConfirm: (address: DeliveryAddress, quote: DeliveryQuoteDTO) => void;
  onSwitchToPickup?: () => void;
  confirmLabel?: string;
  /** Inline in a page column (no sheet gutters) instead of inside a sheet or dialog. */
  embedded?: boolean;
}) {
  const gutter = embedded ? "" : "px-5";
  const restaurant = useRestaurant();
  const { data: session } = useSession();
  const [stage, setStage] = useState<Stage>(initial ? "confirm" : "search");
  const [query, setQuery] = useState("");
  const [sessionToken] = useState(() => crypto.randomUUID());
  const [address, setAddress] = useState<DeliveryAddress | null>(initial);
  const [pin, setPin] = useState<GeoPoint | null>(initial?.location ?? null);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const skipNextReverse = useRef(true);
  // Typed by hand (street missing from the map data): moving the pin keeps the customer's text.
  const manual = useRef(false);
  const debounced = useDebounced(query.trim(), 200);

  const suggestions = useQuery({
    queryKey: ["geo", "suggest", debounced],
    queryFn: ({ signal }) => api.geo.suggest(debounced, sessionToken, signal),
    enabled: stage === "search" && debounced.length >= 3,
    staleTime: 5 * 60_000,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const searchError = suggestions.error
    ? suggestions.error instanceof ApiError
      ? suggestions.error.message
      : "La ricerca degli indirizzi non risponde. Riprova o usa la tua posizione."
    : null;

  const saved = useQuery({
    queryKey: ["me", "addresses"],
    queryFn: () => api.me.addresses.list(),
    enabled: !!session,
    staleTime: 60_000,
  });

  // Zone check whenever the confirmed point or its precision changes.
  const precision = address ? (address.streetNumber.trim() ? "rooftop" : address.precision) : "approximate";
  const quoteQuery = useQuery({
    queryKey: ["delivery", "quote", pin?.lat, pin?.lng, precision],
    queryFn: () =>
      api.delivery.quote({ location: pin!, precision: precision === "street" ? "street" : precision }),
    enabled: stage === "confirm" && !!pin,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const quote: DeliveryQuoteDTO | null = quoteQuery.data ?? null;
  const quoting = quoteQuery.isFetching;
  const quoteError = quoteQuery.error
    ? quoteQuery.error instanceof ApiError
      ? quoteQuery.error.message
      : "Verifica non riuscita."
    : null;

  const choose = (a: GeocodedAddressDTO, details: Partial<DeliveryAddress> = {}) => {
    setError(null);
    manual.current = false;
    skipNextReverse.current = true;
    setAddress({ ...emptyDetails, ...a, ...details, savedAddressId: details.savedAddressId ?? null });
    setPin(a.location);
    setStage("confirm");
    setShowFields(!(details.streetNumber ?? a.streetNumber));
  };

  const pickSuggestion = async (s: AddressSuggestionDTO) => {
    try {
      const { address: a } = await api.geo.details(s.id, sessionToken);
      haptics.select();
      choose(a);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Indirizzo non trovato.");
    }
  };

  /** Street missing from the map data: the customer types it and places the pin on the map. */
  const enterManually = () => {
    const typed = typedAddress(query);
    setError(null);
    manual.current = true;
    skipNextReverse.current = true;
    setAddress({
      ...emptyDetails,
      street: typed.street,
      streetNumber: typed.number,
      postalCode: "",
      city: restaurant.address.city,
      province: restaurant.address.province,
      country: "IT",
      formatted: "",
      location: restaurant.location,
      placeId: null,
      precision: "approximate",
      savedAddressId: null,
    });
    setPin(restaurant.location);
    setStage("confirm");
    setShowFields(true);
  };

  const useMyPosition = async () => {
    setLocating(true);
    setError(null);
    try {
      const p = await currentPosition();
      const { address: a } = await api.geo.reverse(p.lat, p.lng);
      if (a) choose(a);
      else {
        setPin(p);
        setStage("confirm");
        setShowFields(true);
      }
    } catch (e) {
      setError(
        e instanceof GeolocationFailure || e instanceof ApiError ? e.message : "Posizione non disponibile.",
      );
    } finally {
      setLocating(false);
    }
  };

  // "Sposta il pin": reverse geocode the new centre, keep the house number the customer typed.
  const onCenterChange = async (center: GeoPoint) => {
    if (skipNextReverse.current) {
      skipNextReverse.current = false;
      return;
    }
    if (pin && Math.abs(center.lat - pin.lat) < 1e-6 && Math.abs(center.lng - pin.lng) < 1e-6) return;
    setPin(center);
    if (manual.current) {
      setAddress((prev) => (prev ? { ...prev, location: center } : prev));
      return;
    }
    try {
      const { address: a } = await api.geo.reverse(center.lat, center.lng);
      if (!a) return;
      setAddress((prev) => ({
        ...emptyDetails,
        ...a,
        streetNumber: a.streetNumber || (prev && prev.street === a.street ? prev.streetNumber : ""),
        staircase: prev?.staircase ?? null,
        floor: prev?.floor ?? null,
        apartment: prev?.apartment ?? null,
        intercom: prev?.intercom ?? null,
        riderNotes: prev?.riderNotes ?? null,
        savedAddressId: null,
        location: center,
      }));
    } catch {
      /* keep the previous text, the pin position is what matters */
    }
  };

  const update = (patch: Partial<DeliveryAddress>) => setAddress((a) => (a ? { ...a, ...patch } : a));

  const missingNumber = !!address && !address.streetNumber.trim();
  const canConfirm = !!address && !!pin && !missingNumber && !!quote?.deliverable && !quoting;

  if (stage === "search") {
    const list = suggestions.data?.suggestions ?? [];
    const searching = debounced.length >= 3;
    return (
      <div className={cn("flex flex-col gap-4 pb-6", gutter)}>
        <label className="relative block">
          <span className="sr-only">Cerca il tuo indirizzo</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-subtle"
            aria-hidden
          />
          {/* No autofocus: the keyboard opens when the customer taps the field, not with the sheet. */}
          <Input
            data-sheet-anchor
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Via e numero civico, es. Via Roma 12"
            className="rounded-full pr-12 pl-12"
            autoComplete="street-address"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              aria-label="Cancella"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 tap place-items-center rounded-full text-fg-subtle"
            >
              <X className="size-4.5" />
            </button>
          ) : null}
        </label>

        {error ? <InlineAlert tone="danger" title={error} /> : null}

        {searching ? (
          <div className="space-y-3">
            {list.length > 0 ? (
              <ul
                className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line"
                role="listbox"
                aria-label="Suggerimenti"
              >
                {list.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => void pickSuggestion(s)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                    >
                      <MapPin className="mt-0.5 size-4.5 shrink-0 text-fg-subtle" aria-hidden />
                      <span>
                        <span className="block font-semibold">{s.primaryText}</span>
                        <span className="block text-caption text-fg-muted">{s.secondaryText}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : suggestions.isFetching ? (
              <p className="px-1 text-body-sm text-fg-muted" role="status">
                Cerco l&apos;indirizzo…
              </p>
            ) : searchError ? (
              <InlineAlert tone="danger" title={searchError} />
            ) : (
              <p className="px-1 text-body-sm text-fg-muted" role="status">
                Non troviamo questa via nella zona in cui consegniamo.
              </p>
            )}
            {!suggestions.isFetching ? (
              <button
                type="button"
                onClick={enterManually}
                className="flex w-full tap items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-line ring-inset"
              >
                <PenLine className="size-4.5 shrink-0 text-fg-muted" aria-hidden />
                <span className="text-body-sm">
                  <span className="block font-semibold">Non trovi la tua via?</span>
                  <span className="block text-fg-muted">Inseriscila a mano e sposta il pin sulla mappa</span>
                </span>
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={useMyPosition}
              disabled={locating}
              className="flex tap items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 ring-line"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <LocateFixed className={cn("size-5", locating && "animate-pulse")} />
              </span>
              <span>
                <span className="block font-semibold">
                  {locating ? "Sto cercando la tua posizione…" : "Usa la mia posizione"}
                </span>
                <span className="block text-caption text-fg-muted">
                  Ti chiediamo il permesso solo per questo
                </span>
              </span>
            </button>

            {saved.data?.addresses.length ? (
              <section>
                <h3 className="mb-2 text-caption font-semibold tracking-wide text-fg-muted uppercase">
                  I tuoi indirizzi
                </h3>
                <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
                  {saved.data.addresses.map((a: SavedAddressDTO) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => choose(a, { ...a, savedAddressId: a.id })}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-2"
                      >
                        <Home className="mt-0.5 size-4.5 shrink-0 text-fg-subtle" aria-hidden />
                        <span>
                          <span className="block font-semibold">
                            {a.label ?? `${a.street} ${a.streetNumber}`}
                          </span>
                          <span className="block text-caption text-fg-muted">{a.formatted}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section>
              <h3 className="mb-2 text-caption font-semibold tracking-wide text-fg-muted uppercase">
                Dove consegniamo
              </h3>
              <DeliveryAreaMap />
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className={cn("relative h-56 overflow-hidden rounded-2xl ring-1 ring-line", !embedded && "mx-5")}>
        <Map
          center={pin ?? restaurant.location}
          zoom={17}
          onCenterChange={(c) => void onCenterChange(c)}
          ariaLabel="Mappa: sposta il pin sulla posizione esatta"
        />
        {/* Fixed centre pin: the map moves under it. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <svg
            width="40"
            height="50"
            viewBox="0 0 40 50"
            className="-translate-y-[22px] drop-shadow-lg"
            aria-hidden
          >
            <path
              d="M20 49c0 0 18-17.4 18-29.2A18 18 0 0 0 2 19.8C2 31.6 20 49 20 49z"
              fill="#d82a1e"
              stroke="#fff"
              strokeWidth="3"
            />
            <circle cx="20" cy="20" r="6.5" fill="#fff" />
          </svg>
        </div>
        <p className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/80 px-3 py-1 text-micro font-semibold text-white backdrop-blur">
          Sposta la mappa per posizionare il pin
        </p>
      </div>

      <div className={cn("space-y-4 pt-4 pb-6", gutter)}>
        <div className="flex items-start gap-3">
          <MapPin className="mt-1 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {address
                ? `${address.street}${address.streetNumber ? ` ${address.streetNumber}` : ""}`
                : "Posizione selezionata"}
            </p>
            <p className="text-body-sm text-fg-muted">
              {address
                ? [address.postalCode, address.city, address.province].filter(Boolean).join(" ")
                : "Completa i dati qui sotto"}
            </p>
          </div>
          <button
            type="button"
            className="text-body-sm font-semibold text-brand-ink"
            onClick={() => setStage("search")}
          >
            Cambia
          </button>
        </div>

        {missingNumber ? (
          <InlineAlert tone="warning" title="Manca il numero civico">
            Aggiungilo qui sotto: serve al rider per trovarti.
          </InlineAlert>
        ) : null}

        <button
          type="button"
          onClick={() => setShowFields((s) => !s)}
          className="flex items-center gap-1 text-body-sm font-semibold text-fg-muted"
          aria-expanded={showFields}
        >
          Via, civico, CAP e città
          <ChevronDown className={cn("size-4 transition-transform", showFields && "rotate-180")} />
        </button>
        <AnimatePresence initial={false}>
          {showFields && address ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-6 gap-3 pb-1">
                <Field label="Via" className="col-span-4">
                  {(p) => (
                    <Input
                      {...p}
                      value={address.street}
                      onChange={(e) => update({ street: e.target.value })}
                      autoComplete="address-line1"
                    />
                  )}
                </Field>
                <Field label="Civico" className="col-span-2" error={missingNumber ? "Obbligatorio" : null}>
                  {(p) => (
                    <Input
                      {...p}
                      value={address.streetNumber}
                      onChange={(e) => update({ streetNumber: e.target.value })}
                      inputMode="text"
                    />
                  )}
                </Field>
                <Field label="CAP" className="col-span-2">
                  {(p) => (
                    <Input
                      {...p}
                      value={address.postalCode}
                      onChange={(e) => update({ postalCode: e.target.value })}
                      inputMode="numeric"
                      maxLength={5}
                      autoComplete="postal-code"
                    />
                  )}
                </Field>
                <Field label="Città" className="col-span-3">
                  {(p) => (
                    <Input
                      {...p}
                      value={address.city}
                      onChange={(e) => update({ city: e.target.value })}
                      autoComplete="address-level2"
                    />
                  )}
                </Field>
                <Field label="Prov." className="col-span-1">
                  {(p) => (
                    <Input
                      {...p}
                      value={address.province}
                      onChange={(e) => update({ province: e.target.value.toUpperCase() })}
                      maxLength={2}
                      className="px-2 text-center"
                    />
                  )}
                </Field>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <DeliveryCheck
          quote={quote}
          loading={quoting}
          onChangeAddress={() => setStage("search")}
          onSwitchToPickup={onSwitchToPickup}
        />

        {address ? (
          <fieldset className="space-y-3">
            <legend className="mb-2 font-bold">
              Dettagli per il rider <span className="font-normal text-fg-muted">(facoltativi)</span>
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Scala">
                {(p) => (
                  <Input
                    {...p}
                    value={address.staircase ?? ""}
                    onChange={(e) => update({ staircase: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Piano">
                {(p) => (
                  <Input
                    {...p}
                    value={address.floor ?? ""}
                    onChange={(e) => update({ floor: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Interno">
                {(p) => (
                  <Input
                    {...p}
                    value={address.apartment ?? ""}
                    onChange={(e) => update({ apartment: e.target.value || null })}
                  />
                )}
              </Field>
            </div>
            <Field label="Citofono">
              {(p) => (
                <Input
                  {...p}
                  value={address.intercom ?? ""}
                  onChange={(e) => update({ intercom: e.target.value || null })}
                  placeholder="Nome sul citofono"
                />
              )}
            </Field>
            <Field label="Note per il rider">
              {(p) => (
                <Textarea
                  {...p}
                  rows={2}
                  maxLength={240}
                  value={address.riderNotes ?? ""}
                  onChange={(e) => update({ riderNotes: e.target.value || null })}
                  placeholder="Es. portone verde, suonare due volte"
                />
              )}
            </Field>
          </fieldset>
        ) : null}

        {(error ?? quoteError) ? <InlineAlert tone="danger" title={error ?? quoteError} /> : null}

        <Button
          size="lg"
          block
          disabled={!canConfirm}
          onClick={() => {
            if (!address || !pin || !quote) return;
            haptics.success();
            onConfirm(
              {
                ...address,
                location: pin,
                precision: "rooftop",
                formatted: `${address.street} ${address.streetNumber}, ${address.postalCode} ${address.city}`,
              },
              quote,
            );
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
