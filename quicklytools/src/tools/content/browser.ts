import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const br = (d: Def): ToolDefinition => ({ category: "browser", processing: "browser", ...d });

const READ_ONLY = "Information is read by your browser on this page only. It is not sent to or stored by our servers.";

export const browserTools: ToolDefinition[] = [
  br({
    id: "browser-information",
    name: "What Is My Browser",
    icon: "globe",
    popular: true,
    summary: "See your browser, version, operating system, screen, languages, time zone, hardware hints and privacy signals in one report.",
    intro:
      "Support teams often ask “which browser and version are you using?”. This page answers that and more: engine, operating system, screen and viewport size, pixel ratio, languages, time zone, CPU threads, memory hint, network estimate, Do Not Track and Global Privacy Control. Copy the report and paste it into a support ticket.\n\n" + READ_ONLY,
    steps: ["Open the page — the report fills in automatically.", "Click “Copy report” to share it with support."],
    notes: ["Browsers deliberately round or hide some values (memory, network) to reduce fingerprinting.", "Version numbers come from the user agent, which some browsers freeze."],
    faq: [
      { q: "Is my browser up to date?", a: "Compare the version with the latest release on the vendor's site; most browsers update automatically on restart." },
      { q: "Can websites see all of this?", a: "Yes, any site can read these values with JavaScript, which is why privacy browsers reduce their precision." },
    ],
    keywords: ["what is my browser", "browser version", "my browser info", "browser checker"],
    related: ["user-agent-checker", "screen-resolution-checker", "what-is-my-ip", "javascript-enabled-test"],
  }),
  br({
    id: "user-agent-checker",
    name: "User Agent Checker",
    icon: "monitor",
    summary: "See your user agent string and parse any user agent into browser, engine, operating system and device type.",
    intro:
      "The user agent string identifies your browser to every website. Developers use it to debug compatibility issues and analyse server logs. Your own UA is pre-filled; paste any other UA string — from logs or analytics — to break it down.",
    steps: ["Read your user agent, or paste another one.", "Review the parsed browser, engine, OS and device.", "Copy the string if needed."],
    notes: ["User agents can be spoofed and are increasingly frozen (User-Agent Reduction), so treat parsing as a hint.", READ_ONLY],
    faq: [
      { q: "Why does Chrome claim to be Safari and Mozilla?", a: "For historical compatibility: early sites sniffed for those names, so new browsers included them." },
      { q: "Why does Chrome report Windows 10 on Windows 11?", a: "Chrome froze the OS version in the UA string; Client Hints provide the real version." },
    ],
    keywords: ["user agent checker", "what is my user agent", "user agent parser", "ua string"],
    related: ["browser-information", "what-is-my-ip", "browser-language-checker", "device-pixel-ratio-checker"],
  }),
  br({
    id: "screen-resolution-checker",
    name: "Screen Resolution Checker",
    icon: "monitor-smartphone",
    summary: "Check your screen resolution, available area, approximate physical pixels, color depth and orientation.",
    intro:
      "Find out your display's resolution as websites see it (in CSS pixels), the space available without taskbars and docks, and an estimate of physical pixels based on your scaling factor. Useful for choosing wallpapers, testing responsive designs and reporting bugs.",
    steps: ["Open the page to see the values instantly."],
    notes: ["Operating-system scaling (125%, 150%, Retina) makes CSS pixels smaller than physical pixels.", "Multi-monitor setups report the screen the browser window is on."],
    faq: [
      { q: "My 4K monitor shows 2560×1440. Why?", a: "At 150% scaling, 3840×2160 physical pixels equal 2560×1440 CSS pixels." },
      { q: "What is color depth?", a: "Bits used per pixel; 24-bit is standard, 30-bit indicates HDR or wide-gamut capable displays." },
    ],
    keywords: ["screen resolution checker", "what is my screen resolution", "display resolution", "monitor resolution"],
    related: ["viewport-size-checker", "device-pixel-ratio-checker", "aspect-ratio-calculator", "browser-information"],
  }),
  br({
    id: "viewport-size-checker",
    name: "Viewport Size Checker",
    icon: "maximize",
    summary: "See your browser viewport width and height live as you resize, plus visual viewport, scrollbar width and breakpoint.",
    intro:
      "Responsive layouts depend on the viewport — the visible area of the page — not the screen size. Resize your window and watch the values update live, including the visual viewport (affected by pinch-zoom and on-screen keyboards), scrollbar width and the matching Tailwind CSS breakpoint.",
    steps: ["Open the page.", "Resize the window or rotate your device.", "Read the live values."],
    notes: ["On mobile, the viewport height changes as the address bar shows and hides; CSS units dvh/svh/lvh address this."],
    faq: [
      { q: "innerWidth vs clientWidth?", a: "innerWidth includes the vertical scrollbar; documentElement.clientWidth excludes it and matches media queries in most browsers." },
      { q: "Why is my phone's viewport 390 px?", a: "Phones report CSS pixels; a 1170 px-wide screen at 3× density equals 390 CSS px." },
    ],
    keywords: ["viewport size", "browser window size", "viewport checker", "responsive breakpoint"],
    related: ["screen-resolution-checker", "device-pixel-ratio-checker", "css-unit-converter", "px-to-rem-converter"],
  }),
  br({
    id: "device-pixel-ratio-checker",
    name: "Device Pixel Ratio Checker",
    icon: "smartphone",
    summary: "Check your device pixel ratio (DPR) — 1×, 2× Retina, 3× — and what image resolution you should serve.",
    intro:
      "The device pixel ratio says how many physical pixels make up one CSS pixel. High-DPR screens need higher-resolution images to look sharp. Check your value and the matching CSS media query for testing srcset and image-set() rules.",
    steps: ["Open the page to read your DPR.", "Zoom the browser to see how the value changes."],
    notes: ["Browser zoom changes the reported ratio; reset zoom for the native value."],
    faq: [
      { q: "What is Retina?", a: "Apple's name for displays with a DPR of 2 or more." },
      { q: "Should I always serve 3× images?", a: "No. Use srcset so each device downloads only the resolution it needs." },
    ],
    keywords: ["device pixel ratio", "dpr checker", "retina display test", "window.devicePixelRatio"],
    related: ["screen-resolution-checker", "viewport-size-checker", "image-resizer", "browser-information"],
  }),
  br({
    id: "browser-language-checker",
    name: "Browser Language Checker",
    icon: "languages",
    summary: "See your browser's preferred languages in order, the locale used for formatting, and the likely Accept-Language header.",
    intro:
      "Websites choose translations and formats from your language preferences. If a site shows the wrong language or date format, check what your browser actually sends: the ordered language list, the locale used for dates and numbers, and the Accept-Language header it implies.",
    steps: ["Open the page.", "Review the language list and formatting examples.", "Change languages in your browser settings if needed."],
    notes: ["The Accept-Language shown is reconstructed from navigator.languages and may differ slightly in q-values.", READ_ONLY],
    faq: [
      { q: "How do I change my browser language?", a: "Chrome: Settings → Languages. Firefox: Settings → General → Language. Safari uses macOS/iOS system languages." },
      { q: "Why are dates in a different format?", a: "Formatting follows the first locale; en-US uses month/day/year while en-GB uses day/month/year." },
    ],
    keywords: ["browser language", "accept-language", "my browser locale", "language checker"],
    related: ["timezone-detector", "browser-information", "user-agent-checker", "what-is-my-ip"],
  }),
  br({
    id: "timezone-detector",
    name: "Time Zone Detector",
    icon: "clock",
    summary: "Detect your device's time zone (IANA name), UTC offset and daylight saving status with a live clock.",
    intro:
      "See the time zone your device is set to — for example America/New_York — along with the current UTC offset and whether daylight saving time applies now. Handy for scheduling across regions and checking that your laptop switched zones after travel.",
    steps: ["Open the page to see your zone and offset."],
    notes: ["This reflects your device setting, not your physical location or IP address.", READ_ONLY],
    faq: [
      { q: "What is an IANA time zone?", a: "A standard name like Europe/London that encodes the full history of offsets and DST rules for a region." },
      { q: "Why is my offset UTC−4 instead of −5?", a: "You are probably in daylight saving time." },
    ],
    keywords: ["time zone detector", "what is my time zone", "utc offset", "current timezone"],
    related: ["unix-timestamp-converter", "timestamp-to-date-converter", "browser-language-checker", "what-is-my-ip"],
  }),
  br({
    id: "cookies-enabled-test",
    name: "Are Cookies Enabled? Test",
    icon: "cookie",
    summary: "Test whether your browser accepts first-party cookies by setting and reading a temporary test cookie.",
    intro:
      "Can't sign in or keep items in a shopping cart? Blocked cookies are a common cause. This test sets a short-lived cookie, reads it back and deletes it immediately, giving a definitive answer rather than relying on the browser's self-reported flag.",
    steps: ["Open the page to run the test.", "If cookies are blocked, allow them for the sites you trust."],
    notes: ["The test cookie lives for at most 60 seconds and is deleted immediately after reading.", "Third-party cookie support cannot be reliably tested from one site."],
    faq: [
      { q: "How do I enable cookies in Chrome?", a: "Settings → Privacy and security → Third-party cookies / Site settings → Cookies, and add exceptions for sites you trust." },
      { q: "Does this site track me with cookies?", a: "Tools don't need cookies. Ads, if shown, follow the consent choices you make in the cookie banner." },
    ],
    keywords: ["cookies enabled test", "are cookies enabled", "check cookies", "enable cookies"],
    related: ["local-storage-test", "javascript-enabled-test", "browser-information", "clipboard-test"],
  }),
  br({
    id: "local-storage-test",
    name: "Local Storage Test",
    icon: "database",
    summary: "Check whether localStorage, sessionStorage and IndexedDB work, and see storage quota and persistence status.",
    intro:
      "Web apps store settings and offline data in localStorage and IndexedDB. If an app forgets your settings, storage may be blocked (common in private windows or with strict privacy settings). This test writes and reads a temporary key and reports the available quota.",
    steps: ["Open the page to run the tests.", "Read the results and quota information."],
    notes: ["Test keys are removed immediately.", "Safari may delete script-written storage after 7 days without user interaction (ITP)."],
    faq: [
      { q: "How much can localStorage hold?", a: "About 5 MB per site in most browsers." },
      { q: "What is persistent storage?", a: "A permission that protects a site's data from automatic eviction when the disk is low." },
    ],
    keywords: ["local storage test", "localstorage enabled", "indexeddb test", "storage quota"],
    related: ["cookies-enabled-test", "javascript-enabled-test", "browser-information", "clipboard-test"],
  }),
  br({
    id: "javascript-enabled-test",
    name: "Is JavaScript Enabled? Test",
    icon: "code",
    summary: "Instantly check whether JavaScript is enabled and which modern features (WebAssembly, workers, ES modules) are supported.",
    intro:
      "If interactive sites don't work, JavaScript may be disabled by a setting, extension or corporate policy. This page shows a clear message either way and, when JavaScript runs, lists support for modern features many web apps need.",
    steps: ["Open the page — the answer appears immediately."],
    notes: ["When JavaScript is disabled, the page shows a server-rendered message using <noscript>."],
    faq: [
      { q: "How do I enable JavaScript?", a: "Chrome: Settings → Privacy and security → Site settings → JavaScript. Firefox: about:config → javascript.enabled. Safari: Settings → Security." },
      { q: "Is disabling JavaScript safer?", a: "It reduces attack surface but breaks most modern websites." },
    ],
    keywords: ["javascript enabled test", "is javascript enabled", "check javascript", "enable javascript"],
    related: ["cookies-enabled-test", "local-storage-test", "browser-information", "webgl-information"],
  }),
  br({
    id: "webgl-information",
    name: "WebGL Information",
    icon: "cpu",
    summary: "Check WebGL and WebGL 2 support, GPU renderer and vendor, max texture size and supported extensions.",
    intro:
      "Games, 3D viewers, maps and some AI demos rely on WebGL. See whether your browser supports WebGL 1 and 2, which GPU it uses, the maximum texture and viewport sizes and the full list of extensions — useful for debugging graphics issues.",
    steps: ["Open the page to see your WebGL details."],
    notes: ["Some browsers mask the GPU name for privacy.", "If WebGL is unavailable, enable hardware acceleration in browser settings and update graphics drivers."],
    faq: [
      { q: "Why does it say SwiftShader or llvmpipe?", a: "Rendering falls back to software, usually because hardware acceleration is disabled or the GPU is blocklisted." },
      { q: "WebGL or WebGPU?", a: "WebGPU is the newer, faster API; WebGL is supported almost everywhere." },
    ],
    keywords: ["webgl test", "webgl information", "gpu info browser", "webgl 2 support"],
    related: ["webgpu-support-checker", "browser-information", "javascript-enabled-test", "screen-resolution-checker"],
  }),
  br({
    id: "webgpu-support-checker",
    name: "WebGPU Support Checker",
    icon: "cpu",
    summary: "Check if your browser supports WebGPU and see adapter vendor, architecture, limits and features.",
    intro:
      "WebGPU brings modern GPU compute and graphics to the web, powering in-browser AI models and advanced 3D. This checker requests a GPU adapter and reports whether WebGPU is available plus key limits and optional features.",
    steps: ["Open the page to run the check.", "Review adapter details and features."],
    notes: ["Availability depends on browser version, operating system and GPU drivers; some platforms still require enabling a flag.", READ_ONLY],
    faq: [
      { q: "Which browsers support WebGPU?", a: "Recent Chrome and Edge on Windows, macOS, ChromeOS and Android; Safari 26+; Firefox on Windows from version 141, with other platforms following." },
      { q: "Why is the vendor “Hidden”?", a: "Browsers may withhold adapter details to limit fingerprinting." },
    ],
    keywords: ["webgpu support", "webgpu test", "check webgpu", "navigator.gpu"],
    related: ["webgl-information", "browser-information", "javascript-enabled-test", "device-pixel-ratio-checker"],
  }),
  br({
    id: "clipboard-test",
    name: "Clipboard Test",
    icon: "clipboard",
    summary: "Test copy and paste: check the async Clipboard API, permissions and secure-context support in your browser.",
    intro:
      "If copy buttons on websites don't work, the Clipboard API may be blocked by permissions, an insecure (HTTP) connection or browser limitations. Test writing to the clipboard, reading from it (with your permission) and a regular paste.",
    steps: ["Click “Test copy” and paste somewhere to confirm.", "Click “Test paste” and allow access if asked.", "Read the results."],
    notes: ["Firefox does not let web pages read clipboard text via the async API.", "Clipboard contents you read are shown only on this page."],
    faq: [
      { q: "Why does copy fail on HTTP sites?", a: "The async Clipboard API requires HTTPS (a secure context)." },
      { q: "Is reading the clipboard a privacy risk?", a: "That's why browsers ask permission or require a user gesture before allowing reads." },
    ],
    keywords: ["clipboard test", "copy paste not working", "clipboard api", "test clipboard"],
    related: ["keyboard-tester", "cookies-enabled-test", "browser-information", "javascript-enabled-test"],
  }),
  br({
    id: "keyboard-tester",
    name: "Keyboard Tester",
    icon: "keyboard",
    popular: true,
    summary: "Test every key on your keyboard online. Keys light up when pressed; check key rollover and get key codes.",
    intro:
      "Check a new or second-hand keyboard, find a stuck or dead key, or measure how many simultaneous keys your keyboard registers (key rollover, important for gaming). Each key turns green once it has worked, and the event log shows the key and code values developers need.",
    steps: ["Click on the page so it has focus.", "Press every key you want to test.", "Watch the on-screen keyboard and event log."],
    notes: ["Some keys are intercepted by the operating system or browser (Fn, Print Screen, Windows key combinations, Ctrl+W) and can't be detected by any website.", "The layout shown is US ANSI; other layouts still register by physical key code."],
    faq: [
      { q: "What is key rollover?", a: "The number of keys a keyboard can register simultaneously. Gaming keyboards often support 6KRO or NKRO." },
      { q: "What is ghosting?", a: "When pressing certain key combinations makes a key fail to register or a phantom key appear." },
    ],
    keywords: ["keyboard tester", "keyboard test online", "key checker", "test keyboard keys"],
    related: ["mouse-click-tester", "clipboard-test", "browser-information", "stopwatch"],
  }),
  br({
    id: "mouse-click-tester",
    name: "Mouse Click Tester",
    icon: "mouse",
    summary: "Test left, right, middle, back and forward mouse buttons, double clicks and scroll wheel — and detect double-click faults.",
    intro:
      "Worn mouse switches often “double click” when you click once. Click in the test area to count presses on every button and the scroll wheel. The tester flags two left-button presses arriving less than 80 ms apart, a typical symptom of a failing switch.",
    steps: ["Click each button inside the test area.", "Scroll up and down.", "Check the counters and the double-click fault indicator."],
    notes: ["Back and forward buttons may trigger browser navigation outside the test area.", "Some mice remap buttons in their driver software."],
    faq: [
      { q: "How fast can a human double-click?", a: "Intentional double clicks are usually 100–300 ms apart; gaps under 80 ms are suspicious." },
      { q: "Can I fix a double-clicking mouse?", a: "Sometimes by cleaning or replacing the switch; otherwise use the warranty." },
    ],
    keywords: ["mouse click test", "mouse tester", "double click test", "mouse button test"],
    related: ["keyboard-tester", "browser-information", "stopwatch", "clipboard-test"],
  }),
];
