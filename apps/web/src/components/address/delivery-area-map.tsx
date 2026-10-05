"use client";

import { formatEuro, type LatLng } from "@dimsum/domain";
import type { DeliveryAreaDTO } from "@dimsum/types";
import { useQuery } from "@tanstack/react-query";
import { Map } from "@/components/maps/map";
import { Skeleton } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Zone = DeliveryAreaDTO["zones"][number];

/** Bounding points of a circle, to frame the map around every zone. */
function circleBounds(center: LatLng, radiusMeters: number): LatLng[] {
  const dLat = radiusMeters / 111_320;
  const dLng = dLat / Math.cos((center.lat * Math.PI) / 180);
  return [
    { lat: center.lat - dLat, lng: center.lng - dLng },
    { lat: center.lat + dLat, lng: center.lng + dLng },
  ];
}

function zoneTerms(z: Zone): string {
  const fee = z.deliveryFeeCents ? `Consegna ${formatEuro(z.deliveryFeeCents)}` : "Consegna gratis";
  const minimum = z.minimumOrderCents ? ` · minimo ${formatEuro(z.minimumOrderCents)}` : "";
  const free = z.freeDeliveryThresholdCents ? ` · gratis da ${formatEuro(z.freeDeliveryThresholdCents)}` : "";
  return `${fee}${minimum}${free}`;
}

/** "Dove consegniamo": the exact delivery zones on a map, with fee and minimum order for each. */
export function DeliveryAreaMap({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["delivery", "area"],
    queryFn: () => api.delivery.area(),
    staleTime: 60 * 60_000,
  });
  if (!data) return <Skeleton className={cn("h-72 rounded-2xl", className)} />;
  if (!data.zones.length) return null;

  const polygons = data.zones
    .filter((z) => z.polygon?.length)
    .map((z) => ({ id: z.id, coordinates: z.polygon!, color: z.color }));
  const circles = data.zones
    .filter((z) => z.center && z.radiusMeters)
    .map((z) => ({ id: z.id, center: z.center!, radiusMeters: z.radiusMeters!, color: z.color }));
  const frame = [
    data.restaurant,
    ...polygons.flatMap((p) => p.coordinates),
    ...circles.flatMap((c) => circleBounds(c.center, c.radiusMeters)),
  ];
  // The map draws the largest zone first; the legend reads from the nearest one.
  const legend = [...data.zones].reverse();

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-surface ring-1 ring-line", className)}>
      <div className="h-64">
        <Map
          center={data.restaurant}
          zoom={13}
          markers={[
            {
              id: "restaurant",
              kind: "restaurant",
              position: data.restaurant,
              label: "DIMSUM",
              compact: true,
            },
          ]}
          polygons={polygons}
          circles={circles}
          fitTo={frame}
          padding={{ top: 24, bottom: 24, left: 24, right: 24 }}
          interactive={false}
          ariaLabel="Mappa delle zone in cui consegniamo"
        />
      </div>
      <ul className="divide-y divide-line">
        {legend.map((z) => (
          <li key={z.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="mt-1 size-3 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: z.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm font-semibold">{z.name}</span>
              <span className="block text-caption text-fg-muted">
                {zoneTerms(z)}
                {!z.polygon && !z.center && z.maxDistanceMeters
                  ? ` · entro ${(z.maxDistanceMeters / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km di percorso`
                  : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
