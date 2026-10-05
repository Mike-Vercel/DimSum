/**
 * Role-based access control (least privilege). Shared by the API and any future native admin.
 */
import type { Role } from "@dimsum/types";

export type Permission =
  | "orders:read"
  | "orders:manage"
  | "orders:refund"
  | "orders:pause"
  | "catalog:availability"
  | "catalog:edit"
  | "settings:edit"
  | "hours:edit"
  | "zones:edit"
  | "riders:assign"
  | "riders:manage"
  | "customers:read"
  | "coupons:manage"
  | "loyalty:manage"
  | "analytics:read"
  | "support:manage"
  | "staff:manage"
  | "audit:read"
  | "rider:self";

const STAFF_AND_UP: Role[] = ["STAFF", "ADMIN", "SUPER_ADMIN"];
const ADMIN_AND_UP: Role[] = ["ADMIN", "SUPER_ADMIN"];

const MATRIX: Record<Permission, readonly Role[]> = {
  "orders:read": STAFF_AND_UP,
  "orders:manage": STAFF_AND_UP,
  "orders:refund": ADMIN_AND_UP,
  "orders:pause": STAFF_AND_UP,
  "catalog:availability": STAFF_AND_UP,
  "catalog:edit": ADMIN_AND_UP,
  "settings:edit": ADMIN_AND_UP,
  "hours:edit": ADMIN_AND_UP,
  "zones:edit": ADMIN_AND_UP,
  "riders:assign": STAFF_AND_UP,
  "riders:manage": ADMIN_AND_UP,
  "customers:read": ADMIN_AND_UP,
  "coupons:manage": ADMIN_AND_UP,
  "loyalty:manage": ADMIN_AND_UP,
  "analytics:read": ADMIN_AND_UP,
  "support:manage": STAFF_AND_UP,
  "staff:manage": ["SUPER_ADMIN"],
  "audit:read": ADMIN_AND_UP,
  "rider:self": ["RIDER"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[permission].includes(role);
}

export function isStaffRole(role: Role | null | undefined): boolean {
  return !!role && STAFF_AND_UP.includes(role);
}

export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(MATRIX) as Permission[]).filter((p) => MATRIX[p].includes(role));
}
