import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const dev = (d: Def): ToolDefinition => ({ category: "developer", processing: "browser", ...d });

const LOCAL = "Your data is processed in the browser and never sent to a server, so it is safe to paste payloads that contain tokens or personal data.";

export const developerTools: ToolDefinition[] = [
  dev({
    id: "json-formatter",
    name: "JSON Formatter",
    icon: "braces",
    popular: true,
    summary: "Format and beautify JSON with 2-space, 4-space or tab indentation and optional key sorting. Shows exact error locations.",
    intro:
      "Turn minified API responses and config files into readable, indented JSON. If the input is invalid, you get the line and column of the problem instead of a vague failure. Optional key sorting makes two JSON documents easier to compare.\n\n" + LOCAL,
    steps: ["Paste JSON or open a .json file.", "Pick indentation and whether to sort keys.", "Copy or download the formatted JSON."],
    notes: ["Numbers larger than 2^53 lose precision when parsed by JavaScript; keep big IDs as strings.", "Comments and trailing commas are not valid JSON and will be reported as errors."],
    faq: [
      { q: "What's the difference between formatting and validating?", a: "Formatting re-indents valid JSON. The JSON Validator focuses on finding and pinpointing errors." },
      { q: "Can it format JSON Lines (NDJSON)?", a: "Not directly — each line is a separate document. Format lines one at a time." },
    ],
    keywords: ["json formatter", "json beautifier", "pretty print json", "format json online"],
    related: ["json-validator", "json-minifier", "json-to-yaml", "json-to-csv"],
  }),
  dev({
    id: "json-validator",
    name: "JSON Validator",
    icon: "file-json",
    summary: "Validate JSON and pinpoint syntax errors with line, column and a highlighted code excerpt.",
    intro:
      "Find out instantly whether JSON is valid and, if not, exactly where it breaks. The validator shows the failing line with surrounding context so typical mistakes — trailing commas, single quotes, unquoted keys, missing brackets — are easy to fix.\n\n" + LOCAL,
    steps: ["Paste the JSON.", "Read the result: a green summary or a red error with location.", "Fix the highlighted line and re-check."],
    notes: ["Validation follows the strict JSON standard (RFC 8259). JSON5 or JavaScript object syntax is rejected.", "This checks syntax, not a JSON Schema."],
    faq: [
      { q: "Why are single quotes invalid?", a: "JSON requires double quotes for strings and keys." },
      { q: "Is an empty object valid?", a: "Yes, {} and [] are valid JSON, as are bare values like 42 or \"text\"." },
    ],
    keywords: ["json validator", "validate json", "json lint", "check json syntax"],
    related: ["json-formatter", "json-minifier", "yaml-to-json", "jwt-decoder"],
  }),
  dev({
    id: "json-minifier",
    name: "JSON Minifier",
    icon: "minimize",
    summary: "Minify JSON by removing whitespace and line breaks. See the exact byte savings. Validates while minifying.",
    intro:
      "Compact JSON for network payloads, environment variables or embedding in code. Whitespace and newlines are removed while values stay exactly the same; the tool reports how many bytes you saved.\n\n" + LOCAL,
    steps: ["Paste formatted JSON.", "Copy the minified single-line output.", "Check the size reduction shown under the output."],
    notes: ["HTTP compression (gzip/brotli) already shrinks whitespace well; minifying matters most for storage and size-limited fields."],
    faq: [
      { q: "Does minifying change the data?", a: "No. Parsing and re-serializing preserves every value; only formatting is removed." },
      { q: "Can I reverse it?", a: "Yes, use the JSON Formatter." },
    ],
    keywords: ["json minifier", "minify json", "compress json", "json one line"],
    related: ["json-formatter", "css-minifier", "javascript-minifier", "json-validator"],
  }),
  dev({
    id: "json-to-csv",
    name: "JSON to CSV Converter",
    icon: "table",
    popular: true,
    summary: "Convert JSON arrays to CSV for Excel and Google Sheets. Flattens nested objects into dot-notation columns.",
    intro:
      "Turn API data and exports into a spreadsheet. Every object becomes a row and every key becomes a column; nested objects are flattened into columns like address.city, and arrays are kept as JSON text so nothing is lost. Quotes, commas and line breaks inside values are escaped correctly.\n\n" + LOCAL,
    steps: ["Paste a JSON array of objects (or open a file).", "Choose the delimiter (semicolon works better for European Excel).", "Download the CSV and open it in your spreadsheet app."],
    notes: ["Columns appear in the order keys are first seen.", "Objects with different keys are merged into one header; missing values are left empty."],
    faq: [
      { q: "Excel shows everything in one column. Why?", a: "Your Excel locale probably expects semicolons. Choose “Semicolon” as delimiter." },
      { q: "Can it convert a single object?", a: "Yes, it becomes a one-row CSV." },
    ],
    keywords: ["json to csv", "convert json to excel", "json to spreadsheet", "flatten json"],
    related: ["csv-to-json", "csv-duplicate-remover", "json-formatter", "json-to-yaml"],
  }),
  dev({
    id: "csv-to-json",
    name: "CSV to JSON Converter",
    icon: "file-json",
    summary: "Convert CSV or TSV to JSON with header detection, automatic number/boolean typing and delimiter auto-detection.",
    intro:
      "Convert spreadsheet exports into JSON ready for APIs, fixtures or JavaScript. The parser (Papa Parse) handles quoted fields, embedded commas and line breaks, and detects whether the file uses commas, semicolons, tabs or pipes.\n\n" + LOCAL,
    steps: ["Paste CSV or open a .csv/.tsv file.", "Set header and type-conversion options.", "Copy or download the JSON."],
    notes: ["With type conversion on, values like 007 become the number 7. Turn it off to keep leading zeros (ZIP codes, IDs).", "Empty lines are skipped."],
    faq: [
      { q: "What if my CSV has no header row?", a: "Untick “First row is header” to get an array of arrays." },
      { q: "Does it support Excel files?", a: "Save the sheet as CSV first; .xlsx is not read directly." },
    ],
    keywords: ["csv to json", "convert csv", "tsv to json", "spreadsheet to json"],
    related: ["json-to-csv", "csv-duplicate-remover", "json-formatter", "yaml-to-json"],
  }),
  dev({
    id: "csv-duplicate-remover",
    name: "CSV Duplicate Remover",
    icon: "copy-minus",
    summary: "Remove duplicate rows from CSV files, comparing whole rows or only selected columns such as email.",
    intro:
      "Clean mailing lists, CRM exports and survey data. Remove rows that are exact duplicates, or deduplicate by specific columns — for example keep only the first row for each email address even if the names differ. Case-insensitive matching treats ADA@EXAMPLE.COM and ada@example.com as the same.\n\n" + LOCAL,
    steps: ["Paste CSV data or open a file.", "Optionally list the columns to compare (names or numbers).", "Download the cleaned CSV."],
    notes: ["The first occurrence of each duplicate is kept, preserving order.", "Column names are matched case-insensitively."],
    faq: [
      { q: "How do I dedupe by two columns?", a: "Enter both, separated by a comma, e.g. first_name,last_name." },
      { q: "Is the header row affected?", a: "No, the header is kept when “First row is header” is ticked." },
    ],
    keywords: ["csv duplicate remover", "remove duplicate rows csv", "dedupe csv", "csv cleaner"],
    related: ["remove-duplicate-lines", "csv-to-json", "json-to-csv", "sort-lines"],
  }),
  dev({
    id: "xml-formatter",
    name: "XML Formatter",
    icon: "code",
    summary: "Pretty-print XML, RSS, SVG and sitemaps with proper indentation and tag-mismatch detection.",
    intro:
      "Make XML readable — SOAP responses, RSS feeds, sitemaps, SVG and config files. The formatter indents nested elements, keeps short text elements on one line, preserves comments and CDATA, and reports unclosed or mismatched tags with their names.\n\n" + LOCAL,
    steps: ["Paste XML or open a file.", "Choose the indentation.", "Copy or download the formatted XML."],
    notes: ["Whitespace inside text nodes is trimmed; avoid formatting XML where whitespace is significant (e.g. some document formats).", "DTD and namespace declarations are preserved as written."],
    faq: [
      { q: "Does it validate against a schema?", a: "No, it checks tag structure only, not XSD or DTD rules." },
      { q: "Can I format an SVG?", a: "Yes, SVG is XML." },
    ],
    keywords: ["xml formatter", "xml beautifier", "pretty print xml", "format xml online"],
    related: ["html-formatter", "json-formatter", "robots-txt-generator", "json-to-yaml"],
  }),
  dev({
    id: "html-formatter",
    name: "HTML Formatter",
    icon: "file-code",
    summary: "Beautify messy or minified HTML with consistent indentation, including embedded CSS and JavaScript.",
    intro:
      "Clean up HTML copied from a CMS, email builder or minified page. Tags are indented by nesting level, and inline <style> and <script> blocks are formatted too. Powered by the widely used js-beautify library.\n\n" + LOCAL,
    steps: ["Paste HTML or open a file.", "Choose indentation and optional line wrapping.", "Copy or download the formatted HTML."],
    notes: ["Formatting changes whitespace only. In rare cases whitespace between inline elements affects rendering; check the result visually.", "Invalid HTML is formatted as best as possible but not corrected."],
    faq: [
      { q: "Does it minify HTML too?", a: "No. Use a build tool for HTML minification; this tool focuses on readability." },
      { q: "Is the HTML rendered or executed?", a: "No, it is processed as text only." },
    ],
    keywords: ["html formatter", "html beautifier", "format html", "indent html"],
    related: ["xml-formatter", "css-minifier", "html-entity-encoder", "markdown-preview"],
  }),
  dev({
    id: "css-minifier",
    name: "CSS Minifier",
    icon: "minimize",
    summary: "Minify CSS with structural optimizations (merging rules, shortening colors) using CSSO. Shows size savings.",
    intro:
      "Shrink stylesheets for faster page loads. Beyond removing whitespace and comments, the CSSO optimizer shortens values (#ffffff → #fff, 0px → 0), merges duplicate selectors and drops redundant declarations. Comments starting with /*! (licences) are kept.\n\n" + LOCAL,
    steps: ["Paste CSS or open a .css file.", "Choose whether to allow advanced restructuring.", "Copy or download the minified CSS."],
    notes: ["If a page relies on specific rule order across files, test after enabling advanced optimizations.", "Syntax errors are reported instead of producing broken output."],
    faq: [
      { q: "How much will it save?", a: "Typically 15–30% for hand-written CSS before gzip." },
      { q: "Do I still need gzip/brotli?", a: "Yes. Minification and compression complement each other." },
    ],
    keywords: ["css minifier", "minify css", "compress css", "css optimizer"],
    related: ["javascript-minifier", "json-minifier", "html-formatter", "css-unit-converter"],
  }),
  dev({
    id: "javascript-minifier",
    name: "JavaScript Minifier",
    icon: "file-code",
    summary: "Minify JavaScript with Terser: compress code, shorten variable names and optionally drop console calls.",
    intro:
      "Reduce JavaScript size for production with Terser, the minifier used by most modern bundlers. Choose whether to mangle local variable names and remove console.* statements; syntax errors are reported with line and column.\n\n" + LOCAL,
    steps: ["Paste JavaScript or open a .js file.", "Set mangling and console options.", "Click Minify and copy or download the result."],
    notes: ["Terser loads on demand (~300 KB), so the first run takes a moment.", "Licence comments starting with /*! are preserved.", "TypeScript and JSX must be compiled to JavaScript first."],
    faq: [
      { q: "Is mangling safe?", a: "Terser only renames local variables, never globals or object properties, so standard code keeps working." },
      { q: "Should I minify code that's already bundled?", a: "Most bundlers already minify for production builds; use this for standalone scripts and snippets." },
    ],
    keywords: ["javascript minifier", "minify js", "terser online", "compress javascript", "uglify js"],
    related: ["css-minifier", "json-minifier", "html-formatter", "regex-tester"],
  }),
  dev({
    id: "base64-encoder",
    name: "Base64 Encoder",
    icon: "binary",
    popular: true,
    summary: "Encode text (UTF-8) or any file to Base64, with URL-safe and MIME line-wrapping options and data-URI output.",
    intro:
      "Base64 represents binary data as plain ASCII text so it can travel through JSON, email, URLs and HTTP headers. Encode text — with full Unicode support — or any file up to 25 MB, optionally as a data URI.\n\n" + LOCAL,
    steps: ["Choose Text or File.", "Enter text or drop a file.", "Copy the Base64 output."],
    notes: ["Base64 is an encoding, not encryption: anyone can decode it.", "Output is about 33% larger than the input."],
    faq: [
      { q: "What is URL-safe Base64?", a: "A variant that uses - and _ instead of + and / and omits padding, so it can appear in URLs and JWTs." },
      { q: "Why does my output differ from another tool?", a: "Most often because of text encoding. This tool encodes text as UTF-8, the web standard." },
    ],
    keywords: ["base64 encode", "base64 encoder", "text to base64", "file to base64"],
    related: ["base64-decoder", "image-to-base64", "url-encoder", "jwt-decoder"],
  }),
  dev({
    id: "base64-decoder",
    name: "Base64 Decoder",
    icon: "binary",
    summary: "Decode Base64 or Base64URL to text or download it as a file. Accepts data URIs and tolerates missing padding.",
    intro:
      "Decode Base64 strings from APIs, emails, JWTs and data URIs. If the result is readable UTF-8 text it is shown immediately; if it is binary (an image, PDF or archive) you can download it as a file.\n\n" + LOCAL,
    steps: ["Paste Base64 text or a data URI.", "Read the decoded text, or download the file.", "Use Copy to grab the result."],
    notes: ["Whitespace, line breaks and missing = padding are tolerated; invalid characters are reported.", "The file type for downloads is taken from the data URI when present."],
    faq: [
      { q: "Can it decode Base64URL?", a: "Yes, - and _ are converted automatically." },
      { q: "Why do I see “binary data”?", a: "The decoded bytes are not valid UTF-8 text, so they are probably a file." },
    ],
    keywords: ["base64 decode", "base64 decoder", "decode base64 to text", "base64 to file"],
    related: ["base64-encoder", "jwt-decoder", "url-decoder", "html-entity-decoder"],
  }),
  dev({
    id: "url-encoder",
    name: "URL Encoder",
    icon: "link",
    summary: "Percent-encode text for URLs and query strings: component, full-URL or form (+ for spaces) modes.",
    intro:
      "Special characters such as spaces, &, ?, # and non-ASCII letters must be percent-encoded inside URLs. Choose component encoding for individual query values, full-URL encoding to keep the URL structure intact, or form encoding used by HTML forms.",
    steps: ["Choose the encoding mode.", "Paste the text or URL.", "Copy the encoded output."],
    notes: ["Encoding an already-encoded string again double-encodes it (% becomes %25)."],
    faq: [
      { q: "encodeURI vs encodeURIComponent?", a: "encodeURI keeps characters like / ? & = that structure a URL; encodeURIComponent encodes them, which is right for a single parameter value." },
      { q: "How are spaces encoded?", a: "As %20, or as + in form mode." },
    ],
    keywords: ["url encode", "url encoder", "percent encoding", "encode query string"],
    related: ["url-decoder", "utm-link-builder", "base64-encoder", "html-entity-encoder"],
  }),
  dev({
    id: "url-decoder",
    name: "URL Decoder",
    icon: "link",
    summary: "Decode percent-encoded URLs and query strings and list every query parameter in a table.",
    intro:
      "Make encoded links readable again — tracking URLs, redirect parameters and API calls. After decoding, the tool parses the URL and shows each query parameter and value separately, which makes long marketing links easy to audit.",
    steps: ["Paste the encoded URL or text.", "Read the decoded output.", "Review the parameter table for full URLs."],
    notes: ["Malformed sequences such as a lone % sign are reported rather than guessed."],
    faq: [
      { q: "Why decode twice?", a: "Some links are double-encoded; run “Reuse” on the output to decode again." },
      { q: "Is + a space?", a: "In form-encoded query strings yes; untick the option for paths where + is literal." },
    ],
    keywords: ["url decode", "url decoder", "decode url online", "query string parser"],
    related: ["url-encoder", "utm-link-builder", "base64-decoder", "jwt-decoder"],
  }),
  dev({
    id: "jwt-decoder",
    name: "JWT Decoder",
    icon: "key",
    popular: true,
    summary: "Decode JSON Web Tokens to read header and payload claims, with human-readable dates and an expiry check.",
    intro:
      "Inspect JWTs from OAuth, OpenID Connect and API authentication. The header and payload are decoded and pretty-printed; registered claims such as exp, iat and nbf are converted to readable dates, and you see at a glance whether the token has expired.\n\nTokens are decoded locally — never paste production tokens into tools that send them to a server.",
    steps: ["Paste the token (with or without “Bearer ”).", "Read the header, payload and claims.", "Check the expiry status."],
    notes: ["Decoding does not verify the signature. Anyone can create a token with any payload; only signature verification with the correct key proves authenticity.", "Encrypted tokens (JWE, five parts) cannot be decoded without the key."],
    faq: [
      { q: "Is the payload of a JWT secret?", a: "No. A signed JWT is only Base64URL-encoded, so never put secrets in it." },
      { q: "Why is my token “not valid Base64URL”?", a: "It may be truncated, contain extra characters, or be an opaque (non-JWT) token." },
    ],
    keywords: ["jwt decoder", "decode jwt", "json web token", "jwt parser"],
    related: ["base64-decoder", "json-formatter", "unix-timestamp-converter", "sha256-generator"],
  }),
  dev({
    id: "uuid-generator",
    name: "UUID Generator",
    icon: "fingerprint",
    summary: "Generate random UUID v4 or time-ordered UUID v7 identifiers in bulk, with uppercase and no-hyphen options.",
    intro:
      "Create universally unique identifiers for database keys, test fixtures and request IDs. Version 4 UUIDs are fully random; version 7 (RFC 9562) starts with a timestamp, so values sort by creation time and index efficiently in databases.\n\nAll values come from the browser's cryptographically secure random generator.",
    steps: ["Choose v4 or v7 and how many.", "Set formatting options.", "Copy or download the list."],
    notes: ["The chance of a v4 collision is negligible: you'd need about 2.7 quintillion UUIDs for a 50% chance of one duplicate."],
    faq: [
      { q: "UUID or GUID?", a: "They are the same thing; GUID is Microsoft's name." },
      { q: "When should I use v7?", a: "For primary keys in databases, where time-ordered IDs reduce index fragmentation." },
    ],
    keywords: ["uuid generator", "guid generator", "uuid v4", "uuid v7", "random uuid"],
    related: ["password-generator", "random-number-generator", "sha256-generator", "md5-generator"],
  }),
  dev({
    id: "sha256-generator",
    name: "SHA-256 Hash Generator",
    icon: "hash",
    summary: "Generate SHA-256 hashes of text or files (up to 500 MB) and HMAC-SHA256 signatures. Verify file checksums.",
    intro:
      "SHA-256 produces a 64-character fingerprint of any data; changing a single bit changes the whole hash. Use it to verify downloads against published checksums, create content fingerprints or compute HMAC signatures for webhooks and APIs.\n\nHashing uses the browser's native Web Crypto API and runs locally.",
    steps: ["Choose Text or File.", "Enter text (and an HMAC key if needed) or drop a file.", "Copy the hash or paste an expected checksum to compare."],
    notes: ["Plain SHA-256 is not suitable for storing passwords — use a slow password hash like Argon2 or bcrypt.", "File hashing reads the whole file into memory; the limit is 500 MB."],
    faq: [
      { q: "Can a SHA-256 hash be reversed?", a: "No. It is a one-way function. Short or common inputs can, however, be guessed by trying candidates." },
      { q: "What is HMAC?", a: "A keyed hash that proves a message came from someone who knows the secret key." },
    ],
    keywords: ["sha256 generator", "sha256 hash", "hmac sha256", "file checksum", "sha256 online"],
    related: ["md5-generator", "uuid-generator", "password-generator", "base64-encoder"],
  }),
  dev({
    id: "md5-generator",
    name: "MD5 Hash Generator",
    icon: "hash",
    summary: "Compute MD5 hashes of text or large files (streamed, up to 2 GB) and compare against expected checksums.",
    intro:
      "MD5 is still widely used for non-security checksums: verifying file transfers, ETags, cache keys and legacy systems. Files are hashed in 4 MB chunks with a progress bar, so even multi-gigabyte files work without loading everything into memory.",
    steps: ["Choose Text or File.", "Type text or drop a file.", "Copy the 32-character hash or compare it with an expected value."],
    notes: ["MD5 is cryptographically broken: collisions can be created deliberately. Never use it for passwords or signatures."],
    faq: [
      { q: "Why is MD5 still used?", a: "It is fast and adequate for detecting accidental corruption, where no attacker is involved." },
      { q: "Is the hash case-sensitive?", a: "Hex hashes are case-insensitive; the comparison ignores case." },
    ],
    keywords: ["md5 generator", "md5 hash", "md5 checksum", "md5 file hash"],
    related: ["sha256-generator", "uuid-generator", "base64-encoder", "password-entropy-calculator"],
  }),
  dev({
    id: "regex-tester",
    name: "Regex Tester",
    icon: "regex",
    popular: true,
    summary: "Test JavaScript regular expressions live with match highlighting, capture groups, named groups and flags.",
    intro:
      "Build and debug regular expressions against real text. Matches are highlighted as you type, and a table lists every match with its position and capture groups (including named groups). A quick reference reminds you of common syntax.\n\nThe tool uses your browser's JavaScript regex engine, so behaviour matches what your code will do in Node.js and browsers.",
    steps: ["Enter the pattern (without slashes) and flags.", "Paste test text.", "Inspect highlighted matches and groups."],
    notes: ["Results are limited to the first 1,000 matches for responsiveness.", "Other engines (PCRE, Python, Java) differ in features such as lookbehind and possessive quantifiers."],
    faq: [
      { q: "Why does my pattern match only once?", a: "Add the g flag to find all matches." },
      { q: "How do I match a literal dot?", a: "Escape it: \\." },
    ],
    keywords: ["regex tester", "regular expression tester", "regex online", "javascript regex"],
    related: ["find-and-replace", "text-compare", "javascript-minifier", "cron-expression-explainer"],
  }),
  dev({
    id: "unix-timestamp-converter",
    name: "Unix Timestamp Converter",
    icon: "calendar-clock",
    popular: true,
    summary: "Convert Unix epoch timestamps to dates and back. Auto-detects seconds, milliseconds and microseconds. Live clock.",
    intro:
      "Unix time counts seconds since 1 January 1970 UTC and is used by databases, logs and APIs. Paste any timestamp — the converter detects whether it is in seconds, milliseconds or microseconds — and see it in UTC, your local time, RFC 2822 and relative form. Convert dates back into timestamps in the second panel.",
    steps: ["Paste a timestamp to see the date.", "Or pick a date and time to get the timestamp.", "Copy the value you need."],
    notes: ["JavaScript uses milliseconds; most Unix tools use seconds.", "Unix time ignores leap seconds."],
    faq: [
      { q: "What is the year 2038 problem?", a: "Signed 32-bit timestamps overflow on 19 January 2038. Modern 64-bit systems are not affected." },
      { q: "Is Unix time the same in every time zone?", a: "Yes. It is always UTC-based; only its display changes by time zone." },
    ],
    keywords: ["unix timestamp converter", "epoch converter", "timestamp to date", "epoch time"],
    related: ["timestamp-to-date-converter", "date-to-timestamp-converter", "cron-expression-explainer", "timezone-detector"],
  }),
  dev({
    id: "cron-expression-explainer",
    name: "Cron Expression Explainer",
    icon: "clock",
    summary: "Translate cron expressions into plain English and preview the next run times. Supports ranges, steps and names.",
    intro:
      "Cron syntax is compact but easy to misread. Paste an expression like */15 9-17 * * 1-5 and get a plain-English description (“Every 15 minutes, between 09:00 AM and 05:59 PM, Monday through Friday”) plus the next eight times it will fire.\n\nPresets cover the most common schedules if you're writing one from scratch.",
    steps: ["Enter a 5-field cron expression or pick a preset.", "Read the explanation.", "Check the upcoming run times."],
    notes: ["Run times are shown in your local time zone; servers usually run cron in UTC.", "When both day-of-month and day-of-week are restricted, standard cron runs when either matches — this tool follows that rule.", "Quartz/Spring 6- and 7-field syntaxes are not supported."],
    faq: [
      { q: "What does */5 mean?", a: "Every 5 units — in the minute field, every 5 minutes." },
      { q: "Are @daily and @hourly supported?", a: "Yes, common macros are expanded." },
    ],
    keywords: ["cron expression", "cron explainer", "crontab generator", "cron schedule", "cron to text"],
    related: ["unix-timestamp-converter", "regex-tester", "timezone-detector", "countdown-timer"],
  }),
  dev({
    id: "markdown-preview",
    name: "Markdown Preview",
    icon: "file-text",
    summary: "Write Markdown with a live, sanitized GitHub-flavored preview. Export as .md or .html.",
    intro:
      "Draft READMEs, documentation and posts with an instant preview. GitHub-flavored Markdown is supported, including tables, task lists, fenced code blocks and autolinks. The rendered HTML is sanitized with DOMPurify, so pasted content cannot run scripts.",
    steps: ["Type Markdown on the left.", "See the rendered preview on the right.", "Copy the HTML or download .md/.html files."],
    notes: ["Syntax highlighting inside code blocks is not applied.", "Raw HTML in Markdown is allowed but sanitized."],
    faq: [
      { q: "Does it save my document?", a: "No. Download it before closing the tab." },
      { q: "Which Markdown flavor is used?", a: "GitHub-flavored Markdown via the marked library." },
    ],
    keywords: ["markdown preview", "markdown editor online", "markdown to html", "readme editor"],
    related: ["html-formatter", "html-entity-encoder", "word-counter", "text-to-pdf"],
  }),
  dev({
    id: "html-entity-encoder",
    name: "HTML Entity Encoder",
    icon: "code",
    summary: "Escape text for safe use in HTML: minimal (&, <, >, quotes), all named entities, or all non-ASCII characters.",
    intro:
      "Escaping prevents text from being interpreted as HTML — essential when showing code samples or user content. Minimal mode escapes only the five characters that matter for safety; other modes convert special symbols to named entities (©, —) or numeric references for ASCII-only environments.",
    steps: ["Choose the encoding mode.", "Paste your text or HTML.", "Copy the escaped output."],
    notes: ["For XSS protection, escaping must happen in the right context (HTML body, attribute, JavaScript, URL). Templating engines usually handle this automatically."],
    faq: [
      { q: "Should I encode é as &eacute;?", a: "Not usually. With UTF-8 pages, only &, <, > and quotes need escaping." },
      { q: "What's the difference between &#39; and &apos;?", a: "Both represent an apostrophe; &#39; works in old HTML 4 browsers too." },
    ],
    keywords: ["html entity encoder", "html escape", "encode html entities", "escape special characters"],
    related: ["html-entity-decoder", "url-encoder", "html-formatter", "markdown-preview"],
  }),
  dev({
    id: "html-entity-decoder",
    name: "HTML Entity Decoder",
    icon: "code",
    summary: "Decode named, decimal and hex HTML entities (&amp;, &#169;, &#x1F600;) back into readable characters.",
    intro:
      "Turn &lt;p&gt; and &quot;quoted&quot; text from feeds, databases and scraped pages back into normal characters. The full HTML5 entity list (over 2,000 names) is supported, along with decimal and hexadecimal references.",
    steps: ["Paste text containing entities.", "Copy the decoded output."],
    notes: ["Decoded output may contain HTML tags; don't insert it into a page without escaping or sanitizing."],
    faq: [
      { q: "Why do I see &amp;amp;?", a: "The text was escaped twice. Decode it twice using “Reuse”." },
      { q: "Are emoji entities supported?", a: "Yes, e.g. &#x1F600; becomes 😀." },
    ],
    keywords: ["html entity decoder", "html unescape", "decode html entities"],
    related: ["html-entity-encoder", "url-decoder", "base64-decoder", "html-formatter"],
  }),
  dev({
    id: "json-to-yaml",
    name: "JSON to YAML Converter",
    icon: "file-code",
    summary: "Convert JSON to clean YAML for Kubernetes, Docker Compose, GitHub Actions and config files.",
    intro:
      "YAML is easier to read and edit by hand, which is why so many configuration systems use it. Paste JSON and get equivalent YAML with your chosen indentation; strings that need quoting (like “yes”, “on” or values with colons) are quoted automatically to avoid type surprises.",
    steps: ["Paste JSON or open a file.", "Choose 2 or 4 spaces.", "Copy or download the YAML."],
    notes: ["Key order is preserved.", "Comments cannot be generated because JSON has none."],
    faq: [
      { q: "Is all JSON valid YAML?", a: "YAML 1.2 is a superset of JSON, so yes — but converted YAML is much more readable." },
      { q: "Why are some strings quoted?", a: "Unquoted values like yes or 1e3 could be read as booleans or numbers." },
    ],
    keywords: ["json to yaml", "convert json to yaml", "json yaml converter"],
    related: ["yaml-to-json", "json-formatter", "json-to-csv", "xml-formatter"],
  }),
  dev({
    id: "yaml-to-json",
    name: "YAML to JSON Converter",
    icon: "file-json",
    summary: "Convert YAML (including multi-document files, anchors and aliases) to JSON with clear error messages.",
    intro:
      "Convert configuration files to JSON for APIs, validators and code. Multi-document YAML (separated by ---) becomes a JSON array; anchors and aliases are resolved. Syntax errors such as bad indentation are reported with a description.",
    steps: ["Paste YAML or open a .yml file.", "Choose formatting.", "Copy or download the JSON."],
    notes: ["Alias expansion is limited to prevent “billion laughs” memory attacks.", "YAML-specific types such as timestamps become strings or dates per the YAML 1.2 core schema."],
    faq: [
      { q: "Why is “no” converted to a string, not false?", a: "YAML 1.2 (used here) only treats true/false as booleans, unlike YAML 1.1." },
      { q: "Can tabs be used for indentation?", a: "No, YAML forbids tabs for indentation." },
    ],
    keywords: ["yaml to json", "convert yaml", "yml to json", "yaml parser"],
    related: ["json-to-yaml", "json-validator", "json-formatter", "csv-to-json"],
  }),
  dev({
    id: "diff-checker",
    name: "Diff Checker",
    icon: "git-compare",
    popular: true,
    summary: "Compare two code or text files line by line with line numbers, whitespace-ignore option and .patch export.",
    intro:
      "See what changed between two versions of code, configs or documents. Lines are aligned with original and modified line numbers, additions and deletions are color-coded, and you can export a unified diff (.patch) usable with git apply or patch.",
    steps: ["Paste the original and modified text.", "Optionally ignore whitespace changes.", "Review the diff or download a .patch file."],
    notes: ["Comparison is line-based. For word-level edits inside prose, use Text Compare.", LOCAL],
    faq: [
      { q: "Can I compare two files?", a: "Open each file in a text editor and paste the contents; drag-and-drop file comparison is not supported." },
      { q: "What algorithm is used?", a: "The Myers diff algorithm, the same family used by Git." },
    ],
    keywords: ["diff checker", "compare code", "diff tool online", "file difference", "text diff"],
    related: ["text-compare", "json-formatter", "regex-tester", "find-and-replace"],
  }),
  dev({
    id: "color-converter",
    name: "Color Converter",
    icon: "palette",
    popular: true,
    summary: "Convert colors between HEX, RGB, HSL, HSV and CMYK, with a color picker and WCAG contrast ratios.",
    intro:
      "Paste a color in any CSS format — hex, rgb(), hsl() or a named color — and get every other format at once. Contrast ratios against white and black tell you immediately whether text in that color meets the WCAG AA threshold of 4.5:1.",
    steps: ["Type a color value or use the picker.", "Copy the format you need.", "Check contrast before using it for text."],
    notes: ["CMYK values are a mathematical approximation; real print colors depend on the printer's color profile."],
    faq: [
      { q: "Does it support transparency?", a: "Yes, rgba(), hsla() and 8-digit hex values keep their alpha channel." },
      { q: "What is HSV?", a: "Hue-Saturation-Value, also called HSB, used by many design tools' color pickers." },
    ],
    keywords: ["color converter", "hex to rgb", "rgb to hex", "hsl converter", "color code converter"],
    related: ["hex-to-rgb", "rgb-to-hsl", "rgb-to-hex-converter", "image-color-picker"],
  }),
  dev({
    id: "hex-to-rgb",
    name: "HEX to RGB Converter",
    icon: "palette",
    summary: "Convert HEX color codes (#RGB, #RRGGBB, #RRGGBBAA) to RGB values and normalized 0–1 channels.",
    intro:
      "Designers hand over hex codes; code, shaders and some apps need RGB. Enter any 3-, 4-, 6- or 8-digit hex color to get the CSS rgb() value, individual channel numbers and normalized values for OpenGL, Unity or Swift.",
    steps: ["Enter a hex color (with or without #).", "Copy the rgb() value or individual channels."],
    notes: ["Shorthand #abc expands to #aabbcc."],
    faq: [
      { q: "What is #FFFFFF in RGB?", a: "rgb(255, 255, 255), white." },
      { q: "How is hex converted?", a: "Each pair of hex digits is a base-16 number from 00 (0) to FF (255)." },
    ],
    keywords: ["hex to rgb", "convert hex to rgb", "hex color to rgb"],
    related: ["rgb-to-hex-converter", "color-converter", "rgb-to-hsl", "hex-to-hsl-converter"],
  }),
  dev({
    id: "rgb-to-hsl",
    name: "RGB to HSL Converter",
    icon: "palette",
    summary: "Convert RGB colors to HSL (hue, saturation, lightness) for easier palette creation in CSS.",
    intro:
      "HSL makes color adjustments intuitive: change lightness for hover states or rotate hue for a complementary color while keeping the same feel. Enter red, green and blue values (0–255) to get the CSS hsl() value and its components.",
    steps: ["Enter red, green and blue values.", "Copy the HSL value."],
    notes: ["Values are rounded to one decimal place, which is more precise than CSS rendering needs."],
    faq: [
      { q: "Why use HSL in CSS?", a: "Creating lighter or darker variants is as simple as changing the lightness percentage." },
      { q: "What hue is pure red?", a: "0° (and 360°)." },
    ],
    keywords: ["rgb to hsl", "convert rgb to hsl", "hsl color"],
    related: ["hex-to-hsl-converter", "color-converter", "hex-to-rgb", "gradient-generator"],
  }),
];
