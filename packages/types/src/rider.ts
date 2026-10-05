/** DTOs of the rider app (`/api/v1/rider`). Customer data is limited to what a delivery needs. */
import type { Cents, EtaDTO, GeoPoint, ISODateString } from "./dto";
import type { DeliveryStatus, OrderStatus, RiderAvailability } from "./enums";

export type RiderActionKey = "TO_RESTAURANT" | "ARRIVED" | "PICKED_UP" | "START_DELIVERY" | "DELIVERED";

export interface RiderDeliveryDTO {
  orderId: string;
  deliveryId: string;
  number: string;
  status: DeliveryStatus;
  orderStatus: OrderStatus;
  assignedAt: ISODateString | null;
  /** When the kitchen expects the food to be ready. */
  readyBy: ISODateString | null;
  readyAt: ISODateString | null;
  customer: { firstName: string; phone: string | null };
  destination: {
    addressLine: string;
    location: GeoPoint | null;
    staircase: string | null;
    floor: string | null;
    apartment: string | null;
    intercom: string | null;
    notes: string | null;
  };
  items: { name: string; quantity: number }[];
  itemCount: number;
  /** Cash to collect at the door (null = already paid online). */
  collectCents: Cents | null;
  tipCents: Cents;
  eta: EtaDTO | null;
  actions: RiderActionKey[];
}

export interface RiderHomeDTO {
  rider: { id: string; name: string; vehicle: string | null; availability: RiderAvailability };
  restaurant: {
    name: string;
    addressLine: string;
    location: GeoPoint;
    phone: string | null;
    timezone: string;
  };
  deliveries: RiderDeliveryDTO[];
  today: { delivered: number; tipsCents: Cents; cashCollectedCents: Cents };
  /** True while the app should share the position (a delivery is in progress). */
  shareLocation: boolean;
}
