"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { bearingDegrees, haversineMeters, type LatLng } from "@dimsum/domain";
import {
  AttributionControl,
  LngLatBounds,
  Map as MlMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { LOGO } from "@/components/brand/logo-data";
import { publicEnv } from "@/lib/public-env";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export interface MapMarker {
  id: string;
  kind: "restaurant" | "destination" | "rider";
  position: LatLng;
  heading?: number | null;
  label?: string;
  /** Smaller pin, for overview maps where it must not cover what is around it. */
  compact?: boolean;
}

export interface MapPolygon {
  id: string;
  coordinates: LatLng[];
  color: string;
  active?: boolean;
}

export interface MapViewProps {
  center: LatLng;
  zoom?: number;
  theme?: "light" | "dark";
  markers?: MapMarker[];
  route?: [number, number][] | null;
  polygons?: MapPolygon[];
  circles?: { id: string; center: LatLng; radiusMeters: number; color: string; active?: boolean }[];
  fitTo?: LatLng[] | null;
  padding?: { top: number; bottom: number; left: number; right: number };
  interactive?: boolean;
  /** Pin-drop mode: the page draws a fixed pin in the middle and receives the map centre. */
  onCenterChange?: (center: LatLng) => void;
  onMapClick?: (point: LatLng) => void;
  className?: string;
  ariaLabel?: string;
}

const RIDER_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>`;

function markerElement(m: MapMarker): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "img");
  if (m.kind === "restaurant") {
    el.setAttribute("aria-label", m.label ?? "Ristorante");
    const size = m.compact ? 28 : 44;
    el.innerHTML = `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:#0e0d0c;display:grid;place-items:center;box-shadow:0 6px 18px rgba(14,13,12,.35);border:${m.compact ? 2 : 3}px solid #fff"><svg viewBox="${LOGO.seal.x} 0 ${LOGO.seal.width} ${LOGO.seal.height}" height="${m.compact ? 14 : 24}" fill="#e8382b"><path d="${LOGO.seal.d}"/></svg></div>`;
  } else if (m.kind === "destination") {
    el.setAttribute("aria-label", m.label ?? "Destinazione");
    el.innerHTML = `<svg width="40" height="50" viewBox="0 0 40 50" style="filter:drop-shadow(0 6px 10px rgba(14,13,12,.3));transform:translateY(-22px)"><path d="M20 49c0 0 18-17.4 18-29.2A18 18 0 0 0 2 19.8C2 31.6 20 49 20 49z" fill="#d82a1e" stroke="#fff" stroke-width="3"/><circle cx="20" cy="20" r="6.5" fill="#fff"/></svg>`;
  } else {
    el.setAttribute("aria-label", m.label ?? "Rider");
    el.innerHTML = `<div class="dimsum-rider" style="position:relative;width:48px;height:48px;display:grid;place-items:center"><span style="position:absolute;inset:0;border-radius:9999px;background:rgba(216,42,30,.22);animation:dimsum-pulse 1.8s cubic-bezier(.22,1,.36,1) infinite"></span><div data-heading style="position:absolute;inset:-6px;transition:transform .8s cubic-bezier(.22,1,.36,1)"><svg viewBox="0 0 60 60" width="60" height="60"><path d="M30 2 l7 10 h-14z" fill="#d82a1e"/></svg></div><div style="position:relative;width:40px;height:40px;border-radius:9999px;background:#d82a1e;display:grid;place-items:center;border:3px solid #fff;box-shadow:0 8px 20px rgba(216,42,30,.45)">${RIDER_SVG}</div></div>`;
  }
  return el;
}

function brandStyle(map: MlMap, theme: "light" | "dark") {
  type PaintProp = Parameters<MlMap["setPaintProperty"]>[1];
  const set = (layer: string, prop: PaintProp, value: string) => {
    if (map.getLayer(layer)) map.setPaintProperty(layer, prop, value);
  };
  if (theme === "light") {
    set("background", "background-color", "#f4efe8");
    set("water", "fill-color", "#cfdbe0");
    set("park", "fill-color", "#e2e7d3");
    set("landuse_residential", "fill-color", "#efe8de");
    set("building", "fill-color", "#e8e0d4");
  } else {
    set("background", "background-color", "#121110");
  }
}

function circlePolygon(center: LatLng, radius: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  const latR = radius / 111_320;
  const lngR = radius / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([center.lng + lngR * Math.cos(a), center.lat + latR * Math.sin(a)]);
  }
  return coords;
}

/** Animates a marker between positions so the rider glides instead of jumping. */
function glide(marker: Marker, from: LatLng, to: LatLng, durationMs: number, frame: { id: number }) {
  cancelAnimationFrame(frame.id);
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce || haversineMeters(from, to) > 2_000) {
    marker.setLngLat([to.lng, to.lat]);
    return;
  }
  const start = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / durationMs);
    const e = 1 - (1 - k) ** 3;
    marker.setLngLat([from.lng + (to.lng - from.lng) * e, from.lat + (to.lat - from.lat) * e]);
    if (k < 1) frame.id = requestAnimationFrame(step);
  };
  frame.id = requestAnimationFrame(step);
}

export default function MapView({
  center,
  zoom = 14,
  theme = "light",
  markers = [],
  route = null,
  polygons = [],
  circles = [],
  fitTo = null,
  padding = { top: 48, bottom: 48, left: 48, right: 48 },
  interactive = true,
  onCenterChange,
  onMapClick,
  className,
  ariaLabel = "Mappa",
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markerRefs = useRef(new Map<string, { marker: Marker; position: LatLng; frame: { id: number } }>());
  const loaded = useRef(false);
  const readyQueue = useRef<(() => void)[]>([]);
  const callbacks = useRef({ onCenterChange, onMapClick });

  useEffect(() => {
    callbacks.current = { onCenterChange, onMapClick };
  });

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const map = new MlMap({
      container: container.current,
      style: theme === "dark" ? publicEnv.mapStyleDarkUrl : publicEnv.mapStyleUrl,
      center: [center.lng, center.lat],
      zoom,
      interactive,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    if (interactive && !onCenterChange)
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      loaded.current = true;
      brandStyle(map, theme);
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#d82a1e", "line-width": 4.5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: "zones",
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "active"], 0.14, 0.05] },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: "zones",
        paint: { "line-color": ["get", "color"], "line-width": 2, "line-dasharray": [2, 1.5] },
      });
      readyQueue.current.splice(0).forEach((fn) => fn());
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      callbacks.current.onCenterChange?.({ lat: c.lat, lng: c.lng });
    });
    map.on("click", (e) => callbacks.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    mapRef.current = map;
    const refs = markerRefs.current;
    return () => {
      refs.forEach((r) => cancelAnimationFrame(r.frame.id));
      refs.clear();
      map.remove();
      mapRef.current = null;
      loaded.current = false;
    };
    // The map instance is created once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Markers (diffed, rider glides).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const refs = markerRefs.current;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = refs.get(m.id);
      if (existing) {
        if (existing.position.lat !== m.position.lat || existing.position.lng !== m.position.lng) {
          if (m.kind === "rider") {
            glide(existing.marker, existing.position, m.position, 1800, existing.frame);
            const heading = m.heading ?? bearingDegrees(existing.position, m.position);
            const arrow = existing.marker.getElement().querySelector<HTMLElement>("[data-heading]");
            if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
          } else {
            existing.marker.setLngLat([m.position.lng, m.position.lat]);
          }
          existing.position = m.position;
        }
        continue;
      }
      const marker = new Marker({
        element: markerElement(m),
        anchor: m.kind === "destination" ? "bottom" : "center",
      })
        .setLngLat([m.position.lng, m.position.lat])
        .addTo(map);
      if (m.kind === "rider" && m.heading != null) {
        const arrow = marker.getElement().querySelector<HTMLElement>("[data-heading]");
        if (arrow) arrow.style.transform = `rotate(${m.heading}deg)`;
      }
      refs.set(m.id, { marker, position: m.position, frame: { id: 0 } });
    }
    for (const [id, r] of refs) {
      if (!seen.has(id)) {
        cancelAnimationFrame(r.frame.id);
        r.marker.remove();
        refs.delete(id);
      }
    }
  }, [markers]);

  // Route and zones (GeoJSON sources, applied once the style is ready).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const routeSrc = map.getSource("route") as { setData?: (d: unknown) => void } | undefined;
      routeSrc?.setData?.({
        type: "FeatureCollection",
        features: route?.length
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route } }]
          : [],
      });
      const zoneSrc = map.getSource("zones") as { setData?: (d: unknown) => void } | undefined;
      zoneSrc?.setData?.({
        type: "FeatureCollection",
        features: [
          ...polygons.map((p) => ({
            type: "Feature",
            properties: { id: p.id, color: p.color, active: p.active ?? true },
            geometry: {
              type: "Polygon",
              coordinates: [
                [...p.coordinates.map((c) => [c.lng, c.lat]), [p.coordinates[0]!.lng, p.coordinates[0]!.lat]],
              ],
            },
          })),
          ...circles.map((c) => ({
            type: "Feature",
            properties: { id: c.id, color: c.color, active: c.active ?? true },
            geometry: { type: "Polygon", coordinates: [circlePolygon(c.center, c.radiusMeters)] },
          })),
        ],
      });
    };
    if (loaded.current) apply();
    else readyQueue.current.push(apply);
  }, [route, polygons, circles]);

  // Camera: fit to points or follow the centre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fitTo && fitTo.length >= 2) {
      const b = new LngLatBounds();
      fitTo.forEach((p) => b.extend([p.lng, p.lat]));
      map.fitBounds(b, { padding, maxZoom: 16, duration: 900 });
    } else if (!onCenterChange) {
      map.easeTo({ center: [center.lng, center.lat], zoom, duration: 700 });
    }
    // Only react to meaningful camera inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(fitTo), center.lat, center.lng, zoom]);

  return <div ref={container} className={className} role="region" aria-label={ariaLabel} />;
}

export function flyTo(map: MlMap | null, point: LatLng, zoom = 17) {
  map?.flyTo({ center: [point.lng, point.lat], zoom, speed: 1.4 });
}
