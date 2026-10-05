"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { reportNetworkFailure } from "@/lib/connectivity";
import { useServiceWorker } from "@/lib/service-worker";
import { rehydrateStores, useCrossTabSync } from "@/lib/stores/hydration";
import { Toaster } from "./ui/toaster";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, error) => {
          if (error instanceof ApiError) {
            if (error.isNetwork) reportNetworkFailure();
            if (error.status >= 400 && error.status < 500) return false;
          }
          return count < 2;
        },
      },
      mutations: {
        retry: false,
        onError: (error) => {
          if (error instanceof ApiError && error.isNetwork) reportNetworkFailure();
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  useEffect(() => rehydrateStores(), []);
  useCrossTabSync();
  useServiceWorker();
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        {children}
        <Toaster />
      </MotionConfig>
    </QueryClientProvider>
  );
}
