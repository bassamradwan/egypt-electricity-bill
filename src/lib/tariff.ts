// Egyptian residential electricity tariff.
// Prices are in piasters per kWh and fees in piasters, so every calculation stays in whole numbers.

/** A price band inside a group, for the kWh from the end of the previous band up to `upTo`. */
export interface Band {
  /** Last kWh of the band (inclusive). `null` = no upper limit. */
  upTo: number | null;
  /** Price in piasters per kWh. */
  piasters: number;
}

/**
 * Which bands apply depends on the TOTAL monthly consumption: the first group whose
 * `upTo` is greater than or equal to it. Each group starts counting from zero again,
 * which is why the bill jumps when the consumption crosses a group's limit.
 */
export interface ConsumptionGroup {
  /** Largest monthly consumption (kWh) this group covers. `null` = no upper limit. */
  upTo: number | null;
  bands: Band[];
}

/** The monthly customer service fee, by total consumption: the first entry whose `upTo` fits. */
export interface ServiceFee {
  upTo: number | null;
  piasters: number;
}

export interface Tariff {
  id: string;
  /** The first consumption month the prices apply to (YYYY-MM). */
  validFrom: string;
  /** When the prices were last compared with the official source (YYYY-MM-DD). */
  checkedOn: string;
  source: { name: string; url: string };
  groups: ConsumptionGroup[];
  serviceFees: ServiceFee[];
  /** Customer service fee for a month with zero consumption (or a closed unit). */
  zeroConsumptionFeePiasters: number;
}

/**
 * Residential tariff from the April 2026 consumption month, as published by
 * EgyptERA (Egyptian Electric Utility and Consumer Protection Regulatory Agency).
 * Customer service fees are the ones in force since January 2024 (same page).
 */
export const TARIFF_2026_04: Tariff = {
  id: "residential-2026-04",
  validFrom: "2026-04",
  checkedOn: "2026-11-11",
  source: {
    name: "EgyptERA",
    url: "https://egyptera.org/en/TarrifApril2026.aspx",
  },
  groups: [
    // Up to 100 kWh: the two cheapest bands.
    {
      upTo: 100,
      bands: [
        { upTo: 50, piasters: 68 },
        { upTo: 100, piasters: 78 },
      ],
    },
    // 101 to 650 kWh: counting restarts from zero, the first two bands no longer apply.
    {
      upTo: 650,
      bands: [
        { upTo: 200, piasters: 95 },
        { upTo: 350, piasters: 155 },
        { upTo: 650, piasters: 195 },
      ],
    },
    // 651 to 1000 kWh: ALL the consumption at one price.
    { upTo: 1000, bands: [{ upTo: 1000, piasters: 210 }] },
    // Above 1000 kWh: ALL the consumption at the highest price.
    { upTo: null, bands: [{ upTo: null, piasters: 258 }] },
  ],
  serviceFees: [
    { upTo: 50, piasters: 100 },
    { upTo: 100, piasters: 200 },
    { upTo: 200, piasters: 600 },
    { upTo: 350, piasters: 1100 },
    { upTo: 650, piasters: 1500 },
    { upTo: 1000, piasters: 2500 },
    { upTo: null, piasters: 4000 },
  ],
  zeroConsumptionFeePiasters: 900,
};

export const CURRENT_TARIFF = TARIFF_2026_04;
