import { normalize, type Recipe } from "./recipes";

export type PantryUnit = "count" | "g" | "ml" | "portion";
export type PantrySource = "manual" | "voice" | "demo" | "scan" | "cook" | "correction";

export type PantryItem = {
  id: string;
  name: string;
  quantityEstimate: number;
  unit: PantryUnit;
  confidence: number;
  source: PantrySource;
  useSoonDays?: number;
  updatedAt?: string;
};

export type ScannedPantryItem = {
  name: string;
  quantityEstimate: number;
  unit: PantryUnit;
  confidence: number;
  useSoonDays?: number;
};

export type InventoryEventType = "ADD" | "COOK" | "CORRECTION" | "DISCARD";

export type InventoryEvent = {
  id: string;
  pantryItemId: string;
  pantryItemName: string;
  type: InventoryEventType;
  quantityChange: number;
  unit: PantryUnit;
  confidence: number;
  source: PantrySource;
  recipeId?: string;
  createdAt: string;
};

export type ConsumptionEstimate = {
  pantryItemId: string;
  name: string;
  quantity: number;
  unit: PantryUnit;
  confidence: number;
};

export function pantryItemId(name: string) {
  return `pantry-${normalize(name).replace(/[^a-z0-9]+/g, "-")}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function scannedPantryItem(item: ScannedPantryItem): PantryItem {
  return {
    id: pantryItemId(item.name),
    name: item.name.trim(),
    quantityEstimate: Math.max(0.1, item.quantityEstimate || 1),
    unit: item.unit,
    confidence: Math.max(0.2, Math.min(0.99, item.confidence || 0.6)),
    source: "scan",
    updatedAt: nowIso(),
    ...(item.useSoonDays != null ? { useSoonDays: Math.max(0, Math.round(item.useSoonDays)) } : {}),
  };
}

export function defaultPantryItem(name: string, source: PantrySource = "manual"): PantryItem {
  return {
    id: pantryItemId(name),
    name: name.trim(),
    quantityEstimate: 1,
    unit: "portion",
    confidence: source === "manual" ? 0.9 : 0.78,
    source,
    updatedAt: nowIso(),
  };
}

export const DEMO_PANTRY: PantryItem[] = [
  {
    id: "pantry-egg",
    name: "Eggs",
    quantityEstimate: 8,
    unit: "count",
    confidence: 0.96,
    source: "demo",
    useSoonDays: 6,
  },
  {
    id: "pantry-tomato",
    name: "Tomatoes",
    quantityEstimate: 5,
    unit: "count",
    confidence: 0.92,
    source: "demo",
    useSoonDays: 2,
  },
  {
    id: "pantry-cheddar",
    name: "Cheddar",
    quantityEstimate: 240,
    unit: "g",
    confidence: 0.88,
    source: "demo",
    useSoonDays: 7,
  },
  {
    id: "pantry-bread",
    name: "Bread",
    quantityEstimate: 8,
    unit: "count",
    confidence: 0.9,
    source: "demo",
    useSoonDays: 4,
  },
  {
    id: "pantry-avocado",
    name: "Avocado",
    quantityEstimate: 2,
    unit: "count",
    confidence: 0.84,
    source: "demo",
    useSoonDays: 2,
  },
  {
    id: "pantry-lemon",
    name: "Lemon",
    quantityEstimate: 2,
    unit: "count",
    confidence: 0.9,
    source: "demo",
    useSoonDays: 8,
  },
  {
    id: "pantry-mayonnaise",
    name: "Mayonnaise",
    quantityEstimate: 180,
    unit: "g",
    confidence: 0.76,
    source: "demo",
  },
  {
    id: "pantry-onion",
    name: "Onion",
    quantityEstimate: 2,
    unit: "count",
    confidence: 0.93,
    source: "demo",
    useSoonDays: 10,
  },
];

function fractionToNumber(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value);
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(value);
  if (mixed) {
    const whole = Number(mixed[1]);
    const top = Number(mixed[2]);
    const bottom = Number(mixed[3]);
    return bottom ? whole + top / bottom : null;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(value);
  if (frac) {
    const top = Number(frac[1]);
    const bottom = Number(frac[2]);
    return bottom ? top / bottom : null;
  }
  return null;
}

function unitFromLine(line: string, fallback: PantryUnit): PantryUnit {
  const lower = line.toLowerCase();
  if (/\b(?:g|gram|grams)\b/.test(lower)) return "g";
  if (/\b(?:ml|millilitre|millilitres|milliliter|milliliters)\b/.test(lower)) return "ml";
  if (
    /\b(?:egg|eggs|tomato|tomatoes|avocado|avocados|lemon|lemons|onion|onions|slice|slices|clove|cloves)\b/.test(
      lower,
    )
  ) {
    return "count";
  }
  return fallback;
}

function amountFromLine(line: string): number | null {
  const amount = /\b(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\b/.exec(line)?.[1];
  return amount ? fractionToNumber(amount) : null;
}

function lineForItem(recipe: Recipe, item: PantryItem) {
  const lines = recipe.ingredientLines ?? [];
  const needle = normalize(item.name);
  return lines.find((line) => {
    const lower = line.toLowerCase();
    return lower.includes(needle) || normalize(lower).includes(needle);
  });
}

export function estimateRecipeConsumption(
  recipe: Recipe,
  pantryItems: PantryItem[],
): ConsumptionEstimate[] {
  const required = recipe.keyIngredients.map(normalize);

  return pantryItems
    .filter((item) => item.quantityEstimate > 0 && required.includes(normalize(item.name)))
    .map((item) => {
      const line = lineForItem(recipe, item);
      const parsedAmount = line ? amountFromLine(line) : null;
      const parsedUnit = line ? unitFromLine(line, item.unit) : item.unit;

      let quantity: number;
      if (parsedAmount && parsedUnit === item.unit) {
        quantity = parsedAmount;
      } else if (item.unit === "count") {
        quantity = Math.min(1, item.quantityEstimate);
      } else if (item.unit === "g") {
        quantity = Math.min(60, item.quantityEstimate);
      } else if (item.unit === "ml") {
        quantity = Math.min(60, item.quantityEstimate);
      } else {
        quantity = Math.min(1, item.quantityEstimate);
      }

      return {
        pantryItemId: item.id,
        name: item.name,
        quantity: Math.max(0, Math.min(quantity, item.quantityEstimate)),
        unit: item.unit,
        confidence: line ? 0.95 : 0.72,
      };
    })
    .filter((item) => item.quantity > 0);
}

export function applyConsumption(
  pantryItems: PantryItem[],
  estimates: ConsumptionEstimate[],
): PantryItem[] {
  const byId = new Map(estimates.map((estimate) => [estimate.pantryItemId, estimate]));
  return pantryItems.map((item) => {
    const estimate = byId.get(item.id);
    if (!estimate) return item;
    return {
      ...item,
      quantityEstimate: Math.max(0, item.quantityEstimate - estimate.quantity),
      confidence: Math.max(0.55, Math.min(0.99, (item.confidence + estimate.confidence) / 2)),
      source: "cook",
      updatedAt: nowIso(),
    };
  });
}

export function formatPantryQuantity(quantity: number, unit: PantryUnit) {
  const rounded = Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toFixed(1).replace(/\.0$/, "");
  if (unit === "g" || unit === "ml") return `${rounded} ${unit}`;
  if (unit === "count") return rounded;
  return `${rounded} portion${quantity === 1 ? "" : "s"}`;
}
