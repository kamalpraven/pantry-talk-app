import { describe, expect, it } from "vitest";
import { defaultPantryItem, scannedPantryItem, type PantryItem } from "./inventory";
import { mergeGuestIntoAccount, mergePantryItems, normalizedPantryName } from "./pantry-merge";

function item(input: Partial<PantryItem> & Pick<PantryItem, "name">): PantryItem {
  return {
    ...defaultPantryItem(input.name),
    ...input,
  };
}

describe("pantry merge", () => {
  it("normalizes pantry names", () => {
    expect(normalizedPantryName("Tomatoes")).toBe("tomato");
  });

  it("deduplicates equivalent ingredients without blindly summing quantities", () => {
    const merged = mergeGuestIntoAccount(
      [item({ name: "tomato", quantityEstimate: 2, unit: "count", confidence: 0.7 })],
      [item({ name: "Tomatoes", quantityEstimate: 4, unit: "count", confidence: 0.95 })],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantityEstimate).toBe(4);
  });

  it("is idempotent when the same guest kitchen is migrated more than once", () => {
    const account = [item({ name: "Milk", quantityEstimate: 1, unit: "portion", confidence: 0.8 })];
    const guest = [item({ name: "milk", quantityEstimate: 2, unit: "portion", confidence: 0.9 })];

    const once = mergeGuestIntoAccount(account, guest);
    const twice = mergeGuestIntoAccount(once, guest);

    expect(twice).toEqual(once);
  });

  it("preserves the most urgent use-soon metadata", () => {
    const merged = mergePantryItems([
      item({ name: "Milk", useSoonDays: 5, confidence: 0.8 }),
      item({ name: "milk", useSoonDays: 2, confidence: 0.7 }),
    ]);

    expect(merged[0]?.useSoonDays).toBe(2);
  });

  it("does not invent conversions when units conflict", () => {
    const merged = mergePantryItems([
      item({ name: "Chicken", quantityEstimate: 500, unit: "g", confidence: 0.7 }),
      item({ name: "chicken", quantityEstimate: 2, unit: "portion", confidence: 0.95 }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.unit).toBe("g");
    expect(merged[0]?.quantityEstimate).toBe(500);
  });

  it("deduplicates repeated scan results", () => {
    const merged = mergePantryItems([
      scannedPantryItem({
        name: "Mushrooms",
        quantityEstimate: 1,
        unit: "portion",
        confidence: 0.8,
      }),
      scannedPantryItem({
        name: "mushroom",
        quantityEstimate: 2,
        unit: "portion",
        confidence: 0.9,
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.name.toLowerCase()).toContain("mushroom");
  });
});
