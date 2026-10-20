import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const calc = (d: Def): ToolDefinition => ({ category: "calculators", processing: "browser", ...d });

const ESTIMATE = "Results are estimates for planning purposes and not financial, tax or legal advice. Lenders and tax authorities may calculate differently.";

export const calculatorTools: ToolDefinition[] = [
  calc({
    id: "percentage-calculator",
    name: "Percentage Calculator",
    icon: "percent",
    popular: true,
    summary: "Calculate X% of Y, what percent one number is of another, percentage change, and percentage increases or decreases.",
    intro:
      "Five everyday percentage questions in one calculator: find a percentage of a number, express one number as a percentage of another, measure the percentage change between two values, and add or subtract a percentage. The formula used is shown so you can check the math.",
    steps: ["Pick the type of calculation.", "Enter X and Y.", "Read the result, which updates as you type."],
    notes: ["Percentage change from zero is undefined and reported as an error.", "Percentage change uses the absolute value of the starting number, so changes from negative values are measured correctly."],
    faq: [
      { q: "How do I calculate 15% of 240?", a: "0.15 × 240 = 36." },
      { q: "Is a 50% increase followed by a 50% decrease back to the start?", a: "No. 100 → 150 → 75. Percentages apply to different bases." },
    ],
    keywords: ["percentage calculator", "percent of", "percentage change", "percent increase", "what percent"],
    related: ["discount-calculator", "profit-margin-calculator", "roi-calculator", "markup-calculator"],
  }),
  calc({
    id: "discount-calculator",
    name: "Discount Calculator",
    icon: "tags",
    summary: "Find the sale price and savings for any discount, including stacked discounts (e.g. 25% + 10% off) and sales tax.",
    intro:
      "Know what you'll really pay before checkout. Enter the original price and the discount to see the final price and how much you save. Shopping with an extra coupon? Add a second discount: stacked discounts multiply rather than add, and the calculator shows the true combined percentage.",
    steps: ["Enter the original price and discount percentage.", "Optionally add a second discount and sales tax.", "Read the final price, savings and effective discount."],
    notes: ["Stores sometimes apply coupons before or after other discounts; the order doesn't change the result for percentage discounts."],
    faq: [
      { q: "Is 20% + 20% off the same as 40% off?", a: "No, it's 36% off: the second 20% applies to the already-reduced price." },
      { q: "How do I calculate a discount by hand?", a: "Multiply the price by (1 − discount/100). $80 at 25% off is $80 × 0.75 = $60." },
    ],
    keywords: ["discount calculator", "sale price calculator", "percent off", "stacked discount"],
    related: ["percentage-calculator", "sales-tax-calculator", "tip-calculator", "markup-calculator"],
  }),
  calc({
    id: "vat-calculator",
    name: "VAT Calculator",
    icon: "receipt",
    summary: "Add VAT to a net price and see the VAT amount and gross total for any rate (20%, 19%, 21%…).",
    intro:
      "Value-added tax is charged on top of net prices in the UK, EU and over 170 countries. Enter the net amount and the VAT rate to get the VAT due and the gross price. Common standard rates: UK 20%, Germany 19%, France 20%, Spain 21%, Italy 22%, Ireland 23%.",
    steps: ["Enter the net (pre-VAT) amount.", "Enter the VAT rate.", "Read the VAT and gross total."],
    notes: [ESTIMATE, "Reduced rates apply to some goods and services; check the rate for your product."],
    faq: [
      { q: "How is VAT calculated?", a: "VAT = net × rate. Gross = net × (1 + rate). £100 at 20% is £20 VAT, £120 gross." },
      { q: "I have a gross price. How do I find the VAT?", a: "Use the Reverse VAT Calculator — dividing by 1.2 is not the same as subtracting 20%." },
    ],
    keywords: ["vat calculator", "add vat", "calculate vat", "vat 20 percent"],
    related: ["reverse-vat-calculator", "sales-tax-calculator", "profit-margin-calculator", "percentage-calculator"],
  }),
  calc({
    id: "reverse-vat-calculator",
    name: "Reverse VAT Calculator",
    icon: "receipt",
    summary: "Extract VAT from a VAT-inclusive (gross) price to find the net amount and the VAT included.",
    intro:
      "Receipts and consumer prices usually include VAT. To book expenses or reclaim VAT you need the net price and the VAT portion. A common mistake is subtracting the rate from the gross price (e.g. 20% of £120 = £24), which is wrong; the correct method divides by 1 + rate (£120 ÷ 1.2 = £100 net, £20 VAT).",
    steps: ["Enter the gross (VAT-inclusive) amount.", "Enter the VAT rate.", "Read the net amount and the VAT included."],
    notes: [ESTIMATE],
    faq: [
      { q: "What is the VAT fraction for 20%?", a: "1/6 of the gross amount (20/120)." },
      { q: "How do I reverse-calculate 19% VAT?", a: "Divide the gross by 1.19." },
    ],
    keywords: ["reverse vat calculator", "remove vat", "vat inclusive", "extract vat"],
    related: ["vat-calculator", "reverse-sales-tax-calculator", "percentage-calculator", "profit-margin-calculator"],
  }),
  calc({
    id: "sales-tax-calculator",
    name: "Sales Tax Calculator",
    icon: "dollar",
    popular: true,
    summary: "Calculate US sales tax and the total price for any combined state, county and city rate and quantity.",
    intro:
      "In the US, sales tax is added at the register and varies by state, county and city — combined rates range from 0% (e.g. Oregon, Delaware) to over 10% in parts of Louisiana, Tennessee and Washington. Enter the price and your combined local rate to see the tax and final total.",
    steps: ["Enter the item price and quantity.", "Enter your combined sales tax rate.", "Read the tax amount and total."],
    notes: [ESTIMATE, "Some items (groceries, clothing, prescriptions) are exempt or taxed at reduced rates in many states."],
    faq: [
      { q: "How do I find my local rate?", a: "Check your state department of revenue website; rates can change by ZIP code." },
      { q: "Is shipping taxed?", a: "It depends on the state. Some tax shipping charges, others don't." },
    ],
    keywords: ["sales tax calculator", "us sales tax", "price with tax", "tax calculator"],
    related: ["reverse-sales-tax-calculator", "discount-calculator", "vat-calculator", "tip-calculator"],
  }),
  calc({
    id: "reverse-sales-tax-calculator",
    name: "Reverse Sales Tax Calculator",
    icon: "dollar",
    summary: "Work backwards from a total paid to find the pre-tax price and the sales tax included.",
    intro:
      "Have a receipt total but need the price before tax for an expense report or price comparison? Divide the total by 1 plus the tax rate. This calculator does it instantly and shows the tax portion.",
    steps: ["Enter the total amount paid.", "Enter the sales tax rate.", "Read the pre-tax price and tax paid."],
    notes: [ESTIMATE, "Rounding at the register can make the result differ by a cent."],
    faq: [
      { q: "Example?", a: "A $54.11 total at 8.25% tax: $54.11 ÷ 1.0825 = $49.99 before tax, $4.12 tax." },
      { q: "Why not subtract 8.25% of the total?", a: "Because tax was calculated on the pre-tax price, not on the total." },
    ],
    keywords: ["reverse sales tax", "pre tax price", "remove sales tax", "back out sales tax"],
    related: ["sales-tax-calculator", "reverse-vat-calculator", "discount-calculator", "percentage-calculator"],
  }),
  calc({
    id: "loan-calculator",
    name: "Loan Calculator",
    icon: "landmark",
    popular: true,
    summary: "Calculate monthly loan payments, total interest and a full amortization schedule. See how extra payments shorten the loan.",
    intro:
      "Plan a personal loan, student loan or business loan. Enter the amount, APR and term to get the fixed monthly payment and the total interest you'll pay. The amortization schedule shows how each payment splits between principal and interest, and an optional extra monthly payment reveals how much faster you can be debt-free.",
    steps: ["Enter loan amount, interest rate and term.", "Optionally add an extra monthly payment.", "Review the payment, totals and schedule."],
    notes: [ESTIMATE, "Assumes a fixed rate, monthly payments and no fees. Origination fees increase the real cost (APR)."],
    faq: [
      { q: "How is the monthly payment calculated?", a: "With the standard amortization formula M = P·r / (1 − (1 + r)^−n), where r is the monthly rate and n the number of payments." },
      { q: "Do extra payments save money?", a: "Yes. Every extra dollar reduces principal immediately, cutting future interest and the number of payments." },
    ],
    keywords: ["loan calculator", "loan payment calculator", "amortization schedule", "personal loan calculator"],
    related: ["mortgage-calculator", "car-payment-calculator", "compound-interest-calculator", "simple-interest-calculator"],
  }),
  calc({
    id: "mortgage-calculator",
    name: "Mortgage Calculator",
    icon: "home",
    popular: true,
    summary: "Estimate your full monthly mortgage payment including principal, interest, property tax, insurance, HOA and PMI.",
    intro:
      "Your mortgage payment is more than principal and interest. This calculator adds property tax, homeowners insurance, HOA dues and private mortgage insurance (PMI) when your down payment is under 20%, giving a realistic monthly housing cost. A yearly amortization table shows how your equity grows, and extra principal payments show how many years you can save.",
    steps: ["Enter home price, down payment, rate and term.", "Add taxes, insurance, HOA and PMI rate.", "Review the monthly breakdown and payoff table."],
    notes: [ESTIMATE, "PMI rates typically range from 0.3% to 1.5% of the loan per year depending on credit score and down payment.", "Property taxes and insurance usually change every year."],
    faq: [
      { q: "How much house can I afford?", a: "A common guideline is keeping total housing costs under 28% of gross monthly income and all debts under 36%." },
      { q: "15 or 30 years?", a: "A 15-year loan has higher payments but a lower rate and far less total interest." },
    ],
    keywords: ["mortgage calculator", "home loan calculator", "mortgage payment", "piti calculator", "pmi calculator"],
    related: ["loan-calculator", "compound-interest-calculator", "savings-calculator", "hourly-to-salary-calculator"],
  }),
  calc({
    id: "car-lease-calculator",
    name: "Car Lease Calculator",
    icon: "car",
    summary: "Calculate a car lease payment from MSRP, negotiated price, residual value, money factor or APR, and sales tax.",
    intro:
      "Lease payments have two parts: depreciation (the value the car loses while you drive it) and a finance charge called the rent charge. This calculator uses the same method as dealers — capitalized cost, residual value and money factor — so you can check a quote line by line and compare it with buying.",
    steps: ["Enter MSRP, negotiated price, down payment, trade-in and fees.", "Enter residual percentage, term and money factor (or APR).", "Review the monthly payment and total lease cost."],
    notes: [ESTIMATE, "Sales tax on leases varies: most states tax the monthly payment, some tax the full price upfront.", "Money factor × 2400 ≈ APR. Ask the dealer for the money factor in writing."],
    faq: [
      { q: "What is a good money factor?", a: "Below 0.00200 (≈4.8% APR) is generally competitive, but it depends on current rates and your credit." },
      { q: "Should I put money down on a lease?", a: "Large down payments are risky: if the car is totalled early, gap insurance pays the lender, not your down payment." },
    ],
    keywords: ["car lease calculator", "lease payment calculator", "money factor", "auto lease"],
    related: ["car-payment-calculator", "loan-calculator", "fuel-consumption-calculator", "sales-tax-calculator"],
  }),
  calc({
    id: "car-payment-calculator",
    name: "Car Payment Calculator",
    icon: "car",
    summary: "Estimate monthly auto loan payments including sales tax, fees, down payment, trade-in and negative equity.",
    intro:
      "Find out what a car really costs per month. Beyond price and APR, the calculator handles sales tax (with the trade-in tax credit most states allow), title and registration fees, your down payment, and any amount you still owe on a trade-in that gets rolled into the new loan.",
    steps: ["Enter price, down payment and trade-in details.", "Add sales tax, fees, APR and term.", "Compare monthly payment and total cost across terms."],
    notes: [ESTIMATE, "Long terms (72–84 months) lower the payment but increase total interest and the risk of owing more than the car is worth."],
    faq: [
      { q: "What is negative equity?", a: "Owing more on your current car than it's worth. That difference gets added to the new loan." },
      { q: "How much should I put down?", a: "Around 20% helps avoid negative equity on a new car." },
    ],
    keywords: ["car payment calculator", "auto loan calculator", "car loan", "vehicle payment"],
    related: ["car-lease-calculator", "loan-calculator", "sales-tax-calculator", "fuel-consumption-calculator"],
  }),
  calc({
    id: "compound-interest-calculator",
    name: "Compound Interest Calculator",
    icon: "trending-up",
    popular: true,
    summary: "See how investments grow with compound interest and regular contributions. Yearly breakdown and effective annual rate.",
    intro:
      "Compound interest earns interest on previous interest, which makes time the most powerful factor in saving. Enter a starting amount, rate, period and compounding frequency, then add regular monthly, quarterly or yearly contributions to see your projected balance year by year.",
    steps: ["Enter initial investment, interest rate and number of years.", "Choose compounding frequency and optional contributions.", "Review the future value and yearly growth table."],
    notes: [ESTIMATE, "Investment returns are not guaranteed; past average returns do not predict future results.", "Taxes and inflation are not included."],
    faq: [
      { q: "What is the rule of 72?", a: "Divide 72 by the annual rate to estimate the years needed to double: at 8%, about 9 years." },
      { q: "Does compounding frequency matter much?", a: "A little: 7% compounded monthly is an effective 7.23% per year versus 7% compounded annually." },
    ],
    keywords: ["compound interest calculator", "investment calculator", "interest compounding", "future value"],
    related: ["simple-interest-calculator", "savings-calculator", "roi-calculator", "loan-calculator"],
  }),
  calc({
    id: "simple-interest-calculator",
    name: "Simple Interest Calculator",
    icon: "percent",
    summary: "Calculate simple interest and the total amount for any principal, rate and time in years, months or days.",
    intro:
      "Simple interest is charged only on the original principal — common for short-term loans, some bonds, car loans in certain states and promissory notes. The formula is I = P × r × t; enter time in years, months or days.",
    steps: ["Enter principal and annual rate.", "Enter the time and its unit.", "Read the interest and total amount."],
    notes: [ESTIMATE, "Day counts use a 365-day year. Some lenders use 360 days (“banker's year”), which slightly increases interest."],
    faq: [
      { q: "Simple vs compound interest?", a: "Simple interest never earns interest on interest; compound interest does, so it grows faster over time." },
      { q: "Example?", a: "$5,000 at 4.5% for 3 years: 5000 × 0.045 × 3 = $675 interest." },
    ],
    keywords: ["simple interest calculator", "interest calculator", "i=prt"],
    related: ["compound-interest-calculator", "loan-calculator", "savings-calculator", "percentage-calculator"],
  }),
  calc({
    id: "savings-calculator",
    name: "Savings Goal Calculator",
    icon: "piggy-bank",
    summary: "Find the monthly deposit needed to reach a savings goal, or how long it will take with your current deposits.",
    intro:
      "Saving for a house deposit, a car, a wedding or an emergency fund? Enter your goal, what you already have and the interest your account earns. Then either set a deadline to see the required monthly deposit, or set a monthly deposit to see when you'll get there.",
    steps: ["Enter goal, current savings and interest rate.", "Choose what you want to calculate.", "Enter a target time or monthly deposit and read the result."],
    notes: [ESTIMATE, "Interest is compounded monthly. High-yield savings rates change over time."],
    faq: [
      { q: "How big should an emergency fund be?", a: "Commonly 3–6 months of essential expenses." },
      { q: "Does interest make a big difference?", a: "Over short periods, deposits matter most; over many years, interest becomes significant." },
    ],
    keywords: ["savings calculator", "savings goal", "how long to save", "monthly savings"],
    related: ["compound-interest-calculator", "simple-interest-calculator", "hourly-to-salary-calculator", "mortgage-calculator"],
  }),
  calc({
    id: "roi-calculator",
    name: "ROI Calculator",
    icon: "trending-up",
    summary: "Calculate return on investment (ROI), gain or loss, and annualized return (CAGR) for any investment period.",
    intro:
      "ROI measures how much an investment earned relative to its cost. A total ROI on its own can mislead — 50% over ten years is very different from 50% in one — so the calculator also shows the annualized return (CAGR) when you enter the holding period.",
    steps: ["Enter the amount invested and the final value.", "Optionally enter the number of years.", "Compare ROI and annualized ROI."],
    notes: [ESTIMATE, "Include all costs (fees, taxes, maintenance) in the amount invested for a realistic ROI."],
    faq: [
      { q: "What is a good ROI?", a: "It depends on risk. Broad stock-market indexes have historically returned roughly 7–10% per year before inflation." },
      { q: "What is CAGR?", a: "Compound annual growth rate: the constant yearly rate that turns the start value into the end value." },
    ],
    keywords: ["roi calculator", "return on investment", "cagr calculator", "investment return"],
    related: ["compound-interest-calculator", "profit-margin-calculator", "break-even-calculator", "percentage-calculator"],
  }),
  calc({
    id: "profit-margin-calculator",
    name: "Profit Margin Calculator",
    icon: "badge-percent",
    popular: true,
    summary: "Calculate gross profit margin and markup from cost and price, or find the selling price for a target margin.",
    intro:
      "Margin and markup are often confused, which leads to under-pricing. Margin is profit as a share of the selling price; markup is profit as a share of cost. Enter your cost and price to see both, or enter a target margin to get the price you need to charge.",
    steps: ["Choose what to calculate.", "Enter cost and selling price, or cost and target margin.", "Read margin, markup and profit."],
    notes: ["This is gross margin: it excludes overheads such as rent, salaries and marketing."],
    faq: [
      { q: "Is a 50% markup a 50% margin?", a: "No. A 50% markup equals a 33.3% margin; a 50% margin requires a 100% markup." },
      { q: "How do I price for a 40% margin?", a: "Price = cost ÷ (1 − 0.40). A $60 cost becomes $100." },
    ],
    keywords: ["profit margin calculator", "gross margin", "margin vs markup", "pricing calculator"],
    related: ["markup-calculator", "break-even-calculator", "roi-calculator", "discount-calculator"],
  }),
  calc({
    id: "markup-calculator",
    name: "Markup Calculator",
    icon: "tags",
    summary: "Calculate selling price and profit from cost and markup percentage, and see the resulting gross margin.",
    intro:
      "Retailers and contractors often price by marking up cost. Enter the cost and your markup percentage to get the selling price and profit, plus the equivalent margin so you can compare with industry benchmarks quoted as margins.",
    steps: ["Enter the cost.", "Enter the markup percentage.", "Read price, profit and margin."],
    notes: ["Keystone pricing (100% markup) doubles the cost and yields a 50% margin."],
    faq: [
      { q: "Markup formula?", a: "Price = Cost × (1 + Markup/100)." },
      { q: "Why is margin always lower than markup?", a: "Margin divides the same profit by the larger selling price." },
    ],
    keywords: ["markup calculator", "markup percentage", "selling price calculator", "keystone pricing"],
    related: ["profit-margin-calculator", "break-even-calculator", "discount-calculator", "vat-calculator"],
  }),
  calc({
    id: "break-even-calculator",
    name: "Break-Even Calculator",
    icon: "scale",
    summary: "Find how many units you must sell to cover fixed costs, plus break-even revenue and contribution margin.",
    intro:
      "The break-even point is where revenue exactly covers costs — every sale beyond it is profit. Enter fixed costs (rent, salaries, software), the price per unit and the variable cost per unit (materials, shipping, payment fees) to see the units and revenue needed.",
    steps: ["Enter fixed costs for the period.", "Enter price and variable cost per unit.", "Read break-even units, revenue and contribution margin."],
    notes: ["Assumes constant price and unit costs; volume discounts or price changes shift the break-even point."],
    faq: [
      { q: "What is contribution margin?", a: "Price minus variable cost per unit — the amount each sale contributes toward fixed costs." },
      { q: "How can I lower my break-even point?", a: "Raise prices, cut variable costs or reduce fixed costs." },
    ],
    keywords: ["break even calculator", "break even point", "contribution margin", "units to break even"],
    related: ["profit-margin-calculator", "markup-calculator", "roi-calculator", "percentage-calculator"],
  }),
  calc({
    id: "hourly-to-salary-calculator",
    name: "Hourly to Salary Calculator",
    icon: "briefcase",
    popular: true,
    summary: "Convert hourly wage to annual, monthly, bi-weekly and weekly salary — or salary back to an hourly rate.",
    intro:
      "Compare job offers paid hourly and salaried on equal terms. Enter your hourly rate (or annual salary), hours per week and paid weeks per year; the calculator shows the equivalent yearly, monthly, bi-weekly, weekly and daily gross pay. A full-time US year is typically 40 hours × 52 weeks = 2,080 hours.",
    steps: ["Choose the conversion direction.", "Enter the wage or salary.", "Adjust hours and weeks, then read the results."],
    notes: ["Figures are gross (before taxes and deductions).", "Unpaid vacation reduces paid weeks; adjust accordingly."],
    faq: [
      { q: "$25 an hour is how much a year?", a: "About $52,000 at 40 hours a week and 52 weeks." },
      { q: "$60,000 a year is how much an hour?", a: "About $28.85 at 2,080 hours." },
    ],
    keywords: ["hourly to salary", "salary to hourly", "wage calculator", "annual salary calculator"],
    related: ["overtime-calculator", "savings-calculator", "time-duration-calculator", "percentage-calculator"],
  }),
  calc({
    id: "overtime-calculator",
    name: "Overtime Calculator",
    icon: "clock",
    summary: "Calculate overtime pay at time-and-a-half or double time, and total gross pay for the week.",
    intro:
      "Under the US Fair Labor Standards Act, non-exempt employees must be paid at least 1.5 times their regular rate for hours over 40 in a workweek. Enter your rate and hours to check your paycheck, including any double-time hours some states and contracts require.",
    steps: ["Enter hourly rate and regular hours.", "Enter overtime hours and multiplier (and double-time hours if any).", "Read regular, overtime and total pay."],
    notes: [ESTIMATE, "California and some other states also require daily overtime (over 8 hours a day) and double time in certain cases."],
    faq: [
      { q: "What is time and a half for $20/hour?", a: "$30 per overtime hour." },
      { q: "Are salaried employees eligible?", a: "Only if they are non-exempt under the FLSA salary and duties tests." },
    ],
    keywords: ["overtime calculator", "time and a half", "overtime pay", "double time calculator"],
    related: ["hourly-to-salary-calculator", "time-duration-calculator", "tip-calculator", "percentage-calculator"],
  }),
  calc({
    id: "tip-calculator",
    name: "Tip Calculator",
    icon: "coffee",
    summary: "Calculate the tip and total for any bill with one-tap 15%, 18%, 20% presets or a custom percentage.",
    intro:
      "Quickly work out a tip at restaurants, bars, salons or for delivery. Tap a common percentage or enter your own; the tip and total update instantly. In the US, 15–20% is customary for table service, 18–20%+ is increasingly common in cities.",
    steps: ["Enter the bill amount.", "Choose a tip percentage.", "Read the tip and total."],
    notes: ["Some people tip on the pre-tax amount; enter the subtotal if you prefer that.", "Tipping customs differ widely by country."],
    faq: [
      { q: "Should I tip on tax?", a: "Etiquette experts commonly say tipping on the pre-tax subtotal is acceptable." },
      { q: "Splitting with friends?", a: "Use the Tip Split Calculator to divide the total evenly." },
    ],
    keywords: ["tip calculator", "gratuity calculator", "how much to tip", "restaurant tip"],
    related: ["tip-split-calculator", "sales-tax-calculator", "discount-calculator", "percentage-calculator"],
  }),
  calc({
    id: "tip-split-calculator",
    name: "Tip & Bill Split Calculator",
    icon: "users",
    summary: "Split a bill and tip evenly between any number of people, with exact cent handling and optional rounding up.",
    intro:
      "Group dinner? Enter the bill, the tip percentage and the number of people to see what each person owes. When the total doesn't divide evenly into cents, the calculator tells you exactly who pays a cent more, so the total always adds up. Rounding up to whole dollars makes paying with cash easier.",
    steps: ["Enter bill, tip percentage and number of people.", "Optionally round each share up.", "Read each person's share and the totals."],
    notes: ["For uneven orders, split by item first and use the Tip Calculator per person."],
    faq: [
      { q: "Why does one person pay a cent more?", a: "Because some totals can't be divided evenly into whole cents." },
      { q: "What happens to extra money when rounding up?", a: "It goes to the tip; the “Total collected” shows the new total." },
    ],
    keywords: ["split bill calculator", "tip split", "split check", "divide bill"],
    related: ["tip-calculator", "percentage-calculator", "random-picker", "discount-calculator"],
  }),
  calc({
    id: "age-calculator",
    name: "Age Calculator",
    icon: "cake",
    popular: true,
    summary: "Calculate exact age in years, months and days, total days and weeks, days until the next birthday and birth weekday.",
    intro:
      "Find your exact age — or anyone's — on any date. The calculator handles leap years and months of different lengths correctly, and also shows total months, weeks and days lived, the weekday you were born on, and how many days remain until your next birthday.",
    steps: ["Enter the date of birth.", "Optionally change the “age on” date.", "Read the results."],
    notes: ["People born on 29 February have their birthday counted on 1 March in non-leap years."],
    faq: [
      { q: "How old will I be on a future date?", a: "Change the “Age on date” field to that date." },
      { q: "How is age calculated?", a: "By comparing years, then months, then days, borrowing days from the previous month when needed." },
    ],
    keywords: ["age calculator", "how old am i", "calculate age", "birthday calculator", "date of birth"],
    related: ["date-difference-calculator", "countdown-timer", "time-duration-calculator", "timestamp-to-date-converter"],
  }),
  calc({
    id: "date-difference-calculator",
    name: "Date Difference Calculator",
    icon: "calendar-days",
    summary: "Count days, weeks, months and years between two dates, including business days (Mon–Fri).",
    intro:
      "How many days until a deadline, between two events or in a contract period? Enter two dates to get the total days, a years-months-days breakdown, weeks and business days. Include the end date when counting inclusive periods such as hotel nights or rental days.",
    steps: ["Enter start and end dates.", "Tick “Include end date” for inclusive counting.", "Read days, weeks, business days and more."],
    notes: ["Business days exclude weekends only; public holidays vary by country and are not removed.", "Daylight saving changes do not affect day counts."],
    faq: [
      { q: "How many days are between Jan 1 and Dec 31?", a: "364 days, or 365 if you include the end date (in a non-leap year)." },
      { q: "Can the end date be earlier?", a: "Yes; the tool shows the absolute difference and notes the reversed order." },
    ],
    keywords: ["date difference", "days between dates", "date calculator", "business days calculator"],
    related: ["age-calculator", "time-duration-calculator", "countdown-timer", "unix-timestamp-converter"],
  }),
  calc({
    id: "time-duration-calculator",
    name: "Time Duration Calculator",
    icon: "hourglass",
    summary: "Calculate hours and minutes between two times, including overnight shifts and unpaid breaks. Decimal hours for timesheets.",
    intro:
      "Work out shift lengths, billable hours or travel time. Enter a start and end time; if the end is earlier, the calculator assumes the period crosses midnight. Subtract an unpaid break and get the result in hours:minutes and decimal hours ready for timesheets and invoices.",
    steps: ["Enter start and end times.", "Enter break minutes if any.", "Read the duration and decimal hours."],
    notes: ["For periods longer than 24 hours, use the Date Difference Calculator."],
    faq: [
      { q: "What is 7 hours 45 minutes in decimal?", a: "7.75 hours." },
      { q: "Does it handle night shifts?", a: "Yes, 22:00 to 06:00 is calculated as 8 hours." },
    ],
    keywords: ["time duration calculator", "hours between times", "time calculator", "timesheet calculator"],
    related: ["date-difference-calculator", "overtime-calculator", "stopwatch", "hourly-to-salary-calculator"],
  }),
  calc({
    id: "bmi-calculator",
    name: "BMI Calculator",
    icon: "heart-pulse",
    popular: true,
    summary: "Calculate Body Mass Index in US or metric units, see the WHO category and the healthy weight range for your height.",
    intro:
      "Body Mass Index relates weight to height and is used worldwide as a quick screening measure for adults. Enter weight and height in pounds and feet/inches or kilograms and centimetres; the calculator shows your BMI, the WHO category and the weight range that corresponds to a BMI of 18.5–24.9 for your height.",
    steps: ["Choose units.", "Enter weight and height.", "Read your BMI, category and healthy range."],
    notes: ["BMI is not a diagnostic tool. It does not distinguish muscle from fat and is not valid for children, pregnant women or some athletes.", "Talk to a healthcare professional about your health."],
    faq: [
      { q: "What is a normal BMI?", a: "18.5 to 24.9 for adults under WHO criteria." },
      { q: "Is BMI accurate for muscular people?", a: "Often not; muscle is dense, so BMI can classify fit people as overweight." },
    ],
    keywords: ["bmi calculator", "body mass index", "healthy weight calculator", "bmi chart"],
    related: ["age-calculator", "temperature-converter", "percentage-calculator", "fuel-consumption-calculator"],
  }),
  calc({
    id: "aspect-ratio-calculator",
    name: "Aspect Ratio Calculator",
    icon: "ratio",
    summary: "Find the aspect ratio of any width and height, and calculate a new width or height that keeps the same proportions.",
    intro:
      "Resize videos, images and embeds without distortion. Enter original dimensions to get the simplified ratio (1920×1080 → 16:9) and its decimal form, then type a new width or height to calculate the matching other dimension.",
    steps: ["Enter the original width and height.", "Enter the new width or the new height.", "Read the ratio and the scaled size."],
    notes: ["Some common sizes do not reduce to the “marketing” ratio: 1366×768 is 683:384, close to but not exactly 16:9."],
    faq: [
      { q: "What are common ratios?", a: "16:9 (HD video), 4:3 (older screens, iPad), 3:2 (DSLR photos), 1:1 (square), 9:16 (stories), 21:9 (ultrawide)." },
      { q: "How do I keep proportions?", a: "New height = new width × original height ÷ original width." },
    ],
    keywords: ["aspect ratio calculator", "16:9 calculator", "resize proportions", "ratio calculator"],
    related: ["image-resizer", "image-cropper", "screen-resolution-checker", "css-unit-converter"],
  }),
  calc({
    id: "fuel-consumption-calculator",
    name: "Fuel Consumption Calculator",
    icon: "fuel",
    summary: "Calculate MPG (US & UK), L/100 km and km/L from distance and fuel used, plus trip fuel cost.",
    intro:
      "Track your car's real fuel economy and compare it with official figures. Fill up, note the distance and the amount of fuel needed to refill, and the calculator converts between US MPG, UK MPG, litres per 100 km and kilometres per litre. Add the fuel price to see the trip cost and cost per mile or kilometre.",
    steps: ["Choose your units.", "Enter distance and fuel used.", "Optionally enter the fuel price for cost figures."],
    notes: ["US and UK gallons differ (3.785 L vs 4.546 L), so UK MPG figures are about 20% higher for the same car."],
    faq: [
      { q: "How do I convert MPG to L/100 km?", a: "L/100 km = 235.21 ÷ US MPG." },
      { q: "Why does my MPG differ from the sticker?", a: "Driving style, speed, temperature, tire pressure and short trips all affect real consumption." },
    ],
    keywords: ["fuel consumption calculator", "mpg calculator", "l/100km", "gas mileage calculator", "fuel cost"],
    related: ["car-payment-calculator", "electricity-cost-calculator", "car-lease-calculator", "temperature-converter"],
  }),
  calc({
    id: "electricity-cost-calculator",
    name: "Electricity Cost Calculator",
    icon: "zap",
    summary: "Estimate the electricity cost of any appliance per day, month and year from its wattage, usage hours and kWh price.",
    intro:
      "Find out what your space heater, gaming PC, aquarium or air conditioner really costs to run. Multiply power by hours of use to get energy in kilowatt-hours, then by your electricity rate. The average US residential price is roughly 16–18 cents per kWh, but it varies a lot by state and plan.",
    steps: ["Enter the device's power in watts.", "Enter daily hours of use and number of devices.", "Enter your price per kWh and read the costs."],
    notes: [ESTIMATE, "Rated wattage is a maximum; many devices draw less on average. A plug-in power meter gives exact figures."],
    faq: [
      { q: "How many kWh does a 100 W bulb use?", a: "0.1 kWh per hour, 2.4 kWh per day if left on." },
      { q: "Where do I find my rate?", a: "On your utility bill, usually listed as cents per kWh." },
    ],
    keywords: ["electricity cost calculator", "kwh calculator", "power consumption cost", "energy cost"],
    related: ["fuel-consumption-calculator", "data-storage-converter", "temperature-converter", "percentage-calculator"],
  }),
  calc({
    id: "data-storage-converter",
    name: "Data Storage Converter",
    icon: "hard-drive",
    summary: "Convert between bits, bytes, KB, MB, GB, TB and binary units KiB, MiB, GiB, TiB — and see why your 1 TB drive shows 931 GB.",
    intro:
      "Storage makers use decimal units (1 GB = 1,000,000,000 bytes), while Windows and RAM use binary units (1 GiB = 1,073,741,824 bytes) but often label them “GB”. That's why a 1 TB drive appears as about 931 GB. Convert any value between decimal, binary and bit-based units used for network speeds.",
    steps: ["Enter a value and its unit.", "Read the conversions in common units.", "See the full table for every unit."],
    notes: ["Network speeds use bits (Mb/s); file sizes use bytes. 100 Mb/s ≈ 12.5 MB/s."],
    faq: [
      { q: "Is 1 KB 1000 or 1024 bytes?", a: "Officially 1000 bytes (SI). 1024 bytes is a kibibyte (KiB)." },
      { q: "Why does my 1 TB drive show 931 GB?", a: "Because 10¹² bytes ÷ 1024³ = 931.3 GiB, which Windows labels as GB." },
    ],
    keywords: ["data storage converter", "gb to mb", "bytes converter", "gib vs gb", "tb to gb"],
    related: ["number-base-converter", "electricity-cost-calculator", "temperature-converter", "binary-calculator"],
  }),
  calc({
    id: "temperature-converter",
    name: "Temperature Converter",
    icon: "thermometer",
    popular: true,
    summary: "Convert between Fahrenheit, Celsius, Kelvin and Rankine instantly, with the exact formulas shown.",
    intro:
      "Convert cooking temperatures, weather forecasts and science values between scales. Enter a value in any unit to see all four. The tool rejects temperatures below absolute zero (−273.15 °C / −459.67 °F), which cannot physically exist.",
    steps: ["Enter a temperature.", "Choose its unit.", "Read the converted values."],
    notes: ["Kelvin has no degree symbol and no negative values."],
    faq: [
      { q: "What is 350 °F in Celsius?", a: "About 177 °C." },
      { q: "Where do Celsius and Fahrenheit meet?", a: "At −40 degrees, which is the same on both scales." },
    ],
    keywords: ["temperature converter", "fahrenheit to celsius", "celsius to fahrenheit", "kelvin converter"],
    related: ["data-storage-converter", "css-unit-converter", "bmi-calculator", "fuel-consumption-calculator"],
  }),
];
