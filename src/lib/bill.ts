import { CURRENT_TARIFF, type Tariff } from "./tariff";

// All money is in piasters (1 EGP = 100 piasters) so that every sum is a whole number:
// no floating-point surprises like 0.1 + 0.2 = 0.30000000000000004.

export interface BillLine {
  fromKwh: number;
  toKwh: number;
  kwh: number;
  /** Price per kWh in this line, in piasters. */
  piasters: number;
  amountPiasters: number;
}

export interface Bill {
  kwh: number;
  lines: BillLine[];
  energyPiasters: number;
  serviceFeePiasters: number;
  totalPiasters: number;
  /** True when the consumption is above the first group, so the cheapest bands no longer apply. */
  restartedFromZero: boolean;
}

/** Within this many kWh of a limit, the page points it out. */
export const NEAR_LIMIT_KWH = 50;

function assertWholeNonNegative(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${what} must be a whole number of 0 or more, got ${value}`);
  }
}

/** The monthly bill for a whole number of kWh. */
export function calculateBill(kwh: number, tariff: Tariff = CURRENT_TARIFF): Bill {
  assertWholeNonNegative(kwh, "Consumption");

  if (kwh === 0) {
    const fee = tariff.zeroConsumptionFeePiasters;
    return { kwh, lines: [], energyPiasters: 0, serviceFeePiasters: fee, totalPiasters: fee, restartedFromZero: false };
  }

  // The total consumption decides which group of bands applies.
  const groupIndex = tariff.groups.findIndex((g) => g.upTo === null || kwh <= g.upTo);
  const group = tariff.groups[groupIndex]!;

  // Walk the group's bands from zero, filling each one until the consumption is used up.
  const lines: BillLine[] = [];
  let counted = 0;
  for (const band of group.bands) {
    if (counted >= kwh) break;
    const bandEnd = band.upTo === null ? kwh : Math.min(band.upTo, kwh);
    const inBand = bandEnd - counted;
    lines.push({
      fromKwh: counted + 1,
      toKwh: bandEnd,
      kwh: inBand,
      piasters: band.piasters,
      amountPiasters: inBand * band.piasters,
    });
    counted = bandEnd;
  }

  const energyPiasters = lines.reduce((sum, line) => sum + line.amountPiasters, 0);
  const serviceFeePiasters = tariff.serviceFees.find((f) => f.upTo === null || kwh <= f.upTo)!.piasters;

  return {
    kwh,
    lines,
    energyPiasters,
    serviceFeePiasters,
    totalPiasters: energyPiasters + serviceFeePiasters,
    restartedFromZero: groupIndex > 0,
  };
}

export interface PreviousLimit {
  /** The group limit the consumption went over (for example 650). */
  limit: number;
  overBy: number;
  /** How much less the bill would have been at exactly the limit. */
  savingPiasters: number;
  near: boolean;
}

export interface NextLimit {
  /** The next group limit (for example 650). */
  limit: number;
  /** kWh left before crossing it. */
  remaining: number;
  /** How much one more kWh past the limit adds to the bill. */
  jumpPiasters: number;
  near: boolean;
}

/**
 * The bill jumps when the consumption crosses a group limit (100, 650 and 1000 kWh),
 * because the counting restarts from zero at a higher price. This says how far the
 * consumption is from the limits around it, and what each one costs.
 */
export function thresholdInsight(
  kwh: number,
  tariff: Tariff = CURRENT_TARIFF,
): { previous: PreviousLimit | null; next: NextLimit | null } {
  assertWholeNonNegative(kwh, "Consumption");
  const total = (k: number) => calculateBill(k, tariff).totalPiasters;
  const limits = tariff.groups.map((g) => g.upTo).filter((l): l is number => l !== null);

  const below = limits.filter((l) => l < kwh).at(-1);
  const above = limits.find((l) => l >= kwh);

  return {
    previous:
      below === undefined
        ? null
        : {
            limit: below,
            overBy: kwh - below,
            savingPiasters: total(kwh) - total(below),
            near: kwh - below <= NEAR_LIMIT_KWH,
          },
    next:
      above === undefined
        ? null
        : {
            limit: above,
            remaining: above - kwh,
            jumpPiasters: total(above + 1) - total(above),
            near: above - kwh <= NEAR_LIMIT_KWH,
          },
  };
}

/**
 * The most kWh a prepaid card of `budgetPiasters` pays for in a month.
 *
 * The bill grows with every extra kWh from 1 kWh up (the tests check this), so a binary
 * search finds the answer in about 20 steps instead of trying every value.
 * 0 kWh is left out of the search: its fee (9 EGP) is higher than the bill for 1 kWh.
 */
export function maxKwhForBudget(budgetPiasters: number, tariff: Tariff = CURRENT_TARIFF): number {
  assertWholeNonNegative(budgetPiasters, "Budget");
  const total = (k: number) => calculateBill(k, tariff).totalPiasters;
  if (budgetPiasters < total(1)) return 0;

  // The cheapest price is the lowest band, so the budget can never buy more than this.
  const cheapest = Math.min(...tariff.groups.flatMap((g) => g.bands.map((b) => b.piasters)));
  let low = 1; // always affordable
  let high = Math.floor(budgetPiasters / cheapest) + 1; // never affordable
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (total(middle) <= budgetPiasters) low = middle;
    else high = middle;
  }
  return low;
}

export type ReadingsResult =
  | { ok: true; kwh: number }
  | { ok: false; error: "invalid_reading" | "current_below_previous" };

/** The month's consumption from the meter's previous and current readings. */
export function consumptionFromReadings(previous: number, current: number): ReadingsResult {
  const valid = (n: number) => Number.isInteger(n) && n >= 0;
  if (!valid(previous) || !valid(current)) return { ok: false, error: "invalid_reading" };
  if (current < previous) return { ok: false, error: "current_below_previous" };
  return { ok: true, kwh: current - previous };
}

/**
 * Reads what a person types in a number field: Western, Arabic (٠-٩) or Persian (۰-۹)
 * digits, with optional thousands separators. Only whole numbers up to 9 digits.
 * Returns null for anything else.
 */
export function parseWholeNumber(text: string): number | null {
  const digits = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[,٬]/g, ""); // "," and the Arabic thousands separator "٬"
  if (!/^\d{1,9}$/.test(digits)) return null;
  return Number(digits);
}
