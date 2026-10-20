import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const gen = (d: Def): ToolDefinition => ({ category: "generators", processing: "browser", ...d });

const QR_NOTE = "QR codes are generated on your device; the content is never sent to a server. Codes are static and never expire.";

export const generatorTools: ToolDefinition[] = [
  gen({
    id: "qr-code-generator",
    name: "QR Code Generator",
    icon: "qr-code",
    popular: true,
    summary: "Create free QR codes for links and text with custom colors, size and error correction. Download PNG or SVG. No expiry.",
    intro:
      "Generate a QR code for a website, menu, flyer or business card in seconds. Customize foreground and background colors, size and the error-correction level, then download a PNG for screens or an SVG that stays sharp at any print size.\n\n" + QR_NOTE,
    steps: ["Enter a URL or text.", "Adjust colors, size and error correction.", "Download as PNG or SVG and test-scan before printing."],
    notes: ["Dark modules on a light background scan best; inverted or low-contrast colors may fail on some phones.", "Higher error correction makes codes denser but more robust to damage or logos placed on top.", "Unlike “dynamic” QR services, you can't change the destination after printing — use a URL you control."],
    faq: [
      { q: "Do these QR codes expire?", a: "No. The data is encoded directly in the image, so it works forever." },
      { q: "How small can I print it?", a: "About 2 × 2 cm (0.8 in) for short URLs scanned from close up; larger for long content or longer distances." },
    ],
    keywords: ["qr code generator", "free qr code", "create qr code", "qr code svg", "qr code maker"],
    related: ["wifi-qr-generator", "vcard-qr-generator", "qr-code-reader", "barcode-generator"],
  }),
  gen({
    id: "wifi-qr-generator",
    name: "WiFi QR Code Generator",
    icon: "wifi",
    popular: true,
    summary: "Make a QR code that connects guests to your Wi-Fi network instantly — no typing passwords. Supports WPA, WEP and open networks.",
    intro:
      "Print a Wi-Fi QR code for your home, office, café or Airbnb so guests can join with their camera app. The code contains the network name, security type and password in the standard WIFI: format recognized by iPhone (iOS 11+) and Android (10+).\n\nYour network password is encoded locally and never leaves your device.",
    steps: ["Enter the network name (SSID) exactly as it appears.", "Choose the security type and enter the password.", "Download the code and test it with a phone."],
    notes: ["Anyone who can see the code can join the network — consider a separate guest network.", "Special characters such as ; , : and \" are escaped automatically."],
    faq: [
      { q: "Which security option for WPA3?", a: "Choose WPA/WPA2/WPA3; the same WPA tag covers them." },
      { q: "Does it work for hidden networks?", a: "Yes, tick “Hidden network”." },
    ],
    keywords: ["wifi qr code", "wifi qr generator", "share wifi password", "wifi qr code generator"],
    related: ["qr-code-generator", "password-generator", "vcard-qr-generator", "qr-code-reader"],
  }),
  gen({
    id: "email-qr-generator",
    name: "Email QR Code Generator",
    icon: "mail",
    summary: "Create a QR code that opens a pre-addressed email with optional subject and message. Download PNG or SVG.",
    intro:
      "Make it effortless for customers to contact support, request a quote or enter a contest: scanning the code opens their email app with your address, subject and message already filled in. It uses a standard mailto: link supported by all major phones.",
    steps: ["Enter the recipient address.", "Optionally add a subject and message.", "Download the code."],
    notes: ["Long messages make the QR code dense; keep the body short.", QR_NOTE],
    faq: [
      { q: "Does the email send automatically?", a: "No. The user always reviews and taps Send in their mail app." },
      { q: "Can I add CC recipients?", a: "Yes, the generator supports the standard mailto parameters internally; the main form covers the common cases." },
    ],
    keywords: ["email qr code", "mailto qr code", "qr code email generator"],
    related: ["qr-code-generator", "phone-qr-generator", "sms-qr-generator", "vcard-qr-generator"],
  }),
  gen({
    id: "phone-qr-generator",
    name: "Phone Number QR Code Generator",
    icon: "smartphone",
    summary: "Generate a QR code that dials a phone number when scanned. Great for flyers, signs and business cards.",
    intro:
      "A tel: QR code lets people call you without typing your number. Scanning it shows a call prompt on iPhone and Android. Use the international format with your country code so it works for everyone.",
    steps: ["Enter the phone number in international format.", "Customize the design if you like.", "Download and test-scan."],
    notes: ["The phone never calls automatically; the user confirms.", QR_NOTE],
    faq: [
      { q: "Should I include +1?", a: "Yes, international format (e.g. +1 555 123 4567) works from any country." },
      { q: "Can I add a contact instead?", a: "Use the vCard QR Generator to save a full contact card." },
    ],
    keywords: ["phone qr code", "call qr code", "tel qr code generator"],
    related: ["sms-qr-generator", "vcard-qr-generator", "qr-code-generator", "email-qr-generator"],
  }),
  gen({
    id: "sms-qr-generator",
    name: "SMS QR Code Generator",
    icon: "message",
    summary: "Create a QR code that opens a text message to your number with a pre-filled message — perfect for opt-ins and feedback.",
    intro:
      "SMS QR codes power text-to-join campaigns, appointment confirmations and feedback requests. Scanning opens the messaging app with your number and the message already typed; the user just taps Send.",
    steps: ["Enter the destination phone number.", "Add the pre-filled message.", "Download and test with both iPhone and Android."],
    notes: ["Uses the widely supported SMSTO: format.", "Messages with emoji or non-Latin characters count against a 70-character SMS segment.", QR_NOTE],
    faq: [
      { q: "Is the message sent automatically?", a: "No, the user must press Send." },
      { q: "Are there legal requirements for SMS marketing?", a: "Yes. In the US, the TCPA requires consent; include opt-out instructions in replies." },
    ],
    keywords: ["sms qr code", "text message qr code", "smsto qr"],
    related: ["phone-qr-generator", "email-qr-generator", "qr-code-generator", "vcard-qr-generator"],
  }),
  gen({
    id: "vcard-qr-generator",
    name: "vCard QR Code Generator",
    icon: "contact",
    popular: true,
    summary: "Turn your contact details into a vCard QR code people can scan to save you to their phone. Also download a .vcf file.",
    intro:
      "Put a vCard QR code on your business card, badge or email signature. Scanning it opens a “Create contact” screen with your name, company, title, phone numbers, email, website and address filled in. You can also download the same data as a .vcf file.",
    steps: ["Fill in the fields you want to share.", "Check the preview and adjust the design.", "Download the QR code and/or the .vcf file."],
    notes: ["More fields make a denser code; print it at least 2.5 cm (1 in) wide.", "The code uses vCard 3.0, the most compatible version.", QR_NOTE],
    faq: [
      { q: "Can I update the contact later?", a: "No, a static code can't change. Generate and print a new one." },
      { q: "Does it work on iPhone?", a: "Yes, the built-in Camera app recognizes vCard QR codes." },
    ],
    keywords: ["vcard qr code", "business card qr code", "contact qr code", "vcf qr"],
    related: ["qr-code-generator", "phone-qr-generator", "email-qr-generator", "qr-code-reader"],
  }),
  gen({
    id: "qr-code-reader",
    name: "QR Code Reader",
    icon: "scan-qr",
    popular: true,
    summary: "Scan QR codes from an image or your camera directly in the browser. See the content before you open any link.",
    intro:
      "Decode a QR code from a screenshot, photo or document — or scan one live with your device camera. The decoded content is shown as text first, so you can check where a link really goes before opening it, which helps protect against “quishing” (QR phishing).",
    steps: ["Upload an image containing a QR code, or start the camera.", "Wait for the code to be detected.", "Copy the content or open the link after checking it."],
    notes: ["Camera access requires HTTPS and your permission; the video stays on your device.", "Blurry, tiny or heavily stylized codes may not decode — crop closer or use a sharper photo."],
    faq: [
      { q: "Can it read barcodes?", a: "This reader focuses on QR codes. One-dimensional barcodes are not decoded." },
      { q: "Is the camera stream uploaded?", a: "No. Frames are analysed locally with the jsQR library." },
    ],
    keywords: ["qr code reader", "scan qr code online", "qr scanner", "decode qr code from image"],
    related: ["qr-code-generator", "barcode-generator", "wifi-qr-generator", "url-decoder"],
  }),
  gen({
    id: "barcode-generator",
    name: "Barcode Generator",
    icon: "barcode",
    summary: "Generate Code 128, EAN-13, UPC-A, EAN-8, Code 39, ITF-14, Codabar and MSI barcodes. Download PNG or SVG.",
    intro:
      "Create barcodes for products, inventory labels, shipping cartons and libraries. Choose the symbology, type the value and the barcode renders instantly; check digits for EAN and UPC are calculated automatically, and invalid input is flagged with an explanation.",
    steps: ["Choose a barcode format.", "Enter the value.", "Adjust bar size and download PNG or SVG."],
    notes: ["To sell through retailers you need official GS1 product numbers; a generator cannot issue them.", "SVG output prints sharpest. Test-scan before mass printing."],
    faq: [
      { q: "Which format should I use for internal labels?", a: "Code 128 encodes letters and numbers compactly and scans reliably." },
      { q: "Why is my EAN-13 rejected?", a: "EAN-13 needs exactly 12 digits (the 13th check digit is added) or 13 digits with a correct check digit." },
    ],
    keywords: ["barcode generator", "ean 13 generator", "upc barcode", "code 128 generator"],
    related: ["qr-code-generator", "qr-code-reader", "random-number-generator", "uuid-generator"],
  }),
  gen({
    id: "password-generator",
    name: "Password Generator",
    icon: "key",
    popular: true,
    summary: "Generate strong random passwords up to 128 characters with the browser's cryptographic RNG. Entropy shown live.",
    intro:
      "Weak and reused passwords are the main cause of account takeovers. This generator creates truly random passwords with crypto.getRandomValues(), guarantees at least one character from each selected set, and shows the entropy in bits so you know how strong the result is.\n\nPasswords are generated on your device and never transmitted or stored.",
    steps: ["Set the length (16+ recommended).", "Choose character sets and exclusions.", "Copy the password into your password manager."],
    notes: ["Use a unique password for every site and store them in a password manager.", "Excluding look-alike characters slightly reduces entropy but helps when typing passwords manually."],
    faq: [
      { q: "How long should a password be?", a: "At least 12–16 characters with mixed sets, which gives 80+ bits of entropy." },
      { q: "Is this better than a passphrase?", a: "Both are strong if long enough. Passphrases are easier to remember and type." },
    ],
    keywords: ["password generator", "random password", "strong password generator", "secure password"],
    related: ["passphrase-generator", "password-entropy-calculator", "uuid-generator", "pdf-password-protect"],
  }),
  gen({
    id: "passphrase-generator",
    name: "Passphrase Generator (Diceware)",
    icon: "key",
    summary: "Create memorable passphrases from the EFF's 7,776-word Diceware list using secure randomness. Entropy displayed.",
    intro:
      "A passphrase like Turbine-Spinach-Ruckus-Gallon-Pried7 is both stronger and easier to remember than P@ssw0rd!. Each word from the EFF large wordlist adds about 12.9 bits of entropy, so five words give roughly 65 bits — enough for most accounts — and six or more suits master passwords.",
    steps: ["Choose the number of words.", "Pick a separator and whether to capitalize or add a digit.", "Copy the passphrase."],
    notes: ["Words are chosen with a cryptographically secure generator, not Math.random().", "Never use famous quotes or song lyrics; they are in attackers' dictionaries."],
    faq: [
      { q: "How many words do I need?", a: "Five for regular accounts, six or seven for a password manager master password." },
      { q: "Is it okay that the words are in a public list?", a: "Yes. Security comes from the random choice among 7,776 words per position, not from secrecy of the list." },
    ],
    keywords: ["passphrase generator", "diceware", "memorable password", "eff wordlist"],
    related: ["password-generator", "password-entropy-calculator", "random-picker", "uuid-generator"],
  }),
  gen({
    id: "random-number-generator",
    name: "Random Number Generator",
    icon: "dices",
    summary: "Generate random integers or decimals in any range, single or in bulk, with no-duplicate and sort options.",
    intro:
      "Pick lottery-style numbers, sample rows for an audit, assign random IDs or settle a game. Numbers come from the browser's cryptographically secure generator using rejection sampling, so every value in the range is equally likely — no modulo bias.",
    steps: ["Choose whole numbers or decimals.", "Set minimum, maximum and quantity.", "Click Generate and copy the result."],
    notes: ["Up to 10,000 numbers per batch.", "For official drawings and gambling, use a certified, auditable process."],
    faq: [
      { q: "Can I get unique numbers only?", a: "Yes, tick “No duplicates” (for whole numbers)." },
      { q: "Is it truly random?", a: "It uses the operating system's CSPRNG via Web Crypto, which is suitable for security purposes." },
    ],
    keywords: ["random number generator", "rng", "random integer", "pick a number"],
    related: ["random-picker", "password-generator", "uuid-generator", "random-color-generator"],
  }),
  gen({
    id: "random-picker",
    name: "Random Name Picker",
    icon: "shuffle",
    summary: "Pick one or more random winners from a list of names or items — fair, secure and with a little roll animation.",
    intro:
      "Draw giveaway winners, choose who presents first or decide where to eat. Paste one entry per line, choose how many to pick, and get unique random selections from a cryptographically secure generator.",
    steps: ["Enter items, one per line.", "Choose how many to pick.", "Click “Pick at random”."],
    notes: ["Duplicate lines count as separate entries (useful for weighted draws).", "Blank lines are ignored."],
    faq: [
      { q: "Can I weight entries?", a: "Yes — add an entry several times to increase its chance." },
      { q: "Is it fair?", a: "Every remaining entry has an equal probability at each pick." },
    ],
    keywords: ["random name picker", "random picker", "giveaway picker", "random choice"],
    related: ["random-number-generator", "sort-lines", "tip-split-calculator", "password-generator"],
  }),
  gen({
    id: "random-color-generator",
    name: "Random Color Generator",
    icon: "palette",
    summary: "Generate random colors and harmonious palettes (analogous, complementary, triadic, monochrome) with HEX and RGB codes.",
    intro:
      "Find inspiration for designs, brand explorations and data visualizations. Generate fully random swatches, or base a palette on color-theory rules for combinations that look good together. Click to copy any HEX code.",
    steps: ["Choose a palette type.", "Click Generate until you like the result.", "Copy individual colors or the whole palette."],
    notes: ["Check text contrast with the Color Converter before using colors for text."],
    faq: [
      { q: "What is an analogous palette?", a: "Colors next to each other on the color wheel, which feel calm and cohesive." },
      { q: "What is a triadic palette?", a: "Three colors evenly spaced around the wheel (120° apart) for vibrant contrast." },
    ],
    keywords: ["random color generator", "color palette generator", "random hex color"],
    related: ["color-converter", "gradient-generator", "image-color-picker", "random-number-generator"],
  }),
  gen({
    id: "gradient-generator",
    name: "CSS Gradient Generator",
    icon: "blend",
    summary: "Design linear, radial and conic CSS gradients with up to 8 color stops and copy ready-to-use CSS.",
    intro:
      "Build backgrounds and buttons with smooth gradients. Choose the gradient type and angle, add color stops and drag their positions while watching a live preview. Copy the background declaration straight into your stylesheet.",
    steps: ["Choose linear, radial or conic.", "Set the angle and color stops.", "Copy the CSS."],
    notes: ["All modern browsers support these gradients without vendor prefixes.", "Conic gradients are ideal for pie-chart effects and color wheels."],
    faq: [
      { q: "How do I make a hard edge?", a: "Place two stops at the same position with different colors." },
      { q: "Can I use transparency?", a: "The picker uses solid colors; edit the copied CSS to use rgba() or #RRGGBBAA values." },
    ],
    keywords: ["css gradient generator", "linear gradient", "gradient background", "conic gradient"],
    related: ["css-shadow-generator", "css-border-radius-generator", "random-color-generator", "color-converter"],
  }),
  gen({
    id: "css-shadow-generator",
    name: "CSS Box Shadow Generator",
    icon: "layers",
    summary: "Create layered CSS box-shadows visually — offset, blur, spread, color, opacity and inset — and copy the code.",
    intro:
      "Realistic shadows usually combine several layers: a tight, darker shadow for contact and a large, soft one for depth. Add up to five layers, tweak each with sliders and copy the combined box-shadow value.",
    steps: ["Adjust the first layer's offset, blur, spread and opacity.", "Add more layers for depth.", "Copy the CSS."],
    notes: ["Large blur radii on many elements can slow down scrolling on low-end devices.", "Use negative spread to keep shadows from extending sideways."],
    faq: [
      { q: "What does inset do?", a: "It draws the shadow inside the element, creating a pressed or recessed look." },
      { q: "box-shadow vs drop-shadow()?", a: "box-shadow follows the element's box; filter: drop-shadow() follows the shape of transparent images." },
    ],
    keywords: ["css box shadow generator", "box-shadow", "shadow css", "neumorphism shadow"],
    related: ["css-border-radius-generator", "gradient-generator", "css-unit-converter", "color-converter"],
  }),
  gen({
    id: "css-border-radius-generator",
    name: "CSS Border Radius Generator",
    icon: "square-dashed",
    summary: "Set rounded corners per corner in px, % or rem with a live preview and the shortest valid CSS.",
    intro:
      "Round corners consistently across buttons, cards and images. Adjust all corners together or individually and copy the shortest equivalent CSS — the generator collapses values like 8px 8px 8px 8px to just 8px.",
    steps: ["Choose a unit.", "Adjust corners (linked or individually).", "Copy the border-radius declaration."],
    notes: ["50% on a square makes a circle; 9999px makes pill-shaped buttons."],
    faq: [
      { q: "What is the order of values?", a: "Top-left, top-right, bottom-right, bottom-left (clockwise)." },
      { q: "Can I make elliptical corners?", a: "Yes with the slash syntax (e.g. 50% / 25%), which you can add to the copied CSS." },
    ],
    keywords: ["border radius generator", "rounded corners css", "css border-radius"],
    related: ["css-shadow-generator", "gradient-generator", "px-to-rem-converter", "css-unit-converter"],
  }),
  gen({
    id: "utm-link-builder",
    name: "UTM Link Builder",
    icon: "megaphone",
    summary: "Build campaign URLs with utm_source, utm_medium, utm_campaign, term, content and id for Google Analytics 4.",
    intro:
      "UTM parameters tell analytics tools where visitors came from. Fill in source, medium and campaign (and optionally term, content and id) to generate a correctly encoded tracking link. Existing query parameters on your URL are preserved.",
    steps: ["Enter the landing page URL.", "Fill in the campaign fields.", "Copy the tagged URL."],
    notes: ["Never put personal data (emails, names) in UTM parameters.", "Don't use UTMs on internal links — they overwrite the original traffic source."],
    faq: [
      { q: "Are UTM values case-sensitive?", a: "Yes. Use consistent lowercase naming to avoid split reports." },
      { q: "Which fields are required?", a: "Source, medium and campaign are the minimum for reliable reporting." },
    ],
    keywords: ["utm builder", "utm link generator", "campaign url builder", "google analytics utm"],
    related: ["url-encoder", "url-decoder", "qr-code-generator", "text-to-slug"],
  }),
  gen({
    id: "robots-txt-generator",
    name: "Robots.txt Generator",
    icon: "bot",
    summary: "Generate a valid robots.txt with rules per user-agent, sitemap links and an option to block AI training crawlers.",
    intro:
      "robots.txt tells search engine crawlers which parts of your site they may crawl. Create rule groups for all bots or specific ones (Googlebot, Bingbot), add your sitemap URL and optionally block common AI training crawlers such as GPTBot and CCBot.",
    steps: ["Add rule groups with allowed and disallowed paths.", "Enter your sitemap URL.", "Download robots.txt and upload it to your site's root."],
    notes: ["robots.txt does not hide pages: blocked URLs can still appear in search results if linked elsewhere. Use noindex for that.", "Disallow: (empty) means allow everything."],
    faq: [
      { q: "Where must robots.txt be?", a: "At the root of the host, e.g. https://example.com/robots.txt." },
      { q: "Does Google respect Crawl-delay?", a: "No. Google ignores Crawl-delay; Bing and others honor it." },
    ],
    keywords: ["robots.txt generator", "create robots.txt", "block ai crawlers", "robots file"],
    related: ["meta-tag-generator", "open-graph-generator", "xml-formatter", "utm-link-builder"],
  }),
  gen({
    id: "meta-tag-generator",
    name: "Meta Tag Generator",
    icon: "tags",
    summary: "Generate SEO meta tags — title, description, robots, canonical, viewport — with length checks and a Google preview.",
    intro:
      "Good title and description tags improve how your pages look in search results and how often they're clicked. Write them here with live length guidance and an approximate Google snippet preview, then copy the HTML for your page's <head>.",
    steps: ["Write the title and description.", "Set canonical URL, robots and other options.", "Copy the generated tags."],
    notes: ["Google may rewrite titles and descriptions it considers less relevant to the query.", "The keywords meta tag is ignored by Google and Bing."],
    faq: [
      { q: "How long should a title be?", a: "Around 50–60 characters (Google truncates by pixel width, roughly 600 px)." },
      { q: "What does canonical do?", a: "It tells search engines which URL is the preferred version of duplicate or similar pages." },
    ],
    keywords: ["meta tag generator", "seo meta tags", "meta description generator", "title tag"],
    related: ["open-graph-generator", "robots-txt-generator", "character-counter", "favicon-generator"],
  }),
  gen({
    id: "open-graph-generator",
    name: "Open Graph Generator",
    icon: "globe",
    summary: "Create Open Graph and Twitter/X card tags with a live share preview for Facebook, LinkedIn, Slack and X.",
    intro:
      "When someone shares your link, platforms read Open Graph tags to build the preview card. Missing tags lead to random images and truncated titles. Fill in the title, description, URL and image to generate complete og: and twitter: tags and see an approximate preview.",
    steps: ["Enter title, description, URL and image URL.", "Choose type and Twitter card style.", "Copy the tags into your page's <head>."],
    notes: ["Use a 1200×630 px image under 5 MB with an absolute https:// URL.", "Platforms cache previews; use their debug tools (e.g. Facebook Sharing Debugger) to refresh after changes."],
    faq: [
      { q: "Do I need both Open Graph and Twitter tags?", a: "X falls back to Open Graph for most fields, but twitter:card is needed for the large image layout." },
      { q: "Why doesn't my image show?", a: "Common causes: relative URL, blocked by robots.txt, image too large, or a cached old preview." },
    ],
    keywords: ["open graph generator", "og tags", "twitter card generator", "social share preview"],
    related: ["meta-tag-generator", "favicon-generator", "robots-txt-generator", "image-resizer"],
  }),
];
