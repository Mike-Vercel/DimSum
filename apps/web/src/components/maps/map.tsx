"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { MapViewProps } from "./map-view";

/** MapLibre is heavy (~250 kB gz): loaded only on pages that actually show a map. */
const LazyMap = dynamic(() => import("./map-view"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

export function Map(props: MapViewProps) {
  return <LazyMap {...props} className={cn("size-full", props.className)} />;
}

export type { MapMarker, MapPolygon, MapViewProps } from "./map-view";
