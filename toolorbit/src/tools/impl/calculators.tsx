"use client";

import type { ComponentType } from "react";
import * as F from "../logic/finance";
import * as U from "../logic/convert";
import { FormCalculator, type CalcField, type FormCalculatorConfig } from "../ui/FormCalculator";
import { money, num } from "../ui/kit";

const $ = (v: number) => `$${money(v)}`;
const pct = (v: number, d = 2) => `${num(v, d)}%`;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function calc(cfg: FormCalculatorConfig): ComponentType {
  const C = () => <FormCalculator {...cfg} />;
  return C;
}

const termUnit: CalcField = { name: "termUnit", label: "Term unit", type: "select", default: "years", options: [{ value: "years", label: "Years" }, { value: "months", label: "Months" }] };

// ---------- Percentage ----------
const Percentage = calc({
  fields: [
    {
      name: "mode", label: "Calculation", type: "select", default: "of",
      options: [
        { value: "of", label: "What is X% of Y?" },
        { value: "is", label: "X is what % of Y?" },
        { value: "change", label: "% change from X to Y" },
        { value: "add", label: "Y increased by X%" },
        { value: "sub", label: "Y decreased by X%" },
      ],
    },
    { name: "x", label: "X", type: "number", default: "15" },
    { name: "y", label: "Y", type: "number", default: "240" },
  ],
  compute: ({ n, s }) => {
    const x = n("x"), y = n("y");
    switch (s("mode")) {
      case "of": return { stats: [{ label: `${num(x)}% of ${num(y)}`, value: num(F.percentOf(x, y), 6), primary: true }] };
      case "is": return { stats: [{ label: `${num(x)} is this % of ${num(y)}`, value: pct(F.whatPercent(x, y), 4), primary: true }] };
      case "change": {
        const c = F.percentChange(x, y);
        return { stats: [{ label: "Percentage change", value: `${c > 0 ? "+" : ""}${pct(c, 4)}`, primary: true }, { label: "Absolute difference", value: num(y - x, 6) }] };
      }
      case "add": return { stats: [{ label: "Result", value: num(y * (1 + x / 100), 6), primary: true }, { label: "Increase", value: num((y * x) / 100, 6) }] };
      default: return { stats: [{ label: "Result", value: num(y * (1 - x / 100), 6), primary: true }, { label: "Decrease", value: num((y * x) / 100, 6) }] };
    }
  },
  formula: <>X% of Y = X ÷ 100 × Y<br />X as % of Y = X ÷ Y × 100<br />Change = (Y − X) ÷ |X| × 100</>,
  formColumns: 3,
});

const Discount = calc({
  fields: [
    { name: "price", label: "Original price", type: "number", default: "80", prefix: "$", min: 0 },
    { name: "pct", label: "Discount", type: "number", default: "25", suffix: "%", min: 0, max: 100 },
    { name: "extra", label: "Extra discount (stacked)", type: "number", default: "", suffix: "%", min: 0, max: 100, optional: true },
    { name: "tax", label: "Sales tax", type: "number", default: "", suffix: "%", min: 0, optional: true },
  ],
  compute: ({ n, opt }) => {
    const r = F.discount(n("price"), n("pct"), opt("extra"));
    const tax = opt("tax");
    return {
      stats: [
        { label: "Price after discount", value: $(r.finalPrice), primary: true },
        { label: "You save", value: $(r.saved) },
        { label: "Effective discount", value: pct(r.effectivePercent) },
        ...(tax ? [{ label: `Total with ${tax}% tax`, value: $(r.finalPrice * (1 + tax / 100)) }] : []),
      ],
      note: opt("extra") ? "Stacked discounts multiply: 25% + 10% off is 32.5% off, not 35%." : undefined,
    };
  },
  formula: <>Final = Price × (1 − d₁) × (1 − d₂)</>,
});

const taxFields = (label: string, def: string): CalcField[] => [
  { name: "amount", label, type: "number", default: def, prefix: "$" },
  { name: "rate", label: "Tax rate", type: "number", default: "20", suffix: "%", min: 0, max: 100 },
];

const Vat = calc({
  fields: taxFields("Net amount (excluding VAT)", "100"),
  compute: ({ n }) => {
    const r = F.addTax(n("amount"), n("rate"));
    return { stats: [{ label: "Gross (incl. VAT)", value: money(r.gross), primary: true }, { label: "VAT amount", value: money(r.tax) }, { label: "Net", value: money(r.net) }] };
  },
  formula: <>VAT = Net × rate · Gross = Net × (1 + rate)</>,
});

const ReverseVat = calc({
  fields: taxFields("Gross amount (including VAT)", "120"),
  compute: ({ n }) => {
    const r = F.removeTax(n("amount"), n("rate"));
    return { stats: [{ label: "Net (excl. VAT)", value: money(r.net), primary: true }, { label: "VAT included", value: money(r.tax) }, { label: "Gross", value: money(r.gross) }] };
  },
  formula: <>Net = Gross ÷ (1 + rate) · VAT = Gross − Net</>,
});

const SalesTax = calc({
  fields: [
    { name: "amount", label: "Price before tax", type: "number", default: "49.99", prefix: "$" },
    { name: "rate", label: "Combined sales tax rate", type: "number", default: "8.25", suffix: "%", min: 0, max: 30, hint: "State + county + city rate" },
    { name: "qty", label: "Quantity", type: "number", default: "1", min: 1, step: 1 },
  ],
  compute: ({ n }) => {
    const r = F.addTax(n("amount") * n("qty"), n("rate"));
    return { stats: [{ label: "Total with tax", value: $(r.gross), primary: true }, { label: "Sales tax", value: $(r.tax) }, { label: "Subtotal", value: $(r.net) }] };
  },
  formula: <>Tax = Subtotal × rate · Total = Subtotal + Tax</>,
});

const ReverseSalesTax = calc({
  fields: [
    { name: "amount", label: "Total paid (tax included)", type: "number", default: "54.11", prefix: "$" },
    { name: "rate", label: "Sales tax rate", type: "number", default: "8.25", suffix: "%", min: 0, max: 30 },
  ],
  compute: ({ n }) => {
    const r = F.removeTax(n("amount"), n("rate"));
    return { stats: [{ label: "Price before tax", value: $(r.net), primary: true }, { label: "Sales tax paid", value: $(r.tax) }] };
  },
  formula: <>Pre-tax = Total ÷ (1 + rate)</>,
});

// ---------- Loans ----------
function scheduleTable(rows: F.AmortizationRow[], yearly: boolean) {
  if (!yearly) return { title: "Amortization schedule", columns: ["#", "Payment", "Principal", "Interest", "Balance"], rows: rows.map((r) => [r.period, money(r.payment), money(r.principal + r.extra), money(r.interest), money(r.balance)]) };
  const out: (string | number)[][] = [];
  for (let i = 0; i < rows.length; i += 12) {
    const chunk = rows.slice(i, i + 12);
    out.push([i / 12 + 1, money(chunk.reduce((s, r) => s + r.principal + r.extra, 0)), money(chunk.reduce((s, r) => s + r.interest, 0)), money(chunk[chunk.length - 1].balance)]);
  }
  return { title: "Yearly amortization", columns: ["Year", "Principal paid", "Interest paid", "Balance"], rows: out };
}

const Loan = calc({
  fields: [
    { name: "amount", label: "Loan amount", type: "number", default: "25000", prefix: "$", min: 0 },
    { name: "rate", label: "Annual interest rate (APR)", type: "number", default: "7.5", suffix: "%", min: 0, max: 100 },
    { name: "term", label: "Loan term", type: "number", default: "5", min: 1, max: 600 },
    termUnit,
    { name: "extra", label: "Extra monthly payment", type: "number", default: "", prefix: "$", min: 0, optional: true },
  ],
  compute: ({ n, s, opt }) => {
    const months = s("termUnit") === "years" ? Math.round(n("term") * 12) : Math.round(n("term"));
    const r = F.amortizationSchedule(n("amount"), n("rate"), months, { extraPayment: opt("extra") });
    return {
      stats: [
        { label: "Monthly payment", value: $(r.payment + opt("extra")), primary: true },
        { label: "Total interest", value: $(r.totalInterest) },
        { label: "Total paid", value: $(r.totalPaid) },
        { label: "Payoff time", value: `${Math.floor(r.payoffPeriods / 12)} yr ${r.payoffPeriods % 12} mo` },
      ],
      table: scheduleTable(r.rows, months > 36),
    };
  },
  formula: <>M = P × r ÷ (1 − (1 + r)⁻ⁿ), r = APR ÷ 12, n = number of months</>,
  statColumns: 4,
});

const Mortgage = calc({
  fields: [
    { name: "price", label: "Home price", type: "number", default: "400000", prefix: "$", min: 0 },
    { name: "down", label: "Down payment", type: "number", default: "80000", prefix: "$", min: 0 },
    { name: "rate", label: "Interest rate", type: "number", default: "6.5", suffix: "%", min: 0, max: 30 },
    { name: "years", label: "Loan term", type: "select", default: "30", options: [{ value: "30", label: "30 years" }, { value: "20", label: "20 years" }, { value: "15", label: "15 years" }, { value: "10", label: "10 years" }] },
    { name: "tax", label: "Property tax per year", type: "number", default: "4800", prefix: "$", min: 0, optional: true },
    { name: "ins", label: "Home insurance per year", type: "number", default: "1500", prefix: "$", min: 0, optional: true },
    { name: "hoa", label: "HOA per month", type: "number", default: "", prefix: "$", min: 0, optional: true },
    { name: "pmi", label: "PMI rate (if down < 20%)", type: "number", default: "0.5", suffix: "%", min: 0, max: 5, optional: true },
    { name: "extra", label: "Extra principal per month", type: "number", default: "", prefix: "$", min: 0, optional: true },
  ],
  compute: ({ n, s, opt }) => {
    const r = F.mortgage({ homePrice: n("price"), downPayment: n("down"), annualRate: n("rate"), years: Number(s("years")), propertyTaxYearly: opt("tax"), insuranceYearly: opt("ins"), hoaMonthly: opt("hoa"), pmiRatePercent: opt("pmi"), extraMonthly: opt("extra") });
    return {
      stats: [
        { label: "Total monthly payment", value: $(r.totalMonthly), primary: true },
        { label: "Principal & interest", value: $(r.principalAndInterest) },
        { label: "Taxes, insurance, HOA", value: $(r.taxMonthly + r.insMonthly + r.hoa) },
        { label: "PMI", value: r.pmiMonthly ? $(r.pmiMonthly) : "Not required" },
        { label: "Loan amount", value: $(r.loan), hint: `${num(r.downPct, 1)}% down` },
        { label: "Total interest", value: $(r.totalInterest) },
        { label: "Payoff", value: `${Math.floor(r.payoffMonths / 12)} yr ${r.payoffMonths % 12} mo` },
      ],
      note: "PMI is estimated on the original loan amount and usually ends once you reach 20–22% equity.",
      table: scheduleTable(r.rows, true),
    };
  },
  formula: <>P&amp;I = L × r ÷ (1 − (1 + r)⁻ⁿ) · Total = P&amp;I + tax/12 + insurance/12 + HOA + PMI</>,
  formColumns: 3,
  statColumns: 4,
});

const CarLease = calc({
  fields: [
    { name: "msrp", label: "MSRP (sticker price)", type: "number", default: "38000", prefix: "$" },
    { name: "price", label: "Negotiated price", type: "number", default: "36000", prefix: "$" },
    { name: "down", label: "Down payment (cap reduction)", type: "number", default: "2000", prefix: "$", min: 0 },
    { name: "trade", label: "Trade-in value", type: "number", default: "0", prefix: "$", min: 0 },
    { name: "fees", label: "Fees rolled into lease", type: "number", default: "895", prefix: "$", min: 0 },
    { name: "residual", label: "Residual value", type: "number", default: "58", suffix: "% of MSRP", min: 1, max: 99 },
    { name: "months", label: "Lease term", type: "number", default: "36", suffix: "months", min: 6, max: 96, step: 1 },
    { name: "mf", label: "Money factor", type: "number", default: "0.00250", step: 0.00001, min: 0, hint: "Leave empty to use APR instead", optional: true },
    { name: "apr", label: "APR (if no money factor)", type: "number", default: "", suffix: "%", min: 0, optional: true },
    { name: "tax", label: "Sales tax on payment", type: "number", default: "7", suffix: "%", min: 0, max: 20 },
  ],
  compute: ({ n, opt }) => {
    const r = F.carLease({ msrp: n("msrp"), negotiatedPrice: n("price"), downPayment: n("down"), tradeIn: n("trade"), residualPercent: n("residual"), months: n("months"), moneyFactor: opt("mf"), apr: opt("apr"), salesTaxPercent: n("tax"), fees: n("fees") });
    return {
      stats: [
        { label: "Monthly payment", value: $(r.monthly), primary: true },
        { label: "Depreciation part", value: $(r.depreciation) },
        { label: "Finance (rent) charge", value: $(r.finance) },
        { label: "Tax per month", value: $(r.tax) },
        { label: "Residual value", value: $(r.residual) },
        { label: "Equivalent APR", value: pct(r.aprEquivalent) },
        { label: "Total lease cost", value: $(r.totalCost) },
      ],
    };
  },
  formula: <>Depreciation = (Cap cost − Residual) ÷ term<br />Rent = (Cap cost + Residual) × money factor<br />Money factor = APR ÷ 2400</>,
  formColumns: 3,
  statColumns: 4,
});

const CarPayment = calc({
  fields: [
    { name: "price", label: "Vehicle price", type: "number", default: "32000", prefix: "$" },
    { name: "down", label: "Down payment", type: "number", default: "4000", prefix: "$", min: 0 },
    { name: "trade", label: "Trade-in value", type: "number", default: "0", prefix: "$", min: 0 },
    { name: "owed", label: "Amount owed on trade-in", type: "number", default: "0", prefix: "$", min: 0 },
    { name: "tax", label: "Sales tax", type: "number", default: "7", suffix: "%", min: 0, max: 20 },
    { name: "fees", label: "Title, registration & fees", type: "number", default: "650", prefix: "$", min: 0 },
    { name: "apr", label: "Interest rate (APR)", type: "number", default: "6.9", suffix: "%", min: 0, max: 40 },
    { name: "months", label: "Loan term", type: "select", default: "60", options: ["36", "48", "60", "72", "84"].map((m) => ({ value: m, label: `${m} months` })) },
    { name: "fullTax", label: "Tax full price (no trade-in tax credit)", type: "checkbox", default: false },
  ],
  compute: ({ n, s, b }) => {
    const r = F.carPayment({ price: n("price"), downPayment: n("down"), tradeIn: n("trade"), tradeInOwed: n("owed"), salesTaxPercent: n("tax"), fees: n("fees"), apr: n("apr"), months: Number(s("months")), taxOnFullPrice: b("fullTax") });
    return {
      stats: [
        { label: "Monthly payment", value: $(r.monthly), primary: true },
        { label: "Amount financed", value: $(r.amount) },
        { label: "Sales tax", value: $(r.tax) },
        { label: "Total interest", value: $(r.totalInterest) },
        { label: "Total cost of car", value: $(r.totalCost) },
      ],
    };
  },
  formula: <>Financed = Price + Tax + Fees − Down − Trade-in + Owed</>,
  formColumns: 3,
});

const freqOptions = [
  { value: "1", label: "Annually" }, { value: "2", label: "Semi-annually" }, { value: "4", label: "Quarterly" },
  { value: "12", label: "Monthly" }, { value: "365", label: "Daily" },
];

const Compound = calc({
  fields: [
    { name: "p", label: "Initial investment", type: "number", default: "10000", prefix: "$", min: 0 },
    { name: "rate", label: "Annual interest rate", type: "number", default: "7", suffix: "%", min: -50, max: 100 },
    { name: "years", label: "Years", type: "number", default: "10", min: 0.1, max: 200 },
    { name: "freq", label: "Compounding", type: "select", default: "12", options: freqOptions },
    { name: "c", label: "Regular contribution", type: "number", default: "200", prefix: "$", min: 0, optional: true },
    { name: "cf", label: "Contribution frequency", type: "select", default: "12", options: [{ value: "12", label: "Monthly" }, { value: "4", label: "Quarterly" }, { value: "1", label: "Yearly" }] },
    { name: "start", label: "Contribute at start of period", type: "checkbox", default: false },
  ],
  compute: ({ n, s, opt, b }) => {
    const r = F.compoundInterest({ principal: n("p"), annualRate: n("rate"), years: n("years"), compoundsPerYear: Number(s("freq")), contribution: opt("c"), contributionsPerYear: Number(s("cf")), contributeAtStart: b("start") });
    return {
      stats: [
        { label: "Future value", value: $(r.finalBalance), primary: true },
        { label: "Total contributions", value: $(r.totalContributions) },
        { label: "Interest earned", value: $(r.totalInterest) },
        { label: "Effective annual rate", value: pct(r.effectiveAnnualRate, 3) },
      ],
      table: { title: "Growth by year", columns: ["Year", "Contributions", "Interest", "Balance"], rows: r.yearly.map((y) => [y.year, money(y.contributions), money(y.interest), money(y.balance)]) },
    };
  },
  formula: <>A = P(1 + r/n)^(nt) plus each contribution compounded from its deposit date</>,
  formColumns: 3,
  statColumns: 4,
});

const Simple = calc({
  fields: [
    { name: "p", label: "Principal", type: "number", default: "5000", prefix: "$", min: 0 },
    { name: "rate", label: "Annual rate", type: "number", default: "4.5", suffix: "%" },
    { name: "t", label: "Time", type: "number", default: "3", min: 0 },
    { name: "unit", label: "Time unit", type: "select", default: "years", options: [{ value: "years", label: "Years" }, { value: "months", label: "Months" }, { value: "days", label: "Days (365-day year)" }] },
  ],
  compute: ({ n, s }) => {
    const years = s("unit") === "years" ? n("t") : s("unit") === "months" ? n("t") / 12 : n("t") / 365;
    const r = F.simpleInterest(n("p"), n("rate"), years);
    return { stats: [{ label: "Interest", value: $(r.interest), primary: true }, { label: "Total amount", value: $(r.total) }] };
  },
  formula: <>I = P × r × t · A = P + I</>,
});

const Savings = calc({
  fields: [
    { name: "goal", label: "Savings goal", type: "number", default: "20000", prefix: "$", min: 1 },
    { name: "current", label: "Already saved", type: "number", default: "2000", prefix: "$", min: 0 },
    { name: "rate", label: "Annual interest / return", type: "number", default: "4", suffix: "%", min: 0, max: 50 },
    { name: "mode", label: "I want to know", type: "select", default: "deposit", options: [{ value: "deposit", label: "Monthly deposit needed" }, { value: "time", label: "Time to reach goal" }] },
    { name: "years", label: "Target time", type: "number", default: "3", suffix: "years", min: 0.1, max: 100, showIf: (v) => v.mode === "deposit" },
    { name: "deposit", label: "Monthly deposit", type: "number", default: "400", prefix: "$", min: 0, showIf: (v) => v.mode === "time" },
  ],
  compute: ({ n, s }) => {
    if (s("mode") === "deposit") {
      const r = F.savingsGoal({ goal: n("goal"), current: n("current"), annualRate: n("rate"), years: n("years") });
      return { stats: [{ label: "Deposit per month", value: $(r.monthlyDeposit), primary: true }, { label: "Total deposited", value: $(r.totalDeposited) }, { label: "Interest earned", value: $(Math.max(0, r.interestEarned)) }] };
    }
    const r = F.savingsGoal({ goal: n("goal"), current: n("current"), annualRate: n("rate"), monthlyDeposit: n("deposit") });
    return { stats: [{ label: "Time to goal", value: `${Math.floor(r.months / 12)} yr ${r.months % 12} mo`, primary: true }, { label: "Total deposited", value: $(r.totalDeposited) }, { label: "Interest earned", value: $(Math.max(0, r.interestEarned)) }] };
  },
  formula: <>PMT = (Goal − Current·(1+r)ⁿ) × r ÷ ((1+r)ⁿ − 1), r = monthly rate</>,
});

const Roi = calc({
  fields: [
    { name: "inv", label: "Amount invested", type: "number", default: "10000", prefix: "$" },
    { name: "ret", label: "Amount returned (final value)", type: "number", default: "14500", prefix: "$" },
    { name: "years", label: "Investment period", type: "number", default: "3", suffix: "years", min: 0, optional: true },
  ],
  compute: ({ n, opt }) => {
    const r = F.roi(n("inv"), n("ret"), opt("years"));
    return {
      stats: [
        { label: "Return on investment", value: pct(r.roiPct), primary: true },
        { label: "Gain / loss", value: $(r.gain) },
        { label: "Annualized ROI (CAGR)", value: r.annualized === null ? "Enter a period" : pct(r.annualized) },
      ],
    };
  },
  formula: <>ROI = (Return − Investment) ÷ Investment × 100 · CAGR = (Return ÷ Investment)^(1/years) − 1</>,
  formColumns: 3,
});

const Margin = calc({
  fields: [
    { name: "mode", label: "Calculate", type: "select", default: "margin", options: [{ value: "margin", label: "Margin from cost & price" }, { value: "price", label: "Price from cost & target margin" }] },
    { name: "cost", label: "Cost", type: "number", default: "60", prefix: "$", min: 0 },
    { name: "rev", label: "Selling price (revenue)", type: "number", default: "100", prefix: "$", showIf: (v) => v.mode === "margin" },
    { name: "target", label: "Target margin", type: "number", default: "40", suffix: "%", max: 99.99, showIf: (v) => v.mode === "price" },
  ],
  compute: ({ n, s }) => {
    if (s("mode") === "price") {
      const r = F.priceFromMargin(n("cost"), n("target"));
      return { stats: [{ label: "Selling price", value: $(r.price), primary: true }, { label: "Profit", value: $(r.profit) }, { label: "Markup", value: pct((r.profit / n("cost")) * 100) }] };
    }
    const r = F.profitMargin(n("cost"), n("rev"));
    return { stats: [{ label: "Profit margin", value: pct(r.marginPct), primary: true }, { label: "Gross profit", value: $(r.profit) }, { label: "Markup", value: r.markupPct === null ? "—" : pct(r.markupPct) }] };
  },
  formula: <>Margin = (Price − Cost) ÷ Price · Price = Cost ÷ (1 − Margin)</>,
});

const Markup = calc({
  fields: [
    { name: "cost", label: "Cost", type: "number", default: "60", prefix: "$" },
    { name: "markup", label: "Markup", type: "number", default: "50", suffix: "%", min: 0 },
  ],
  compute: ({ n }) => {
    const r = F.markup(n("cost"), n("markup"));
    return { stats: [{ label: "Selling price", value: $(r.price), primary: true }, { label: "Profit", value: $(r.profit) }, { label: "Gross margin", value: pct(r.marginPct) }] };
  },
  formula: <>Price = Cost × (1 + Markup) · Margin = Profit ÷ Price</>,
});

const BreakEven = calc({
  fields: [
    { name: "fixed", label: "Fixed costs (per period)", type: "number", default: "12000", prefix: "$", min: 0 },
    { name: "price", label: "Price per unit", type: "number", default: "45", prefix: "$" },
    { name: "var", label: "Variable cost per unit", type: "number", default: "20", prefix: "$", min: 0 },
  ],
  compute: ({ n }) => {
    const r = F.breakEven(n("fixed"), n("price"), n("var"));
    return {
      stats: [
        { label: "Break-even units", value: num(r.unitsRounded, 0), primary: true, hint: `Exact: ${num(r.units, 2)}` },
        { label: "Break-even revenue", value: $(r.revenue) },
        { label: "Contribution margin", value: `${$(r.contributionMargin)} / unit` },
        { label: "Contribution ratio", value: pct(r.contributionRatio) },
      ],
    };
  },
  formula: <>Units = Fixed costs ÷ (Price − Variable cost)</>,
  formColumns: 3,
  statColumns: 4,
});

const HourlySalary = calc({
  fields: [
    { name: "mode", label: "Convert", type: "select", default: "h2s", options: [{ value: "h2s", label: "Hourly → salary" }, { value: "s2h", label: "Salary → hourly" }] },
    { name: "hourly", label: "Hourly wage", type: "number", default: "28", prefix: "$", min: 0, showIf: (v) => v.mode === "h2s" },
    { name: "salary", label: "Annual salary", type: "number", default: "60000", prefix: "$", min: 0, showIf: (v) => v.mode === "s2h" },
    { name: "hours", label: "Hours per week", type: "number", default: "40", min: 1, max: 168 },
    { name: "weeks", label: "Paid weeks per year", type: "number", default: "52", min: 1, max: 53 },
  ],
  compute: ({ n, s }) => {
    const hourly = s("mode") === "h2s" ? n("hourly") : F.salaryToHourly(n("salary"), n("hours"), n("weeks"));
    const r = F.hourlyToSalary(hourly, n("hours"), n("weeks"));
    return {
      stats: [
        s("mode") === "h2s" ? { label: "Annual salary", value: $(r.yearly), primary: true } : { label: "Hourly rate", value: $(hourly), primary: true },
        { label: "Monthly", value: $(r.monthly) },
        { label: "Bi-weekly", value: $(r.biweekly) },
        { label: "Weekly", value: $(r.weekly) },
        { label: "Daily (5-day week)", value: $(r.daily) },
      ],
      note: "Gross amounts before taxes and deductions.",
    };
  },
  formula: <>Salary = Hourly × hours/week × weeks/year</>,
});

const Overtime = calc({
  fields: [
    { name: "rate", label: "Regular hourly rate", type: "number", default: "22", prefix: "$", min: 0 },
    { name: "reg", label: "Regular hours", type: "number", default: "40", min: 0 },
    { name: "ot", label: "Overtime hours", type: "number", default: "6", min: 0 },
    { name: "mult", label: "Overtime multiplier", type: "select", default: "1.5", options: [{ value: "1.5", label: "1.5× (time and a half)" }, { value: "2", label: "2× (double time)" }, { value: "1.25", label: "1.25×" }] },
    { name: "dbl", label: "Double-time hours", type: "number", default: "0", min: 0, optional: true },
  ],
  compute: ({ n, s, opt }) => {
    const r = F.overtimePay({ rate: n("rate"), regularHours: n("reg"), overtimeHours: n("ot"), multiplier: Number(s("mult")), doubleHours: opt("dbl") });
    return {
      stats: [
        { label: "Total gross pay", value: $(r.total), primary: true },
        { label: "Regular pay", value: $(r.regular) },
        { label: "Overtime pay", value: $(r.overtime), hint: `at ${$(r.overtimeRate)}/hr` },
        ...(r.double ? [{ label: "Double-time pay", value: $(r.double) }] : []),
      ],
      note: "Under the US FLSA, non-exempt employees earn at least 1.5× for hours over 40 in a workweek. State rules (e.g. California daily overtime) may differ.",
    };
  },
  formula: <>Pay = rate × regular + rate × multiplier × overtime</>,
  formColumns: 3,
});

const Tip = calc({
  fields: [
    { name: "bill", label: "Bill amount", type: "number", default: "64.50", prefix: "$", min: 0 },
    { name: "tip", label: "Tip", type: "select", default: "18", options: ["10", "15", "18", "20", "22", "25"].map((v) => ({ value: v, label: `${v}%` })).concat([{ value: "custom", label: "Custom" }]) },
    { name: "custom", label: "Custom tip", type: "number", default: "17", suffix: "%", min: 0, showIf: (v) => v.tip === "custom" },
  ],
  compute: ({ n, s }) => {
    const p = s("tip") === "custom" ? n("custom") : Number(s("tip"));
    const r = F.tip(n("bill"), p);
    return { stats: [{ label: "Tip", value: $(r.tipAmount), primary: true }, { label: "Total", value: $(r.total) }, { label: "Tip rate", value: `${p}%` }] };
  },
  formula: <>Tip = Bill × rate · Total = Bill + Tip</>,
  formColumns: 3,
});

const TipSplit = calc({
  fields: [
    { name: "bill", label: "Bill amount", type: "number", default: "186.40", prefix: "$", min: 0 },
    { name: "tip", label: "Tip", type: "number", default: "20", suffix: "%", min: 0 },
    { name: "people", label: "Number of people", type: "number", default: "4", min: 1, max: 100, step: 1 },
    { name: "round", label: "Round each share up to whole dollars", type: "checkbox", default: false },
  ],
  compute: ({ n, b }) => {
    const people = n("people");
    const r = F.tip(n("bill"), n("tip"), people, b("round"));
    const shares = b("round") ? null : F.splitCents(r.total, people);
    const uneven = shares && shares.some((x) => x !== shares[0]);
    return {
      stats: [
        { label: "Each person pays", value: $(r.perPerson), primary: true },
        { label: "Tip per person", value: $(r.tipPerPerson) },
        { label: "Total tip", value: $(r.tipAmount) },
        { label: b("round") ? "Total collected" : "Total bill", value: $(b("round") ? r.roundedTotal : r.total) },
      ],
      note: uneven ? `Cents don't divide evenly: ${shares!.filter((x) => x > shares![shares!.length - 1]).length} person(s) pay ${$(shares![0])}, the rest ${$(shares![shares!.length - 1])}.` : undefined,
    };
  },
  statColumns: 4,
});

// ---------- Dates & everyday ----------
const Age = calc({
  fields: [
    { name: "birth", label: "Date of birth", type: "date", default: "1990-06-15" },
    { name: "on", label: "Age on date", type: "date", default: today() },
  ],
  compute: ({ s }) => {
    const r = U.age(U.parseDateInput(s("birth")), U.parseDateInput(s("on")));
    return {
      stats: [
        { label: "Age", value: `${r.years} years`, primary: true, hint: `${r.years} y, ${r.months} m, ${r.days} d` },
        { label: "Total months", value: num(r.totalMonths, 0) },
        { label: "Total weeks", value: num(Math.floor(r.totalWeeks), 0) },
        { label: "Total days", value: num(r.totalDays, 0) },
        { label: "Next birthday in", value: `${r.daysToBirthday} days` },
        { label: "Born on a", value: r.weekdayBorn },
      ],
    };
  },
});

const DateDiff = calc({
  fields: [
    { name: "a", label: "Start date", type: "date", default: today() },
    { name: "b", label: "End date", type: "date", default: `${new Date().getFullYear()}-12-31` },
    { name: "include", label: "Include end date (+1 day)", type: "checkbox", default: false },
  ],
  compute: ({ s, b }) => {
    const a = U.parseDateInput(s("a")), e = U.parseDateInput(s("b"));
    const r = U.calendarDiff(a, e);
    const total = r.totalDays + (b("include") ? 1 : 0);
    return {
      stats: [
        { label: "Total days", value: num(total, 0), primary: true },
        { label: "Years, months, days", value: `${r.years} y ${r.months} m ${r.days} d` },
        { label: "Weeks", value: `${Math.floor(total / 7)} w ${total % 7} d` },
        { label: "Business days (Mon–Fri)", value: num(U.businessDaysBetween(a, e), 0), hint: "Public holidays are not excluded" },
        { label: "Hours", value: num(total * 24, 0) },
      ],
      note: r.sign < 0 ? "The end date is before the start date; values show the absolute difference." : undefined,
    };
  },
});

const TimeDuration = calc({
  fields: [
    { name: "start", label: "Start time", type: "time", default: "09:15" },
    { name: "end", label: "End time", type: "time", default: "17:45" },
    { name: "brk", label: "Unpaid break", type: "number", default: "30", suffix: "min", min: 0, optional: true },
  ],
  compute: ({ s, opt }) => {
    const r = U.timeDuration(s("start"), s("end"));
    const secs = Math.max(0, r.seconds - opt("brk") * 60);
    return {
      stats: [
        { label: "Duration", value: U.formatDuration(secs), primary: true, hint: r.seconds > 0 && U.parseTimeOfDay(s("end")) < U.parseTimeOfDay(s("start")) ? "Crosses midnight" : undefined },
        { label: "Decimal hours", value: num(secs / 3600, 2) },
        { label: "Total minutes", value: num(secs / 60, 1) },
      ],
    };
  },
  formColumns: 3,
});

const Bmi = calc({
  fields: [
    { name: "unit", label: "Units", type: "select", default: "imperial", options: [{ value: "imperial", label: "US (lb, ft/in)" }, { value: "metric", label: "Metric (kg, cm)" }] },
    { name: "weight", label: "Weight", type: "number", default: "170", min: 1, suffix: "" },
    { name: "height", label: "Height (cm or ft)", type: "number", default: "5", min: 0 },
    { name: "inches", label: "Inches", type: "number", default: "10", min: 0, max: 11.99, showIf: (v) => v.unit === "imperial" },
  ],
  compute: ({ n, s, opt }) => {
    const r = F.bmi({ weight: n("weight"), height: n("height"), unit: s("unit") as "metric", heightInches: opt("inches") });
    const imp = s("unit") === "imperial";
    const w = (kg: number) => (imp ? `${num(kg / 0.45359237, 1)} lb` : `${num(kg, 1)} kg`);
    return {
      stats: [
        { label: "BMI", value: num(r.bmi, 1), primary: true },
        { label: "Category (WHO, adults)", value: r.category },
        { label: "Healthy weight range", value: `${w(r.healthyMinKg)} – ${w(r.healthyMaxKg)}` },
      ],
      note: "BMI is a screening measure for adults 20+ and does not account for muscle mass, age, sex or ethnicity. It is not a diagnosis.",
    };
  },
  formula: <>BMI = weight (kg) ÷ height (m)²</>,
});

const Aspect = calc({
  fields: [
    { name: "w", label: "Original width", type: "number", default: "1920", min: 1 },
    { name: "h", label: "Original height", type: "number", default: "1080", min: 1 },
    { name: "nw", label: "New width", type: "number", default: "1280", min: 0, optional: true, hint: "Fill new width OR new height" },
    { name: "nh", label: "New height", type: "number", default: "", min: 0, optional: true },
  ],
  compute: ({ n, opt }) => {
    const r = U.aspectRatio(n("w"), n("h"));
    const nw = opt("nw"), nh = opt("nh");
    const scaled = nw || nh ? U.scaleToRatio(n("w"), n("h"), nw ? { width: nw } : { height: nh }) : null;
    return {
      stats: [
        { label: "Aspect ratio", value: r.ratio, primary: true },
        { label: "Decimal", value: `${num(r.decimal, 4)} : 1` },
        ...(scaled ? [{ label: "Scaled size", value: `${num(scaled.width, 2)} × ${num(scaled.height, 2)}`, hint: `Rounded: ${Math.round(scaled.width)} × ${Math.round(scaled.height)}` }] : []),
      ],
    };
  },
  formula: <>Ratio = W ÷ gcd(W,H) : H ÷ gcd(W,H) · New H = New W × H ÷ W</>,
});

const Fuel = calc({
  fields: [
    { name: "unit", label: "Units", type: "select", default: "us", options: [{ value: "us", label: "Miles & US gallons" }, { value: "uk", label: "Miles & UK gallons" }, { value: "metric", label: "Kilometres & litres" }] },
    { name: "dist", label: "Distance driven", type: "number", default: "320", min: 0 },
    { name: "fuel", label: "Fuel used", type: "number", default: "11.2", min: 0 },
    { name: "price", label: "Fuel price per gallon/litre", type: "number", default: "3.45", prefix: "$", min: 0, optional: true },
  ],
  compute: ({ n, s, opt }) => {
    const r = F.fuelConsumption({ distance: n("dist"), fuel: n("fuel"), unit: s("unit") as "us", price: opt("price") || undefined });
    const per = s("unit") === "metric" ? "km" : "mile";
    return {
      stats: [
        { label: "MPG (US)", value: num(r.mpgUS, 2), primary: s("unit") === "us" },
        { label: "MPG (UK)", value: num(r.mpgUK, 2), primary: s("unit") === "uk" },
        { label: "L/100 km", value: num(r.lPer100, 2), primary: s("unit") === "metric" },
        { label: "km per litre", value: num(r.kmPerL, 2) },
        ...(r.tripCost !== null ? [{ label: "Trip fuel cost", value: $(r.tripCost) }, { label: `Cost per ${per}`, value: $(r.costPerDistance!) }] : []),
      ],
    };
  },
  formula: <>MPG = miles ÷ gallons · L/100km = litres ÷ km × 100 · 1 US gal = 3.785 L</>,
});

const Electricity = calc({
  fields: [
    { name: "watts", label: "Power consumption", type: "number", default: "150", suffix: "W", min: 0 },
    { name: "hours", label: "Hours used per day", type: "number", default: "5", min: 0, max: 24 },
    { name: "qty", label: "Number of devices", type: "number", default: "1", min: 1, step: 1 },
    { name: "price", label: "Electricity price per kWh", type: "number", default: "0.17", prefix: "$", min: 0, step: 0.001 },
  ],
  compute: ({ n }) => {
    const r = F.electricityCost({ watts: n("watts"), hoursPerDay: n("hours"), pricePerKwh: n("price"), quantity: n("qty") });
    return {
      stats: [
        { label: "Cost per month", value: $(r.costMonth), primary: true },
        { label: "Cost per day", value: $(r.costDay) },
        { label: "Cost per year", value: $(r.costYear) },
        { label: "Energy per day", value: `${num(r.kwhDay, 3)} kWh` },
        { label: "Energy per year", value: `${num(r.kwhYear, 1)} kWh` },
      ],
    };
  },
  formula: <>kWh/day = W × hours × devices ÷ 1000 · Cost = kWh × price</>,
});

const DataStorage = calc({
  fields: [
    { name: "v", label: "Value", type: "number", default: "1", min: 0 },
    { name: "u", label: "From unit", type: "select", default: "GB", options: U.DATA_UNITS.map((u) => ({ value: u.id, label: u.label })) },
  ],
  compute: ({ n, s }) => {
    const rows = U.convertData(n("v"), s("u"));
    return {
      stats: rows.filter((r) => ["B", "KB", "MB", "GB", "TB", "MiB", "GiB"].includes(r.id)).map((r) => ({ label: r.label, value: U.fmtNum(r.value, 6), primary: r.id === s("u") })),
      table: { title: "All units", columns: ["Unit", "Value"], rows: rows.map((r) => [r.label, U.fmtNum(r.value, 10)]) },
      note: "Decimal units (KB, MB, GB) use powers of 1000 as drive makers do; binary units (KiB, MiB, GiB) use 1024 as Windows and RAM do.",
    };
  },
  statColumns: 4,
});

const Temperature = calc({
  fields: [
    { name: "v", label: "Temperature", type: "number", default: "72" },
    { name: "u", label: "From", type: "select", default: "F", options: [{ value: "F", label: "Fahrenheit (°F)" }, { value: "C", label: "Celsius (°C)" }, { value: "K", label: "Kelvin (K)" }, { value: "R", label: "Rankine (°R)" }] },
  ],
  compute: ({ n, s }) => {
    const r = U.convertTemperature(n("v"), s("u") as U.TempUnit);
    return {
      stats: [
        { label: "Celsius", value: `${U.fmtNum(r.C, 2)} °C`, primary: s("u") !== "C" },
        { label: "Fahrenheit", value: `${U.fmtNum(r.F, 2)} °F`, primary: s("u") === "C" },
        { label: "Kelvin", value: `${U.fmtNum(r.K, 2)} K` },
        { label: "Rankine", value: `${U.fmtNum(r.R, 2)} °R` },
      ],
    };
  },
  formula: <>°C = (°F − 32) × 5/9 · °F = °C × 9/5 + 32 · K = °C + 273.15</>,
  statColumns: 4,
});

const tools: Record<string, ComponentType> = {
  "percentage-calculator": Percentage,
  "discount-calculator": Discount,
  "vat-calculator": Vat,
  "reverse-vat-calculator": ReverseVat,
  "sales-tax-calculator": SalesTax,
  "reverse-sales-tax-calculator": ReverseSalesTax,
  "loan-calculator": Loan,
  "mortgage-calculator": Mortgage,
  "car-lease-calculator": CarLease,
  "car-payment-calculator": CarPayment,
  "compound-interest-calculator": Compound,
  "simple-interest-calculator": Simple,
  "savings-calculator": Savings,
  "roi-calculator": Roi,
  "profit-margin-calculator": Margin,
  "markup-calculator": Markup,
  "break-even-calculator": BreakEven,
  "hourly-to-salary-calculator": HourlySalary,
  "overtime-calculator": Overtime,
  "tip-calculator": Tip,
  "tip-split-calculator": TipSplit,
  "age-calculator": Age,
  "date-difference-calculator": DateDiff,
  "time-duration-calculator": TimeDuration,
  "bmi-calculator": Bmi,
  "aspect-ratio-calculator": Aspect,
  "fuel-consumption-calculator": Fuel,
  "electricity-cost-calculator": Electricity,
  "data-storage-converter": DataStorage,
  "temperature-converter": Temperature,
};

export default tools;
