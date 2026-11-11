import { describe, expect, it } from "vitest";
import { digitGlyphs, formatAmount, formatMoney, formatNumber, plainDigits } from "./format";
import { priceColor } from "./tiers";
import { translate } from "./i18n";

describe("formatMoney", () => {
  it("formats piasters as pounds in English", () => {
    expect(formatMoney(139210, "en")).toBe("EGP 1,392.10");
    expect(formatMoney(900, "en")).toBe("EGP 9.00");
  });

  it("uses Arabic-Indic digits, no thousands separator, and the word جنيه in Arabic", () => {
    // "١٣٩٢٫١٠", not "١٬٣٩٢٫١٠": in many fonts ٬ and ٫ look alike and read as 1,392,10.
    expect(formatMoney(139210, "ar")).toBe("١٣٩٢٫١٠ جنيه");
  });
});

describe("formatAmount", () => {
  it("is the amount without the currency", () => {
    expect(formatAmount(36960, "en")).toBe("369.60");
    expect(formatAmount(36960, "ar")).toBe("٣٦٩٫٦٠");
  });
});

describe("formatNumber", () => {
  it("uses the digits of each language", () => {
    expect(formatNumber(650, "en")).toBe("650");
    expect(formatNumber(650, "ar")).toBe("٦٥٠");
  });

  it("groups thousands in English only", () => {
    expect(formatNumber(12000, "en")).toBe("12,000");
    expect(formatNumber(12000, "ar")).toBe("١٢٠٠٠");
  });
});

describe("plainDigits", () => {
  it("writes a number with the language's digits and no separators", () => {
    expect(plainDigits(12651, "ar")).toBe("١٢٦٥١");
    expect(plainDigits(12651, "en")).toBe("12651");
  });
});

describe("digitGlyphs", () => {
  it("has ten digits in order", () => {
    expect(digitGlyphs("en").join("")).toBe("0123456789");
    expect(digitGlyphs("ar").join("")).toBe("٠١٢٣٤٥٦٧٨٩");
  });
});

describe("priceColor", () => {
  it("gives the cheapest price the coolest color and the highest the hottest", () => {
    expect(priceColor(68)).toBe("var(--tier-1)");
    expect(priceColor(195)).toBe("var(--tier-5)");
    expect(priceColor(258)).toBe("var(--tier-7)");
  });
});

describe("translate", () => {
  it("fills in placeholders", () => {
    expect(translate("en", "lineRange", { from: "1", to: "200" })).toBe("1 to 200 kWh");
  });

  it("leaves an unknown placeholder visible instead of hiding it", () => {
    expect(translate("en", "lineRange", { from: "1" })).toBe("1 to {to} kWh");
  });
});
