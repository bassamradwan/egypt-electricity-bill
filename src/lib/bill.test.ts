import { describe, expect, it } from "vitest";
import {
  calculateBill,
  consumptionFromReadings,
  maxKwhForBudget,
  parseWholeNumber,
  thresholdInsight,
} from "./bill";

// Every expected value below is worked out by hand from the official tariff (piasters):
//   up to 100 kWh:  1-50 @ 68, 51-100 @ 78
//   101-650 kWh:    restart from zero: 1-200 @ 95, 201-350 @ 155, 351-650 @ 195
//   651-1000 kWh:   all @ 210
//   above 1000 kWh: all @ 258
//   service fee:    0 kWh: 9 EGP, then 1, 2, 6, 11, 15, 25, 40 EGP by consumption

describe("calculateBill: totals at every boundary", () => {
  it.each([
    [0, 0, 900, 900],
    [1, 68, 100, 168],
    [50, 3400, 100, 3500],
    [51, 3478, 200, 3678],
    [100, 7300, 200, 7500],
    [101, 9595, 600, 10195],
    [200, 19000, 600, 19600],
    [201, 19155, 1100, 20255],
    [350, 42250, 1100, 43350],
    [351, 42445, 1500, 43945],
    [650, 100750, 1500, 102250],
    [651, 136710, 2500, 139210],
    [1000, 210000, 2500, 212500],
    [1001, 258258, 4000, 262258],
  ])("%i kWh: energy %i pt + fee %i pt = %i pt", (kwh, energy, fee, total) => {
    const bill = calculateBill(kwh);
    expect(bill.energyPiasters).toBe(energy);
    expect(bill.serviceFeePiasters).toBe(fee);
    expect(bill.totalPiasters).toBe(total);
  });
});

describe("calculateBill: the lines of the bill", () => {
  it("splits a small bill over the two cheapest bands", () => {
    expect(calculateBill(80).lines).toEqual([
      { fromKwh: 1, toKwh: 50, kwh: 50, piasters: 68, amountPiasters: 3400 },
      { fromKwh: 51, toKwh: 80, kwh: 30, piasters: 78, amountPiasters: 2340 },
    ]);
  });

  it("restarts from zero above 100 kWh", () => {
    const bill = calculateBill(450);
    expect(bill.restartedFromZero).toBe(true);
    expect(bill.lines).toEqual([
      { fromKwh: 1, toKwh: 200, kwh: 200, piasters: 95, amountPiasters: 19000 },
      { fromKwh: 201, toKwh: 350, kwh: 150, piasters: 155, amountPiasters: 23250 },
      { fromKwh: 351, toKwh: 450, kwh: 100, piasters: 195, amountPiasters: 19500 },
    ]);
  });

  it("charges all the consumption at one price above 650 kWh", () => {
    expect(calculateBill(700).lines).toEqual([
      { fromKwh: 1, toKwh: 700, kwh: 700, piasters: 210, amountPiasters: 147000 },
    ]);
  });

  it("charges all the consumption at the top price above 1000 kWh", () => {
    expect(calculateBill(1500).lines).toEqual([
      { fromKwh: 1, toKwh: 1500, kwh: 1500, piasters: 258, amountPiasters: 387000 },
    ]);
  });

  it("does not restart from zero up to 100 kWh", () => {
    expect(calculateBill(100).restartedFromZero).toBe(false);
  });

  it("has no lines for zero consumption", () => {
    expect(calculateBill(0).lines).toEqual([]);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])("rejects %s kWh", (kwh) => {
    expect(() => calculateBill(kwh)).toThrow(RangeError);
  });
});

describe("thresholdInsight", () => {
  it("one kWh above 650: says how much would have been saved", () => {
    expect(thresholdInsight(651).previous).toEqual({ limit: 650, overBy: 1, savingPiasters: 36960, near: true });
  });

  it("one kWh above 1000", () => {
    expect(thresholdInsight(1001).previous).toEqual({ limit: 1000, overBy: 1, savingPiasters: 49758, near: true });
  });

  it("one kWh above 100", () => {
    expect(thresholdInsight(101).previous).toEqual({ limit: 100, overBy: 1, savingPiasters: 2695, near: true });
  });

  it("far above a limit: still computed, but not near", () => {
    expect(thresholdInsight(2000).previous).toEqual({ limit: 1000, overBy: 1000, savingPiasters: 307500, near: false });
  });

  it("below a limit: says how far it is and what crossing it costs", () => {
    expect(thresholdInsight(600).next).toEqual({ limit: 650, remaining: 50, jumpPiasters: 36960, near: true });
  });

  it("exactly on a limit: zero kWh left before the jump", () => {
    expect(thresholdInsight(650).next).toEqual({ limit: 650, remaining: 0, jumpPiasters: 36960, near: true });
  });

  it("far below a limit: not near", () => {
    expect(thresholdInsight(450).next).toEqual({ limit: 650, remaining: 200, jumpPiasters: 36960, near: false });
  });

  it("no limit below 100 kWh, and none above 1000 kWh", () => {
    expect(thresholdInsight(80).previous).toBeNull();
    expect(thresholdInsight(1500).next).toBeNull();
  });
});

describe("maxKwhForBudget (prepaid meter)", () => {
  it.each([
    [0, 0],
    [167, 0],
    [168, 1],
    [7500, 100],
    [10194, 100],
    [10195, 101],
    [102250, 650],
    [139209, 650],
    [139210, 651],
    [212500, 1000],
    [262258, 1001],
  ])("%i piasters buys %i kWh", (budget, kwh) => {
    expect(maxKwhForBudget(budget)).toBe(kwh);
  });

  it("relies on the bill always growing from 1 kWh up (checked up to 5000 kWh)", () => {
    for (let kwh = 1; kwh < 5000; kwh++) {
      expect(calculateBill(kwh + 1).totalPiasters).toBeGreaterThan(calculateBill(kwh).totalPiasters);
    }
  });

  it.each([-1, 0.5, Number.NaN])("rejects a budget of %s", (budget) => {
    expect(() => maxKwhForBudget(budget)).toThrow(RangeError);
  });
});

describe("consumptionFromReadings", () => {
  it("is the current reading minus the previous one", () => {
    expect(consumptionFromReadings(12000, 12450)).toEqual({ ok: true, kwh: 450 });
  });

  it("rejects a current reading lower than the previous one", () => {
    expect(consumptionFromReadings(12450, 12000)).toEqual({ ok: false, error: "current_below_previous" });
  });

  it("rejects readings that are not whole non-negative numbers", () => {
    expect(consumptionFromReadings(-5, 10)).toEqual({ ok: false, error: "invalid_reading" });
    expect(consumptionFromReadings(1.5, 10)).toEqual({ ok: false, error: "invalid_reading" });
  });
});

describe("parseWholeNumber", () => {
  it.each([
    ["450", 450],
    ["  450 ", 450],
    ["٤٥٠", 450],
    ["۴۵۰", 450],
    ["12,450", 12450],
    ["١٢٬٤٥٠", 12450],
    ["0", 0],
  ])("reads %j as %i", (text, value) => {
    expect(parseWholeNumber(text)).toBe(value);
  });

  it.each(["", "   ", "abc", "4.5", "-3", "12a", "1234567890"])("rejects %j", (text) => {
    expect(parseWholeNumber(text)).toBeNull();
  });
});
