import { formatDayLabel, formatTime, listSlots } from "@dimsum/domain";
import type { DaySlotsDTO } from "@dimsum/types";
import { slotsQuery } from "@dimsum/validation";
import { apiRoute } from "@/server/http";
import { getRestaurantConfig, toScheduleConfig } from "@/server/services/restaurant";

/** Bookable time slots for scheduled orders ("Programma"). */
export const GET = apiRoute({ auth: "public" }, async ({ query }) => {
  const { fulfillmentType } = query(slotsQuery);
  const config = await getRestaurantConfig();
  const now = new Date();
  const enabled = fulfillmentType === "DELIVERY" ? config.deliveryEnabled : config.pickupEnabled;
  const days: DaySlotsDTO[] = enabled
    ? listSlots(toScheduleConfig(config), fulfillmentType, now).map((d) => ({
        date: d.dateKey,
        label: formatDayLabel(d.dateKey, now, config.timezone),
        slots: d.slots.map((s) => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
          label: `${formatTime(s.start, config.timezone)}–${formatTime(s.end, config.timezone)}`,
          available: true,
        })),
      }))
    : [];
  return { days };
});
