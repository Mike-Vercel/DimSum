"use client";

import type { GeoPoint } from "@dimsum/types";
import { Map } from "@/components/maps/map";

export function RestaurantMap({ location, name }: { location: GeoPoint; name: string }) {
  return (
    <Map
      center={location}
      zoom={16}
      ariaLabel={`Posizione di ${name}`}
      markers={[{ id: "restaurant", kind: "restaurant", position: location, label: name }]}
    />
  );
}
