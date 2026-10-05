"use client";

import type { ServiceStatusDTO } from "@dimsum/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useRealtime } from "./realtime";

export const statusKey = ["restaurant", "status"] as const;

/** Opening state + ETA ranges, refreshed every minute and on "Blocca ordini" toggles. */
export function useServiceStatus(initial?: ServiceStatusDTO) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: statusKey,
    queryFn: ({ signal }) => api.restaurant.status(signal),
    // Server data is fresh at render time; 0 keeps the render free of clock reads.
    ...(initial ? { initialData: initial, initialDataUpdatedAt: 0 } : {}),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  useRealtime(["catalog"], (event) => {
    if (event.type === "restaurant.status") void qc.invalidateQueries({ queryKey: statusKey });
  });
  return query;
}
