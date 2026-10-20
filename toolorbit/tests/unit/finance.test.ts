import { describe, expect, it } from "vitest";
import * as F from "@/tools/logic/finance";

describe("percentages, discounts, tax", () => {
  it("percentages", () => {
    expect(F.percentOf(15, 240)).toBe(36);
    expect(F.whatPercent(36, 240)).toBe(15);
    expect(F.percentChange(100, 150)).toBe(50);
    expect(F.percentChange(-100, -50)).toBe(50);
    expect(() => F.percentChange(0, 1)).toThrow();
    expect(() => F.whatPercent(1, 0)).toThrow();
  });
  it("stacked discounts multiply", () => {
    const d = F.discount(100, 20, 20);
    expect(d.finalPrice).toBeCloseTo(64);
    expect(d.effectivePercent).toBeCloseTo(36);
    expect(() => F.discount(100, 120)).toThrow();
  });
  it("VAT add/remove", () => {
    expect(F.addTax(100, 20)).toEqual({ net: 100, tax: 20, gross: 120 });
    const r = F.removeTax(120, 20);
    expect(r.net).toBeCloseTo(100);
    expect(r.tax).toBeCloseTo(20);
    expect(F.roundMoney(F.removeTax(54.11, 8.25).net)).toBe(49.99);
  });
});

describe("loans", () => {
  it("amortized payment matches reference values", () => {
    // $200,000 at 6% for 30 years → $1,199.10
    expect(F.roundMoney(F.amortizedPayment(200000, 6, 360))).toBe(1199.1);
    expect(F.amortizedPayment(1200, 0, 12)).toBe(100);
    expect(() => F.amortizedPayment(1000, -1, 12)).toThrow();
  });
  it("schedule pays off exactly and extra payments shorten it", () => {
    const s = F.amortizationSchedule(25000, 7.5, 60);
    expect(s.rows).toHaveLength(60);
    expect(s.rows[59].balance).toBeLessThan(0.01);
    expect(s.totalPaid).toBeCloseTo(s.payment * 60, 0);
    const fast = F.amortizationSchedule(25000, 7.5, 60, { extraPayment: 200 });
    expect(fast.payoffPeriods).toBeLessThan(60);
    expect(fast.totalInterest).toBeLessThan(s.totalInterest);
  });
  it("mortgage includes PMI only under 20% down", () => {
    const low = F.mortgage({ homePrice: 400000, downPayment: 40000, annualRate: 6.5, years: 30, pmiRatePercent: 0.5, propertyTaxYearly: 4800, insuranceYearly: 1200 });
    expect(low.pmiMonthly).toBeCloseTo(150);
    expect(low.totalMonthly).toBeCloseTo(low.principalAndInterest + 150 + 400 + 100, 6);
    const high = F.mortgage({ homePrice: 400000, downPayment: 80000, annualRate: 6.5, years: 30, pmiRatePercent: 0.5 });
    expect(high.pmiMonthly).toBe(0);
    expect(() => F.mortgage({ homePrice: 100, downPayment: 100, annualRate: 5, years: 30 })).toThrow();
  });
  it("car lease with money factor", () => {
    const l = F.carLease({ msrp: 30000, negotiatedPrice: 30000, downPayment: 0, tradeIn: 0, residualPercent: 60, months: 36, moneyFactor: 0.0025, salesTaxPercent: 0, fees: 0 });
    // depreciation (30000-18000)/36 = 333.33, rent (30000+18000)*0.0025 = 120
    expect(l.monthly).toBeCloseTo(453.33, 2);
    expect(l.aprEquivalent).toBeCloseTo(6);
  });
  it("car payment applies trade-in tax credit", () => {
    const a = F.carPayment({ price: 30000, downPayment: 0, tradeIn: 10000, tradeInOwed: 0, salesTaxPercent: 10, fees: 0, apr: 0, months: 10 });
    expect(a.tax).toBe(2000);
    expect(a.monthly).toBeCloseTo(2200);
    const b = F.carPayment({ price: 30000, downPayment: 0, tradeIn: 10000, tradeInOwed: 0, salesTaxPercent: 10, fees: 0, apr: 0, months: 10, taxOnFullPrice: true });
    expect(b.tax).toBe(3000);
  });
});

describe("interest & savings", () => {
  it("compound interest without contributions matches formula", () => {
    const r = F.compoundInterest({ principal: 10000, annualRate: 5, years: 10, compoundsPerYear: 12, contribution: 0, contributionsPerYear: 12 });
    expect(r.finalBalance).toBeCloseTo(10000 * (1 + 0.05 / 12) ** 120, 2);
    expect(r.yearly).toHaveLength(10);
  });
  it("monthly contributions at end of month (annuity)", () => {
    const r = F.compoundInterest({ principal: 0, annualRate: 12, years: 1, compoundsPerYear: 12, contribution: 100, contributionsPerYear: 12 });
    const expected = 100 * (((1.01) ** 12 - 1) / 0.01);
    expect(r.finalBalance).toBeCloseTo(expected, 6);
  });
  it("simple interest", () => expect(F.simpleInterest(5000, 4.5, 3).interest).toBeCloseTo(675));
  it("savings goal deposit and time are consistent", () => {
    const d = F.savingsGoal({ goal: 12000, current: 0, annualRate: 0, years: 1 });
    expect(d.monthlyDeposit).toBeCloseTo(1000);
    const t = F.savingsGoal({ goal: 12000, current: 0, annualRate: 0, monthlyDeposit: 1000 });
    expect(t.months).toBe(12);
    expect(() => F.savingsGoal({ goal: 100, current: 0, annualRate: 0, monthlyDeposit: 0 })).toThrow();
  });
});

describe("business & everyday", () => {
  it("ROI and CAGR", () => {
    const r = F.roi(1000, 2000, 2);
    expect(r.roiPct).toBe(100);
    expect(r.annualized).toBeCloseTo(41.42, 2);
  });
  it("margin vs markup", () => {
    expect(F.profitMargin(60, 100).marginPct).toBe(40);
    expect(F.priceFromMargin(60, 40).price).toBeCloseTo(100);
    expect(F.markup(60, 50).marginPct).toBeCloseTo(33.33, 2);
    expect(() => F.priceFromMargin(10, 100)).toThrow();
  });
  it("break-even", () => {
    const b = F.breakEven(12000, 45, 20);
    expect(b.units).toBe(480);
    expect(() => F.breakEven(100, 10, 10)).toThrow();
  });
  it("salary conversions", () => {
    expect(F.hourlyToSalary(25, 40, 52).yearly).toBe(52000);
    expect(F.salaryToHourly(60000, 40, 52)).toBeCloseTo(28.85, 2);
    expect(() => F.hourlyToSalary(20, 200, 52)).toThrow();
  });
  it("overtime", () => expect(F.overtimePay({ rate: 20, regularHours: 40, overtimeHours: 5, multiplier: 1.5 }).total).toBe(950));
  it("tip and exact cent splitting", () => {
    expect(F.tip(100, 18).total).toBe(118);
    const shares = F.splitCents(100, 3);
    expect(shares).toEqual([33.34, 33.33, 33.33]);
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(() => F.tip(10, 15, 0)).toThrow();
  });
  it("BMI", () => {
    const m = F.bmi({ weight: 70, height: 175, unit: "metric" });
    expect(m.bmi).toBeCloseTo(22.86, 2);
    expect(m.category).toBe("Normal weight");
    const i = F.bmi({ weight: 170, height: 5, heightInches: 10, unit: "imperial" });
    expect(i.bmi).toBeCloseTo(24.4, 1);
    expect(() => F.bmi({ weight: 70, height: 20, unit: "metric" })).toThrow();
  });
  it("fuel and electricity", () => {
    const f = F.fuelConsumption({ distance: 100, fuel: 5, unit: "metric" });
    expect(f.lPer100).toBe(5);
    expect(f.mpgUS).toBeCloseTo(47.04, 2);
    const e = F.electricityCost({ watts: 100, hoursPerDay: 10, pricePerKwh: 0.2 });
    expect(e.kwhDay).toBe(1);
    expect(e.costYear).toBeCloseTo(73);
  });
});
