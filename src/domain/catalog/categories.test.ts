import { describe, it, expect } from "vitest";
import { PlaceCategory } from "@prisma/client";
import { getCategoryConfig, CATEGORY_CONFIGS } from "./categories";

describe("Category Metadata & Symbolic Placeholders", () => {
  it("provides canonical configuration for MONUMENT", () => {
    const config = getCategoryConfig(PlaceCategory.MONUMENT);
    expect(config.label).toBe("Monument");
    expect(config.iconType).toBe("Landmark");
    expect(config.textColor).toBe("text-indigo-700");
  });

  it("provides canonical configuration for RESTAURANT", () => {
    const config = getCategoryConfig(PlaceCategory.RESTAURANT);
    expect(config.label).toBe("Restaurant");
    expect(config.iconType).toBe("Utensils");
    expect(config.textColor).toBe("text-amber-700");
  });

  it("falls back gracefully to OTHER for null or unknown category", () => {
    const configNull = getCategoryConfig(null);
    expect(configNull.label).toBe("Other");
    expect(configNull.iconType).toBe("MapPin");

    const configUnknown = getCategoryConfig("NON_EXISTING");
    expect(configUnknown.label).toBe("Other");
  });

  it("has configurations defined for all PlaceCategory enum values", () => {
    const allCategories = Object.values(PlaceCategory);
    for (const cat of allCategories) {
      expect(CATEGORY_CONFIGS[cat]).toBeDefined();
      expect(CATEGORY_CONFIGS[cat].label).toBeTruthy();
      expect(CATEGORY_CONFIGS[cat].iconType).toBeTruthy();
    }
  });
});
