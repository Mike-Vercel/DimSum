import type { SupportCategory, SupportStatus } from "@dimsum/types";

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  ORDER_ISSUE: "Problema con l'ordine",
  MISSING_ITEM: "Prodotto mancante o sbagliato",
  DELIVERY: "Consegna",
  PAYMENT: "Pagamento o rimborso",
  OTHER: "Altro",
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  OPEN: "Aperta",
  IN_PROGRESS: "In gestione",
  RESOLVED: "Risolta",
  CLOSED: "Chiusa",
};
