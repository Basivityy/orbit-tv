import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const util = (d: Def): ToolDefinition => ({ category: "utilities", processing: "browser", ...d });

export const utilityTools: ToolDefinition[] = [
  util({
    id: "what-is-my-ip",
    name: "What Is My IP Address",
    icon: "network",
    popular: true,
    processing: "server",
    summary: "See your public IP address (IPv4 or IPv6) instantly. One lightweight request, nothing logged or stored.",
    intro:
      "Your public IP address is how websites see your connection. You might need it to whitelist access to a server, configure a firewall, troubleshoot a VPN or tell support where you're connecting from. This page asks our server a single tiny question — “which address did this request come from?” — and shows the answer.\n\nThe lookup is not logged, stored or linked to you, and it's rate-limited to protect the service.",
    steps: ["Open the page — your IP appears automatically.", "Copy it, or refresh after changing networks or VPNs."],
    notes: [
      "This tool needs a server request because a browser cannot see its own public address.",
      "With a VPN, proxy or iCloud Private Relay you will see the provider's address, not your home connection.",
      "Country is shown only when the site runs behind Cloudflare, which supplies it without an external lookup.",
    ],
    faq: [
      { q: "Is my IP address private information?", a: "It reveals your approximate location and internet provider, but not your name or street address on its own." },
      { q: "Why does my IP change?", a: "Most home and mobile connections get dynamic addresses that change periodically or when the router restarts." },
    ],
    keywords: ["what is my ip", "my ip address", "public ip", "ip lookup", "check ip"],
    related: ["ipv6-support-checker", "browser-information", "timezone-detector", "user-agent-checker"],
  }),
  util({
    id: "ipv6-support-checker",
    name: "IPv6 Support Checker",
    icon: "network",
    processing: "network",
    summary: "Test whether your internet connection supports IPv6 and see which IP version your browser prefers.",
    intro:
      "IPv6 is the newer internet protocol with vastly more addresses; many ISPs now provide it alongside IPv4. This test first checks which protocol reached our server, then — when configured — contacts an IPv6-only host name, which can only succeed if your connection has working IPv6.",
    steps: ["Open the page to run the test.", "Read the result and run it again after changing networks."],
    notes: [
      "A definitive test needs a host name with only an IPv6 (AAAA) DNS record. If the site operator hasn't set one up, the tool clearly says the result is inconclusive.",
      "Browsers prefer IPv6 when both work (Happy Eyeballs), but may fall back to IPv4 if IPv6 is slow.",
    ],
    faq: [
      { q: "Do I need IPv6?", a: "Not today for most sites, but it can improve performance on mobile networks and avoids carrier-grade NAT issues." },
      { q: "How do I enable IPv6?", a: "It usually must be supported by your ISP and enabled in your router settings." },
    ],
    keywords: ["ipv6 test", "ipv6 support", "do i have ipv6", "ipv6 checker"],
    related: ["what-is-my-ip", "browser-information", "timezone-detector", "local-storage-test"],
  }),
  util({
    id: "password-entropy-calculator",
    name: "Password Strength & Entropy Calculator",
    seoTitle: "Password Strength Checker & Entropy Calculator – Free",
    icon: "shield",
    summary: "Estimate password entropy in bits and offline crack time, and get warnings about patterns that make it weak.",
    intro:
      "How strong is a password really? This calculator estimates entropy from length and the character sets used, penalizes common sequences, repeated characters and well-known passwords, and estimates how long an offline attack at 10 billion guesses per second would take on average.\n\nThe password is analysed in your browser only — it is never transmitted.",
    steps: ["Type or paste a password.", "Read the entropy, strength rating and estimated crack time.", "Follow any warnings to improve it."],
    notes: ["Entropy estimates assume random characters. Human-chosen passwords are usually much weaker than the math suggests.", "Avoid typing passwords you actually use into any website; test similar examples instead."],
    faq: [
      { q: "How many bits is strong?", a: "60+ bits resists online attacks; 80+ bits is strong against offline cracking." },
      { q: "Is length or complexity more important?", a: "Length. Each extra character multiplies the search space." },
    ],
    keywords: ["password strength checker", "password entropy", "how strong is my password", "crack time"],
    related: ["password-generator", "passphrase-generator", "sha256-generator", "pdf-password-protect"],
  }),
  util({
    id: "css-unit-converter",
    name: "CSS Unit Converter",
    icon: "ruler",
    summary: "Convert between px, rem, em, pt, pc, in, cm, mm, vw, vh and % using your own font size, viewport and container context.",
    intro:
      "Translate design specs into CSS: points from print designers, pixels from Figma, rems for accessible typography and viewport units for fluid layouts. Set the context — root and parent font size, viewport size and container width — and every unit converts at once. Click a value to copy it.",
    steps: ["Enter a value and its unit.", "Adjust the context if needed.", "Click the converted value you want to copy."],
    notes: ["Absolute units use CSS definitions (1in = 96px), not physical measurements on your screen."],
    faq: [
      { q: "rem or em?", a: "rem is relative to the root font size and stays predictable; em is relative to the parent and compounds when nested." },
      { q: "How many pixels is 12pt?", a: "16px (12 × 96/72)." },
    ],
    keywords: ["css unit converter", "px to em", "pt to px", "vw to px", "css units"],
    related: ["px-to-rem-converter", "rem-to-px-converter", "viewport-size-checker", "css-border-radius-generator"],
  }),
  util({
    id: "px-to-rem-converter",
    name: "PX to REM Converter",
    icon: "ruler",
    popular: true,
    summary: "Convert pixels to rem for accessible, scalable CSS. Custom root font size and a handy reference table.",
    intro:
      "Using rem units lets text and spacing scale with the user's browser font settings, an important accessibility practice. Divide pixels by the root font size — 16px by default — or let this converter do it, with a quick reference table for common values.",
    steps: ["Enter the pixel value.", "Adjust the root font size if your site changes it.", "Copy the rem value."],
    notes: ["Avoid setting html { font-size: 62.5% } just for easy math; it can surprise third-party components."],
    faq: [
      { q: "What is 24px in rem?", a: "1.5rem at the default 16px root size." },
      { q: "Should media queries use rem?", a: "em or rem in media queries respond to user font-size preferences, which many teams prefer." },
    ],
    keywords: ["px to rem", "pixels to rem", "rem converter", "convert px to rem"],
    related: ["rem-to-px-converter", "css-unit-converter", "viewport-size-checker", "css-shadow-generator"],
  }),
  util({
    id: "rem-to-px-converter",
    name: "REM to PX Converter",
    icon: "ruler",
    summary: "Convert rem values to pixels for any root font size, with a reference table of common rem sizes.",
    intro:
      "Reading a design system or Tailwind config in rem and need to know the pixel size? Multiply by the root font size. Enter a rem value and your root size to get pixels instantly.",
    steps: ["Enter the rem value.", "Adjust the root font size if needed.", "Copy the pixel value."],
    notes: ["The actual pixel size depends on the user's browser settings when your CSS respects them."],
    faq: [
      { q: "What is 1.25rem in px?", a: "20px at a 16px root." },
      { q: "What is Tailwind's spacing unit?", a: "Tailwind's spacing scale step 1 equals 0.25rem (4px at the default root)." },
    ],
    keywords: ["rem to px", "rem to pixels", "convert rem", "rem px calculator"],
    related: ["px-to-rem-converter", "css-unit-converter", "aspect-ratio-calculator", "viewport-size-checker"],
  }),
  util({
    id: "rgb-to-hex-converter",
    name: "RGB to HEX Converter",
    icon: "palette",
    summary: "Convert RGB values (0–255) to HEX color codes, including uppercase and 3-digit shorthand when possible.",
    intro:
      "Turn red, green and blue values from design tools, CSS or code into a hex color for stylesheets and brand guides. The converter also offers the uppercase form and the short 3-digit form when the color allows it (e.g. #ff6633 → #f63).",
    steps: ["Enter red, green and blue (0–255).", "Copy the HEX value."],
    notes: ["Values must be whole numbers between 0 and 255."],
    faq: [
      { q: "What is rgb(255, 99, 71) in hex?", a: "#ff6347 (CSS “tomato”)." },
      { q: "Are #FF6347 and #ff6347 different?", a: "No, hex colors are case-insensitive." },
    ],
    keywords: ["rgb to hex", "convert rgb to hex", "rgb hex converter"],
    related: ["hex-to-rgb", "color-converter", "hex-to-hsl-converter", "rgb-to-hsl"],
  }),
  util({
    id: "hex-to-hsl-converter",
    name: "HEX to HSL Converter",
    icon: "palette",
    summary: "Convert HEX color codes to HSL values in classic and modern CSS syntax for easy shade adjustments.",
    intro:
      "HSL is the friendliest format for building color scales: keep hue and saturation, change lightness for tints and shades. Paste a hex code to get hsl() in both the comma syntax and the modern space-separated syntax.",
    steps: ["Enter a hex color.", "Copy the HSL value in your preferred syntax."],
    notes: ["Rounding to one decimal place can change the color by less than one RGB step."],
    faq: [
      { q: "What is #10B981 in HSL?", a: "Approximately hsl(160.1, 84.1%, 39.4%)." },
      { q: "Do browsers support the modern syntax?", a: "Yes, all current browsers support hsl(160 84% 39%)." },
    ],
    keywords: ["hex to hsl", "convert hex to hsl", "hsl color converter"],
    related: ["rgb-to-hsl", "color-converter", "hex-to-rgb", "gradient-generator"],
  }),
  util({
    id: "binary-to-text",
    name: "Binary to Text Converter",
    icon: "binary",
    summary: "Decode binary (8-bit groups) back to readable text using UTF-8, with clear errors for invalid input.",
    intro:
      "Translate binary code such as 01001000 01101001 back into text. Spaces and commas between bytes are optional; the input must contain whole 8-bit bytes that form valid UTF-8, otherwise you get an explanation of what's wrong.",
    steps: ["Paste the binary digits.", "Read the decoded text."],
    notes: ["Only 0 and 1 (plus separators) are allowed.", "Binary representing other encodings (e.g. UTF-16) won't decode correctly as UTF-8."],
    faq: [
      { q: "What does 01001000 01101001 mean?", a: "“Hi”." },
      { q: "Why must the length be a multiple of 8?", a: "Each byte has 8 bits; a partial byte cannot be decoded." },
    ],
    keywords: ["binary to text", "binary translator", "decode binary", "binary to ascii"],
    related: ["text-to-binary", "hex-to-text", "number-base-converter", "binary-calculator"],
  }),
  util({
    id: "text-to-hex",
    name: "Text to Hex Converter",
    icon: "hash",
    summary: "Convert text to hexadecimal UTF-8 bytes with custom separators, uppercase and 0x prefix options.",
    intro:
      "Developers inspect strings as hex to debug encodings, build byte arrays or escape data for protocols. Enter text to see its UTF-8 bytes in hexadecimal, formatted with spaces, colons, commas or no separator.",
    steps: ["Type or paste text.", "Choose formatting.", "Copy the hex output."],
    notes: ["Non-ASCII characters produce multiple bytes (é = c3 a9)."],
    faq: [
      { q: "What is “A” in hex?", a: "41." },
      { q: "How do I make a C byte array?", a: "Enable the 0x prefix and choose the comma separator." },
    ],
    keywords: ["text to hex", "string to hex", "ascii to hex", "hex encoder"],
    related: ["hex-to-text", "text-to-binary", "base64-encoder", "number-base-converter"],
  }),
  util({
    id: "hex-to-text",
    name: "Hex to Text Converter",
    icon: "hash",
    summary: "Decode hexadecimal bytes to readable UTF-8 text. Accepts spaces, colons, commas and 0x prefixes.",
    intro:
      "Turn hex dumps, packet captures and escaped byte strings back into readable text. Separators and 0x prefixes are stripped automatically; the result must be valid UTF-8 or you'll see a clear error.",
    steps: ["Paste the hex bytes.", "Read the decoded text."],
    notes: ["An odd number of hex digits is reported as an error because bytes need two digits."],
    faq: [
      { q: "What does 48656c6c6f mean?", a: "“Hello”." },
      { q: "Can it decode binary files?", a: "Only text. For arbitrary bytes, use the Base64 tools to save a file." },
    ],
    keywords: ["hex to text", "hex to ascii", "hex decoder", "hex to string"],
    related: ["text-to-hex", "binary-to-text", "base64-decoder", "number-base-converter"],
  }),
  util({
    id: "octal-converter",
    name: "Octal Converter",
    icon: "hash",
    summary: "Convert octal numbers to decimal, binary and hex — and decode Unix file permissions like 755 into rwx form.",
    intro:
      "Octal (base 8) is used mainly for Unix file permissions and some legacy systems. Convert any octal number to other bases, and for three- or four-digit values see the permission string — 755 becomes rwxr-xr-x.",
    steps: ["Enter a number and choose its base (octal by default).", "Read the conversions and permission string."],
    notes: ["Arbitrary-size integers are converted exactly."],
    faq: [
      { q: "What does chmod 644 mean?", a: "Owner read/write, group and others read-only (rw-r--r--)." },
      { q: "Why is octal used for permissions?", a: "Each octal digit maps exactly to three bits: read, write and execute." },
    ],
    keywords: ["octal converter", "octal to decimal", "chmod calculator", "unix permissions"],
    related: ["number-base-converter", "binary-calculator", "text-to-hex", "roman-numeral-converter"],
  }),
  util({
    id: "binary-calculator",
    name: "Binary Calculator",
    icon: "calculator",
    summary: "Add, subtract, multiply and divide binary numbers, plus AND, OR, XOR and bit shifts, with decimal and hex results.",
    intro:
      "Practice computer science homework or debug bitwise logic. Enter two binary numbers and choose an arithmetic or bitwise operation; the result is shown in binary, decimal, hex and octal, with the inputs converted to decimal so you can verify.",
    steps: ["Enter two binary numbers.", "Choose an operation.", "Read the result in several bases."],
    notes: ["Division is integer division.", "Negative values use a minus sign rather than two's complement representation."],
    faq: [
      { q: "What is 1011 + 110?", a: "10001 (11 + 6 = 17)." },
      { q: "What does XOR do?", a: "Each result bit is 1 when exactly one of the input bits is 1." },
    ],
    keywords: ["binary calculator", "binary addition", "bitwise calculator", "binary xor"],
    related: ["number-base-converter", "octal-converter", "binary-to-text", "data-storage-converter"],
  }),
  util({
    id: "number-base-converter",
    name: "Number Base Converter",
    icon: "hash",
    popular: true,
    summary: "Convert integers between binary, octal, decimal, hexadecimal and any base from 2 to 36 — with arbitrary precision.",
    intro:
      "Convert numbers between the bases used in computing and math. Input is accepted in any base from 2 to 36 (prefixes like 0x and 0b are understood) and converted exactly using big integers, so even 100-digit numbers stay precise.",
    steps: ["Enter a number and choose its base.", "Read binary, octal, decimal and hex results.", "Optionally convert to any other base."],
    notes: ["Only integers are supported, not fractions.", "Digits beyond 9 use letters a–z."],
    faq: [
      { q: "What is 255 in hex?", a: "FF." },
      { q: "What is base 36 used for?", a: "Compact alphanumeric IDs such as URL shorteners." },
    ],
    keywords: ["number base converter", "decimal to binary", "hex to decimal", "base converter"],
    related: ["binary-calculator", "octal-converter", "roman-numeral-converter", "text-to-binary"],
  }),
  util({
    id: "roman-numeral-converter",
    name: "Roman Numeral Converter",
    icon: "superscript",
    summary: "Convert numbers (1–3999) to Roman numerals and back, with validation of non-standard numerals.",
    intro:
      "Convert years for inscriptions and tattoos, chapter numbers or movie copyright dates. The converter follows standard subtractive notation (IV, IX, XL, XC, CD, CM) and flags non-standard input such as IIII or VX, suggesting the correct form.",
    steps: ["Choose the direction.", "Enter a number or numeral.", "Copy the result."],
    notes: ["Standard Roman numerals have no zero and go up to 3999 (MMMCMXCIX)."],
    faq: [
      { q: "What is 2026 in Roman numerals?", a: "MMXXVI." },
      { q: "Why do some clocks use IIII?", a: "A traditional design choice for visual balance; strictly, 4 is IV." },
    ],
    keywords: ["roman numeral converter", "roman numerals", "number to roman", "roman to number"],
    related: ["number-base-converter", "date-difference-calculator", "age-calculator", "octal-converter"],
  }),
  util({
    id: "countdown-timer",
    name: "Countdown Timer",
    icon: "timer",
    popular: true,
    summary: "Simple online countdown timer with presets, pause/resume, alarm sound, tab-title display and notifications.",
    intro:
      "Time cooking, workouts, exams, presentations or breaks. Set hours, minutes and seconds or tap a preset; the remaining time shows in the tab title so you can see it while working elsewhere, and a tone plays when time's up (plus a notification if you allow it).\n\nThe timer calculates the end time from the clock, so it stays accurate even if the browser throttles background tabs.",
    steps: ["Set the time or choose a preset.", "Press Start (pause and resume any time).", "Hear the alarm when it reaches zero."],
    notes: ["Keep the tab open; closing it stops the timer.", "Some browsers block sound until you've interacted with the page — clicking Start counts."],
    faq: [
      { q: "Will it work if my computer sleeps?", a: "The display catches up on wake, but the alarm can't play while the device sleeps." },
      { q: "Can I run several timers?", a: "Open the tool in multiple tabs." },
    ],
    keywords: ["countdown timer", "online timer", "timer with alarm", "5 minute timer"],
    related: ["stopwatch", "pomodoro-timer", "time-duration-calculator", "reading-time-calculator"],
  }),
  util({
    id: "stopwatch",
    name: "Online Stopwatch",
    icon: "watch",
    summary: "Accurate online stopwatch with centisecond display, lap times and pause/resume. Works on phone and desktop.",
    intro:
      "Measure runs, speeches, experiments or anything else with a precise stopwatch. Record laps to see split times and cumulative totals. Timing is based on the system clock, not on counting ticks, so it doesn't drift.",
    steps: ["Press Start.", "Press Lap to record splits.", "Stop and Reset when done."],
    notes: ["Display precision is 1/100 second; reaction time limits real-world accuracy."],
    faq: [
      { q: "Does it keep running in the background?", a: "Yes. Elapsed time is computed from timestamps, so switching tabs doesn't affect the result." },
      { q: "Can I export laps?", a: "Select and copy the lap table into a spreadsheet." },
    ],
    keywords: ["online stopwatch", "stopwatch", "lap timer", "stopwatch with laps"],
    related: ["countdown-timer", "pomodoro-timer", "time-duration-calculator", "keyboard-tester"],
  }),
  util({
    id: "pomodoro-timer",
    name: "Pomodoro Timer",
    icon: "alarm-clock",
    summary: "Focus with the Pomodoro Technique: 25-minute work sessions, short and long breaks, automatic cycling and alerts.",
    intro:
      "The Pomodoro Technique alternates focused work blocks with short breaks, plus a longer break after every few sessions. This timer cycles automatically, plays a tone and (optionally) shows a notification at each switch, and counts completed sessions. Customize all durations to suit your rhythm.",
    steps: ["Adjust durations in Settings if you like (25/5/15 by default).", "Press Start and work until the tone.", "Take the break; the next session starts automatically."],
    notes: ["Notifications require your permission.", "Keep the tab open; closing it resets the timer."],
    faq: [
      { q: "Why 25 minutes?", a: "Francesco Cirillo, who created the technique, found it a sustainable unit of focus; many people prefer 50/10." },
      { q: "What should I do in breaks?", a: "Step away from the screen: stretch, drink water, look into the distance." },
    ],
    keywords: ["pomodoro timer", "focus timer", "pomodoro technique", "study timer"],
    related: ["countdown-timer", "stopwatch", "reading-time-calculator", "time-duration-calculator"],
  }),
  util({
    id: "date-to-timestamp-converter",
    name: "Date to Unix Timestamp Converter",
    icon: "calendar-clock",
    summary: "Convert a date and time (local or UTC) into a Unix timestamp in seconds and milliseconds, plus ISO 8601.",
    intro:
      "Need an epoch value for an API call, a database query or a cron test? Pick a date and time, decide whether it's in your local time zone or UTC, and get the timestamp in seconds and milliseconds along with the ISO 8601 string.",
    steps: ["Choose the date and time.", "Select local time or UTC.", "Copy the timestamp."],
    notes: ["Local time conversions use your device's time zone rules, including daylight saving."],
    faq: [
      { q: "What is the timestamp for 1 Jan 2026 UTC?", a: "1767225600 seconds." },
      { q: "Seconds or milliseconds?", a: "Most Unix tools and databases use seconds; JavaScript and Java use milliseconds." },
    ],
    keywords: ["date to timestamp", "date to epoch", "convert date to unix time"],
    related: ["timestamp-to-date-converter", "unix-timestamp-converter", "date-difference-calculator", "timezone-detector"],
  }),
  util({
    id: "timestamp-to-date-converter",
    name: "Timestamp to Date Converter",
    icon: "calendar-days",
    summary: "Convert Unix timestamps (seconds, ms, µs) to human-readable dates in any major time zone, with ISO 8601 output.",
    intro:
      "Read epoch timestamps from logs, JWTs and databases as real dates. The unit is detected automatically, and you can display the date in UTC, your own zone or major zones such as New York, Los Angeles, London, Berlin and Tokyo.",
    steps: ["Paste the timestamp.", "Choose a time zone.", "Read or copy the date."],
    notes: ["Negative timestamps represent dates before 1970."],
    faq: [
      { q: "How do I know if a timestamp is in milliseconds?", a: "Current timestamps in seconds have 10 digits; in milliseconds, 13 digits." },
      { q: "Does it handle daylight saving?", a: "Yes, using the IANA time zone database built into your browser." },
    ],
    keywords: ["timestamp to date", "epoch to date", "convert unix timestamp", "unix time to date"],
    related: ["date-to-timestamp-converter", "unix-timestamp-converter", "jwt-decoder", "timezone-detector"],
  }),
];
