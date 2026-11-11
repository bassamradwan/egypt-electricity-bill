import { CURRENT_TARIFF, type Tariff } from "./tariff";

// One color per price, from cool (cheapest) to hot (most expensive). Defined in globals.css.
const RAMP = ["--tier-1", "--tier-2", "--tier-3", "--tier-4", "--tier-5", "--tier-6", "--tier-7"];

/** The CSS color of a price per kWh: its rank among all the tariff's prices. */
export function priceColor(piasters: number, tariff: Tariff = CURRENT_TARIFF): string {
  const prices = [...new Set(tariff.groups.flatMap((g) => g.bands.map((b) => b.piasters)))].sort((a, b) => a - b);
  const rank = Math.max(0, prices.indexOf(piasters));
  return `var(${RAMP[Math.min(rank, RAMP.length - 1)]})`;
}

/** The limits where the bill jumps (100, 650, 1000 kWh). */
export function groupLimits(tariff: Tariff = CURRENT_TARIFF): number[] {
  return tariff.groups.map((g) => g.upTo).filter((l): l is number => l !== null);
}
