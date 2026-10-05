"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useSession } from "./auth-client";

const key = ["me", "favorites"] as const;

/** Favorites are account-only and synced with the database (optimistic updates). */
export function useFavorites() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const enabled = !!session;
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.me.favorites.list(),
    enabled,
    staleTime: 5 * 60_000,
  });
  const ids = new Set(query.data?.productIds ?? []);

  const mutation = useMutation({
    mutationFn: ({ productId, on }: { productId: string; on: boolean }) =>
      on ? api.me.favorites.add(productId) : api.me.favorites.remove(productId),
    onMutate: async ({ productId, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<{ productIds: string[] }>(key);
      qc.setQueryData<{ productIds: string[] }>(key, (cur) => {
        const set = new Set(cur?.productIds ?? []);
        if (on) set.add(productId);
        else set.delete(productId);
        return { productIds: [...set] };
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });

  return {
    signedIn: enabled,
    isFavorite: (productId: string) => ids.has(productId),
    toggle: (productId: string) => mutation.mutate({ productId, on: !ids.has(productId) }),
    ids,
    isLoading: query.isLoading,
  };
}
