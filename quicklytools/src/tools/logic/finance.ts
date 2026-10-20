/** Financial & business calculator formulas. All money values are plain numbers in one currency. */

export class CalcError extends Error {}

export function requirePositive(value: number, label: string, allowZero = false): void {
  if (!Number.isFinite(value)) throw new CalcError(`${label} must be a number.`);
  if (allowZero ? value < 0 : value <= 0) throw new CalcError(`${label} must be ${allowZero ? "zero or more" : "greater than zero"}.`);
}

export const roundMoney = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

// ---------- Percentages ----------

export const percentOf = (pct: number, value: number) => (pct / 100) * value;

export function whatPercent(part: number, whole: number): number {
  if (whole === 0) throw new CalcError("The whole value cannot be zero.");
  return (part / whole) * 100;
}

export function percentChange(from: number, to: number): number {
  if (from === 0) throw new CalcError("Percentage change from zero is undefined.");
  return ((to - from) / Math.abs(from)) * 100;
}

export function discount(price: number, percent: number, extraPercent = 0) {
  requirePositive(price, "Original price", true);
  if (percent < 0 || percent > 100 || extraPercent < 0 || extraPercent > 100) throw new CalcError("Discounts must be between 0% and 100%.");
  const afterFirst = price * (1 - percent / 100);
  const finalPrice = afterFirst * (1 - extraPercent / 100);
  return { finalPrice, saved: price - finalPrice, effectivePercent: price ? ((price - finalPrice) / price) * 100 : 0 };
}

// ---------- VAT / sales tax ----------

export function addTax(net: number, ratePercent: number) {
  requirePositive(ratePercent, "Tax rate", true);
  const tax = net * (ratePercent / 100);
  return { net, tax, gross: net + tax };
}

/** Extracts tax from a tax-inclusive (gross) amount. */
export function removeTax(gross: number, ratePercent: number) {
  requirePositive(ratePercent, "Tax rate", true);
  const net = gross / (1 + ratePercent / 100);
  return { net, tax: gross - net, gross };
}

// ---------- Loans ----------

/** Standard amortizing payment. rate = annual %, periods per year default 12. */
export function amortizedPayment(principal: number, annualRatePercent: number, numPayments: number, periodsPerYear = 12): number {
  requirePositive(principal, "Loan amount", true);
  requirePositive(numPayments, "Loan term");
  if (annualRatePercent < 0) throw new CalcError("Interest rate cannot be negative.");
  const r = annualRatePercent / 100 / periodsPerYear;
  if (r === 0) return principal / numPayments;
  return (principal * r) / (1 - (1 + r) ** -numPayments);
}

export interface AmortizationRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  extra: number;
  balance: number;
}

export function amortizationSchedule(
  principal: number,
  annualRatePercent: number,
  numPayments: number,
  opts: { periodsPerYear?: number; extraPayment?: number } = {},
) {
  const ppy = opts.periodsPerYear ?? 12;
  const extra = opts.extraPayment ?? 0;
  if (extra < 0) throw new CalcError("Extra payment cannot be negative.");
  const payment = amortizedPayment(principal, annualRatePercent, numPayments, ppy);
  const r = annualRatePercent / 100 / ppy;
  const rows: AmortizationRow[] = [];
  let balance = principal;
  let totalInterest = 0;
  for (let p = 1; p <= numPayments && balance > 0.005; p++) {
    const interest = balance * r;
    let principalPart = Math.min(payment - interest, balance);
    let extraPart = Math.min(extra, balance - principalPart);
    if (extraPart < 0) extraPart = 0;
    if (principalPart < 0) principalPart = 0;
    balance -= principalPart + extraPart;
    totalInterest += interest;
    rows.push({ period: p, payment: principalPart + interest + extraPart, principal: principalPart, interest, extra: extraPart, balance: Math.max(0, balance) });
  }
  return { payment, rows, totalInterest, totalPaid: principal + totalInterest, payoffPeriods: rows.length };
}

export function mortgage(input: {
  homePrice: number;
  downPayment: number;
  annualRate: number;
  years: number;
  propertyTaxYearly?: number;
  insuranceYearly?: number;
  hoaMonthly?: number;
  pmiRatePercent?: number;
  extraMonthly?: number;
}) {
  requirePositive(input.homePrice, "Home price");
  requirePositive(input.downPayment, "Down payment", true);
  if (input.downPayment >= input.homePrice) throw new CalcError("Down payment must be less than the home price.");
  requirePositive(input.years, "Loan term");
  const loan = input.homePrice - input.downPayment;
  const n = Math.round(input.years * 12);
  const sched = amortizationSchedule(loan, input.annualRate, n, { extraPayment: input.extraMonthly ?? 0 });
  const downPct = (input.downPayment / input.homePrice) * 100;
  const pmiMonthly = downPct < 20 && input.pmiRatePercent ? (loan * (input.pmiRatePercent / 100)) / 12 : 0;
  const taxMonthly = (input.propertyTaxYearly ?? 0) / 12;
  const insMonthly = (input.insuranceYearly ?? 0) / 12;
  const hoa = input.hoaMonthly ?? 0;
  return {
    loan,
    principalAndInterest: sched.payment,
    pmiMonthly,
    taxMonthly,
    insMonthly,
    hoa,
    totalMonthly: sched.payment + pmiMonthly + taxMonthly + insMonthly + hoa + (input.extraMonthly ?? 0),
    totalInterest: sched.totalInterest,
    payoffMonths: sched.payoffPeriods,
    downPct,
    rows: sched.rows,
  };
}

/** Car lease: money factor = APR / 2400. */
export function carLease(input: {
  msrp: number;
  negotiatedPrice: number;
  downPayment: number;
  tradeIn: number;
  residualPercent: number;
  months: number;
  apr?: number;
  moneyFactor?: number;
  salesTaxPercent: number;
  fees: number;
}) {
  requirePositive(input.msrp, "MSRP");
  requirePositive(input.negotiatedPrice, "Negotiated price");
  requirePositive(input.months, "Lease term");
  if (input.residualPercent <= 0 || input.residualPercent >= 100) throw new CalcError("Residual value must be between 0% and 100% of MSRP.");
  const mf = input.moneyFactor && input.moneyFactor > 0 ? input.moneyFactor : (input.apr ?? 0) / 2400;
  const capCost = input.negotiatedPrice + input.fees - input.downPayment - input.tradeIn;
  const residual = input.msrp * (input.residualPercent / 100);
  if (capCost <= residual) throw new CalcError("Adjusted capitalized cost is below the residual value; check the down payment and trade-in.");
  const depreciation = (capCost - residual) / input.months;
  const finance = (capCost + residual) * mf;
  const base = depreciation + finance;
  const tax = base * (input.salesTaxPercent / 100);
  const monthly = base + tax;
  return { capCost, residual, moneyFactor: mf, aprEquivalent: mf * 2400, depreciation, finance, tax, monthly, totalCost: monthly * input.months + input.downPayment + input.tradeIn };
}

export function carPayment(input: {
  price: number;
  downPayment: number;
  tradeIn: number;
  tradeInOwed: number;
  salesTaxPercent: number;
  fees: number;
  apr: number;
  months: number;
  taxOnFullPrice?: boolean;
}) {
  requirePositive(input.price, "Vehicle price");
  requirePositive(input.months, "Loan term");
  const taxable = input.taxOnFullPrice ? input.price : Math.max(0, input.price - input.tradeIn);
  const tax = taxable * (input.salesTaxPercent / 100);
  const amount = input.price + tax + input.fees - input.downPayment - input.tradeIn + input.tradeInOwed;
  if (amount <= 0) return { amount: 0, tax, monthly: 0, totalInterest: 0, totalCost: input.price + tax + input.fees };
  const s = amortizationSchedule(amount, input.apr, input.months);
  return { amount, tax, monthly: s.payment, totalInterest: s.totalInterest, totalCost: input.downPayment + input.tradeIn - input.tradeInOwed + s.totalPaid };
}

// ---------- Interest & savings ----------

export function compoundInterest(input: {
  principal: number;
  annualRate: number;
  years: number;
  compoundsPerYear: number;
  contribution: number;
  contributionsPerYear: number;
  contributeAtStart?: boolean;
}) {
  requirePositive(input.principal, "Initial amount", true);
  requirePositive(input.years, "Years");
  requirePositive(input.compoundsPerYear, "Compounding frequency");
  if (input.years > 200) throw new CalcError("Use a period of 200 years or less.");
  const yearly: { year: number; contributions: number; interest: number; balance: number }[] = [];
  let balance = input.principal;
  let totalContrib = input.principal;
  let totalInterest = 0;
  // Simulate month by month using an effective monthly rate matching the compounding frequency.
  const effAnnual = (1 + input.annualRate / 100 / input.compoundsPerYear) ** input.compoundsPerYear - 1;
  const monthlyRate = (1 + effAnnual) ** (1 / 12) - 1;
  const months = Math.round(input.years * 12);
  const contribEvery = input.contributionsPerYear > 0 ? 12 / input.contributionsPerYear : Infinity;
  let yContrib = 0, yInterest = 0;
  for (let m = 1; m <= months; m++) {
    const contributeNow = Number.isFinite(contribEvery) && (m - 1) % contribEvery < 1e-9 && input.contribution > 0;
    if (contributeNow && input.contributeAtStart) {
      balance += input.contribution;
      totalContrib += input.contribution;
      yContrib += input.contribution;
    }
    const interest = balance * monthlyRate;
    balance += interest;
    totalInterest += interest;
    yInterest += interest;
    if (contributeNow && !input.contributeAtStart) {
      balance += input.contribution;
      totalContrib += input.contribution;
      yContrib += input.contribution;
    }
    if (m % 12 === 0 || m === months) {
      yearly.push({ year: Math.ceil(m / 12), contributions: yContrib, interest: yInterest, balance });
      yContrib = 0;
      yInterest = 0;
    }
  }
  return { finalBalance: balance, totalContributions: totalContrib, totalInterest, effectiveAnnualRate: effAnnual * 100, yearly };
}

export function simpleInterest(principal: number, annualRate: number, years: number) {
  requirePositive(principal, "Principal", true);
  requirePositive(years, "Time", true);
  const interest = principal * (annualRate / 100) * years;
  return { interest, total: principal + interest };
}

/** Monthly deposit needed to reach a goal, or months needed with a given deposit. */
export function savingsGoal(input: { goal: number; current: number; annualRate: number; monthlyDeposit?: number; years?: number }) {
  requirePositive(input.goal, "Savings goal");
  const r = input.annualRate / 100 / 12;
  if (input.years && input.years > 0) {
    const n = Math.round(input.years * 12);
    const fvCurrent = input.current * (1 + r) ** n;
    const remaining = input.goal - fvCurrent;
    const deposit = remaining <= 0 ? 0 : r === 0 ? remaining / n : (remaining * r) / ((1 + r) ** n - 1);
    return { mode: "deposit" as const, monthlyDeposit: deposit, months: n, totalDeposited: deposit * n, interestEarned: input.goal - input.current - deposit * n };
  }
  const dep = input.monthlyDeposit ?? 0;
  if (dep <= 0 && input.current >= input.goal) return { mode: "time" as const, months: 0, monthlyDeposit: dep, totalDeposited: 0, interestEarned: 0 };
  if (dep <= 0 && r <= 0) throw new CalcError("With no deposits and no interest the goal can never be reached.");
  let bal = input.current;
  let months = 0;
  while (bal < input.goal && months < 1200 * 12) {
    bal = bal * (1 + r) + dep;
    months++;
  }
  if (bal < input.goal) throw new CalcError("The goal takes longer than 1,200 years with these numbers.");
  return { mode: "time" as const, months, monthlyDeposit: dep, totalDeposited: dep * months, interestEarned: bal - input.current - dep * months };
}

// ---------- Business ----------

export function roi(invested: number, returned: number, years?: number) {
  requirePositive(invested, "Amount invested");
  const gain = returned - invested;
  const roiPct = (gain / invested) * 100;
  const annualized = years && years > 0 && returned > 0 ? ((returned / invested) ** (1 / years) - 1) * 100 : null;
  return { gain, roiPct, annualized };
}

export function profitMargin(cost: number, revenue: number) {
  requirePositive(revenue, "Revenue");
  const profit = revenue - cost;
  return { profit, marginPct: (profit / revenue) * 100, markupPct: cost > 0 ? (profit / cost) * 100 : null };
}

export function priceFromMargin(cost: number, marginPct: number) {
  if (marginPct >= 100) throw new CalcError("Margin must be below 100%.");
  const price = cost / (1 - marginPct / 100);
  return { price, profit: price - cost };
}

export function markup(cost: number, markupPct: number) {
  requirePositive(cost, "Cost");
  const price = cost * (1 + markupPct / 100);
  return { price, profit: price - cost, marginPct: price ? ((price - cost) / price) * 100 : 0 };
}

export function breakEven(fixedCosts: number, pricePerUnit: number, variableCostPerUnit: number) {
  requirePositive(fixedCosts, "Fixed costs", true);
  requirePositive(pricePerUnit, "Price per unit");
  const contribution = pricePerUnit - variableCostPerUnit;
  if (contribution <= 0) throw new CalcError("Price per unit must be higher than the variable cost per unit, otherwise you never break even.");
  const units = fixedCosts / contribution;
  return { units, unitsRounded: Math.ceil(units), revenue: Math.ceil(units) * pricePerUnit, contributionMargin: contribution, contributionRatio: (contribution / pricePerUnit) * 100 };
}

export function hourlyToSalary(hourly: number, hoursPerWeek: number, weeksPerYear: number) {
  requirePositive(hourly, "Hourly rate", true);
  requirePositive(hoursPerWeek, "Hours per week");
  requirePositive(weeksPerYear, "Weeks per year");
  if (hoursPerWeek > 168) throw new CalcError("A week has only 168 hours.");
  if (weeksPerYear > 53) throw new CalcError("A year has at most 53 weeks.");
  const yearly = hourly * hoursPerWeek * weeksPerYear;
  return { yearly, monthly: yearly / 12, biweekly: yearly / 26, weekly: hourly * hoursPerWeek, daily: (hourly * hoursPerWeek) / 5 };
}

export function salaryToHourly(yearly: number, hoursPerWeek: number, weeksPerYear: number) {
  requirePositive(yearly, "Salary", true);
  requirePositive(hoursPerWeek, "Hours per week");
  requirePositive(weeksPerYear, "Weeks per year");
  return yearly / (hoursPerWeek * weeksPerYear);
}

export function overtimePay(input: { rate: number; regularHours: number; overtimeHours: number; multiplier: number; doubleHours?: number }) {
  requirePositive(input.rate, "Hourly rate", true);
  const regular = input.rate * input.regularHours;
  const overtime = input.rate * input.multiplier * input.overtimeHours;
  const dbl = input.rate * 2 * (input.doubleHours ?? 0);
  return { regular, overtime, double: dbl, total: regular + overtime + dbl, overtimeRate: input.rate * input.multiplier };
}

export function tip(bill: number, tipPercent: number, people = 1, roundUp = false) {
  requirePositive(bill, "Bill amount", true);
  if (tipPercent < 0) throw new CalcError("Tip cannot be negative.");
  if (!Number.isInteger(people) || people < 1) throw new CalcError("Number of people must be a whole number of at least 1.");
  const tipAmount = bill * (tipPercent / 100);
  const total = bill + tipAmount;
  let perPerson = total / people;
  if (roundUp) perPerson = Math.ceil(perPerson);
  return { tipAmount, total, perPerson, tipPerPerson: tipAmount / people, roundedTotal: perPerson * people };
}

/** Splits an amount into shares in whole cents that always add up exactly. */
export function splitCents(total: number, people: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / people);
  const rem = cents - base * people;
  return Array.from({ length: people }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}

export function electricityCost(input: { watts: number; hoursPerDay: number; pricePerKwh: number; days?: number; quantity?: number }) {
  requirePositive(input.watts, "Power", true);
  if (input.hoursPerDay < 0 || input.hoursPerDay > 24) throw new CalcError("Hours per day must be between 0 and 24.");
  const q = input.quantity ?? 1;
  const kwhDay = (input.watts * input.hoursPerDay * q) / 1000;
  return { kwhDay, costDay: kwhDay * input.pricePerKwh, costMonth: kwhDay * 30.44 * input.pricePerKwh, costYear: kwhDay * 365 * input.pricePerKwh, kwhYear: kwhDay * 365 };
}

export function fuelConsumption(input: { distance: number; fuel: number; unit: "metric" | "us" | "uk"; price?: number }) {
  requirePositive(input.distance, "Distance");
  requirePositive(input.fuel, "Fuel used");
  const KM_PER_MILE = 1.609344, L_PER_USGAL = 3.785411784, L_PER_UKGAL = 4.54609;
  let km: number, liters: number;
  if (input.unit === "metric") {
    km = input.distance;
    liters = input.fuel;
  } else {
    km = input.distance * KM_PER_MILE;
    liters = input.fuel * (input.unit === "us" ? L_PER_USGAL : L_PER_UKGAL);
  }
  const lPer100 = (liters / km) * 100;
  return {
    lPer100,
    kmPerL: km / liters,
    mpgUS: km / KM_PER_MILE / (liters / L_PER_USGAL),
    mpgUK: km / KM_PER_MILE / (liters / L_PER_UKGAL),
    costPerDistance: input.price ? (input.fuel * input.price) / input.distance : null,
    tripCost: input.price ? input.fuel * input.price : null,
  };
}

export function bmi(input: { weight: number; height: number; unit: "metric" | "imperial"; heightInches?: number }) {
  let kg = input.weight;
  let m = input.height / 100;
  if (input.unit === "imperial") {
    kg = input.weight * 0.45359237;
    m = (input.height * 12 + (input.heightInches ?? 0)) * 0.0254;
  }
  requirePositive(kg, "Weight");
  requirePositive(m, "Height");
  if (m < 0.5 || m > 2.8) throw new CalcError("Please enter a realistic height.");
  const value = kg / (m * m);
  const category = value < 18.5 ? "Underweight" : value < 25 ? "Normal weight" : value < 30 ? "Overweight" : value < 35 ? "Obesity class I" : value < 40 ? "Obesity class II" : "Obesity class III";
  return { bmi: value, category, healthyMinKg: 18.5 * m * m, healthyMaxKg: 24.9 * m * m };
}
