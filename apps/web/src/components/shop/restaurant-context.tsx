"use client";

import type { RestaurantPublicDTO } from "@dimsum/types";
import { createContext, useContext, type ReactNode } from "react";

/** Restaurant data configured in the admin (name, address, checkout options), for client components. */
export type RestaurantInfo = Omit<RestaurantPublicDTO, "status">;

const Ctx = createContext<RestaurantInfo | null>(null);

export function RestaurantProvider({ value, children }: { value: RestaurantInfo; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRestaurant(): RestaurantInfo {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRestaurant must be used inside RestaurantProvider");
  return v;
}
