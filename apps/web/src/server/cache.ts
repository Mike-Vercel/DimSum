import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Expires cached data right away after a staff change (menu, settings, zones, offers): the next
 * request renders fresh content. Live clients are updated separately over the realtime channel.
 */
export function expireTags(...tags: string[]): void {
  for (const tag of tags) revalidateTag(tag, { expire: 0 });
}
