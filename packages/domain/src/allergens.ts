import type { Allergen, ProductTag } from "@dimsum/types";

/** Italian names of the 14 EU allergens (Reg. UE 1169/2011, Allegato II). */
export const ALLERGEN_LABELS: Record<Allergen, string> = {
  GLUTEN: "Glutine",
  CRUSTACEANS: "Crostacei",
  EGGS: "Uova",
  FISH: "Pesce",
  PEANUTS: "Arachidi",
  SOYBEANS: "Soia",
  MILK: "Latte",
  NUTS: "Frutta a guscio",
  CELERY: "Sedano",
  MUSTARD: "Senape",
  SESAME: "Sesamo",
  SULPHITES: "Solfiti",
  LUPIN: "Lupini",
  MOLLUSCS: "Molluschi",
};

export const PRODUCT_TAG_LABELS: Record<ProductTag, string> = {
  VEGETARIAN: "Vegetariano",
  VEGAN: "Vegano",
  SPICY: "Piccante",
  NEW: "Novità",
  BESTSELLER: "Più venduto",
  CONTAINS_COLOURANTS: "Contiene coloranti",
  ALCOHOLIC: "Alcolico",
};

export const SPICY_LEVEL_LABELS = ["", "Leggermente piccante", "Piccante", "Molto piccante"] as const;

export const ALLERGEN_DISCLAIMER =
  "Le informazioni sugli allergeni sono fornite dal ristorante. In cucina si utilizzano tutti i 14 allergeni: " +
  "in caso di allergie o intolleranze contattaci prima di ordinare.";
