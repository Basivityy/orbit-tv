import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const text = (d: Def): ToolDefinition => ({ category: "text", processing: "browser", ...d });

export const textTools: ToolDefinition[] = [
  text({
    id: "word-counter",
    name: "Word Counter",
    icon: "type",
    popular: true,
    summary: "Count words, characters, sentences and paragraphs as you type, plus reading time and top keywords. Free and private.",
    intro:
      "Writing an essay with a word limit, a product description or a blog post for SEO? Paste or type your text and the counts update instantly. Beyond words, you get characters with and without spaces, sentences, paragraphs, average word length, reading and speaking time, and the keywords you use most.\n\nWords are counted with the browser's language-aware word segmentation, so hyphenated words, contractions and non-Latin scripts are handled correctly.",
    steps: ["Type or paste your text into the box.", "Watch the statistics update live.", "Check the keyword list to spot overused words."],
    notes: ["Different tools count slightly differently — for example Microsoft Word counts “e-mail” as one word, as does this tool, but some counters treat URLs or numbers differently.", "Nothing you type is saved or sent anywhere."],
    faq: [
      { q: "How many words is a page?", a: "Roughly 500 words single-spaced or 250 double-spaced with 12-pt font and standard margins." },
      { q: "Does it count numbers as words?", a: "Yes, standalone numbers such as 2026 count as words, matching most word processors." },
    ],
    keywords: ["word counter", "word count", "count words online", "character counter", "essay word count"],
    related: ["character-counter", "reading-time-calculator", "sentence-counter", "paragraph-counter"],
  }),
  text({
    id: "character-counter",
    name: "Character Counter",
    icon: "case-sensitive",
    popular: true,
    summary: "Count characters with and without spaces, letters, digits and UTF-8 bytes, with live limit bars for SEO titles, meta descriptions, SMS and X posts.",
    intro:
      "Many places cap text length: SEO titles (~60 characters), meta descriptions (~160), SMS messages (160 for plain text) and X posts (280). This counter shows how close you are to each limit while you type.\n\nIt counts what people see as characters — an emoji such as 👍🏽 counts once — and also shows UTF-8 bytes and UTF-16 code units for developers working with database or API limits.",
    steps: ["Paste or type your text.", "Read the counts and watch the limit bars.", "Trim until every bar you care about is within its limit."],
    notes: ["X counts some characters (like CJK and URLs) differently from a simple character count.", "SMS messages that contain emoji or non-Latin letters switch to UCS-2 encoding with a 70-character limit per segment."],
    faq: [
      { q: "Do spaces count as characters?", a: "Yes, in most limits (including Google's and X's). The “Without spaces” figure is useful for academic requirements that exclude them." },
      { q: "Why do bytes differ from characters?", a: "UTF-8 uses 1 byte for basic Latin letters but 2–4 bytes for accented letters, other scripts and emoji." },
    ],
    keywords: ["character counter", "character count", "letter counter", "count characters", "meta description length"],
    related: ["word-counter", "meta-tag-generator", "line-counter", "text-to-slug"],
  }),
  text({
    id: "sentence-counter",
    name: "Sentence Counter",
    icon: "align-left",
    summary: "Count sentences and average sentence length to make your writing easier to read. Handles abbreviations and decimals.",
    intro:
      "Readable writing keeps most sentences between 15 and 20 words. Paste your text to count sentences and see the average length, a quick indicator of whether your prose needs shorter sentences.\n\nThe counter recognises sentence-ending punctuation (. ! ? …) while ignoring common abbreviations such as “e.g.”, “Dr.” and decimal numbers like 3.14.",
    steps: ["Paste your text.", "Check the sentence count and average words per sentence.", "Split long sentences if the average is above ~25 words."],
    notes: ["Sentence detection is heuristic; unusual abbreviations or missing spaces after periods can affect the count.", "Bulleted lists without periods are counted as one sentence per paragraph."],
    faq: [
      { q: "What is a good average sentence length?", a: "For general web content, 15–20 words. Technical or academic writing often runs longer." },
      { q: "Does a line break end a sentence?", a: "A blank line (new paragraph) does; a single line break does not." },
    ],
    keywords: ["sentence counter", "count sentences", "average sentence length"],
    related: ["word-counter", "paragraph-counter", "reading-time-calculator", "character-counter"],
  }),
  text({
    id: "paragraph-counter",
    name: "Paragraph Counter",
    icon: "align-left",
    summary: "Count paragraphs in any text and see sentences per paragraph. Paragraphs are separated by blank lines.",
    intro:
      "Short paragraphs make web pages and emails easier to scan. Paste your text to count paragraphs and see the average number of sentences in each — a quick check for walls of text.",
    steps: ["Paste your text with blank lines between paragraphs.", "Read the paragraph count and averages.", "Break up paragraphs averaging more than 4–5 sentences."],
    notes: ["Text copied from some editors uses single line breaks between paragraphs; add blank lines for accurate counting.", "Lines containing only spaces are treated as blank."],
    faq: [
      { q: "How long should a paragraph be online?", a: "2–4 sentences is a common recommendation for web readability." },
      { q: "Does a heading count as a paragraph?", a: "Yes, if it is separated from the text by blank lines." },
    ],
    keywords: ["paragraph counter", "count paragraphs", "paragraph count tool"],
    related: ["sentence-counter", "word-counter", "line-counter", "remove-empty-lines"],
  }),
  text({
    id: "uppercase-converter",
    name: "Uppercase Converter",
    icon: "case-upper",
    summary: "Convert text to UPPERCASE instantly, including accented and international letters. Copy or download the result.",
    intro:
      "Turn any text into capital letters for headings, labels, codes or emphasis. Conversion follows Unicode rules, so accented letters (é → É), German ß (→ SS) and other scripts convert correctly.",
    steps: ["Paste your text.", "The uppercase version appears instantly.", "Copy it or download as a .txt file."],
    notes: ["Writing whole sentences in capitals reads as shouting and is harder to read; use it sparingly."],
    faq: [
      { q: "Can I convert back to normal case?", a: "Use the Lowercase or Title Case converter. The original capitalization cannot be restored automatically." },
      { q: "Does it work with non-English text?", a: "Yes, any script that has upper and lower case letters." },
    ],
    keywords: ["uppercase converter", "convert to uppercase", "caps lock text", "capital letters"],
    related: ["lowercase-converter", "title-case-converter", "text-to-slug", "remove-extra-spaces"],
  }),
  text({
    id: "lowercase-converter",
    name: "Lowercase Converter",
    icon: "case-sensitive",
    summary: "Convert text to lowercase in one step — fix accidental CAPS LOCK typing or normalize data. Unicode-aware.",
    intro:
      "Accidentally typed a paragraph with CAPS LOCK on, or need to normalize email addresses and tags? Paste the text and get an all-lowercase version immediately.",
    steps: ["Paste your text.", "Copy the lowercase result.", "Use “Reuse” to run another transformation on the output."],
    notes: ["Lowercasing is language-neutral here; the Turkish dotted/dotless i follows default Unicode rules."],
    faq: [
      { q: "Should I lowercase email addresses?", a: "The domain part is case-insensitive and most providers treat the local part the same way, so lowercasing is a common normalization." },
      { q: "Will numbers and symbols change?", a: "No, only letters are affected." },
    ],
    keywords: ["lowercase converter", "convert to lowercase", "small letters", "fix caps lock"],
    related: ["uppercase-converter", "title-case-converter", "remove-duplicate-lines", "sort-lines"],
  }),
  text({
    id: "title-case-converter",
    name: "Title Case Converter",
    icon: "type",
    summary: "Capitalize headlines correctly with AP/Chicago-style title case, capitalize every word, or switch to sentence case.",
    intro:
      "Headline capitalization has rules: major words get capitals, while short articles, conjunctions and prepositions (a, and, of, the, to…) stay lowercase unless they start or end the title. This converter applies those rules and leaves acronyms like NASA and brand names like iPhone untouched.\n\nNeed something simpler? Switch to “Capitalize Every Word” or to sentence case.",
    steps: ["Choose a style.", "Paste one or more titles (one per line).", "Copy the converted headlines."],
    notes: ["Style guides differ in details (AP lowercases prepositions of three letters or fewer; Chicago lowercases all prepositions). This tool follows a widely used middle ground.", "Words after a colon are capitalized."],
    faq: [
      { q: "Is “Is” capitalized in a title?", a: "Yes. Verbs are always capitalized, even short ones like Is and Be." },
      { q: "What is sentence case?", a: "Only the first word and proper nouns are capitalized, like a normal sentence." },
    ],
    keywords: ["title case converter", "headline capitalization", "capitalize title", "sentence case"],
    related: ["uppercase-converter", "lowercase-converter", "text-to-slug", "word-counter"],
  }),
  text({
    id: "remove-duplicate-lines",
    name: "Remove Duplicate Lines",
    icon: "copy-minus",
    popular: true,
    summary: "Delete duplicate lines from lists while keeping the original order. Case-insensitive and whitespace-tolerant options.",
    intro:
      "Clean up email lists, keyword lists, log files and CSV columns in seconds. The first occurrence of each line is kept, later repeats are removed, and the original order is preserved — unlike sorting-based approaches.",
    steps: ["Paste your list or open a text file.", "Choose case sensitivity and whitespace handling.", "Copy or download the de-duplicated list."],
    notes: ["Handles hundreds of thousands of lines quickly in the browser.", "For CSV files where only some columns should be compared, use the CSV Duplicate Remover."],
    faq: [
      { q: "Will “Apple” and “apple” be treated as duplicates?", a: "Only if you untick “Case sensitive”." },
      { q: "Does it keep the first or last copy?", a: "The first occurrence is kept." },
    ],
    keywords: ["remove duplicate lines", "dedupe list", "delete duplicates", "unique lines"],
    related: ["sort-lines", "remove-empty-lines", "csv-duplicate-remover", "line-counter"],
  }),
  text({
    id: "remove-empty-lines",
    name: "Remove Empty Lines",
    icon: "eraser",
    summary: "Strip blank and whitespace-only lines from text, code or lists. See how many lines were removed.",
    intro:
      "Text pasted from PDFs, emails and web pages often comes with stray blank lines. Remove them all in one click, optionally treating lines that contain only spaces or tabs as empty too.",
    steps: ["Paste your text.", "Decide whether whitespace-only lines count as empty.", "Copy the compacted result."],
    notes: ["This removes all blank lines, including paragraph breaks. To keep single blank lines between paragraphs, use Remove Extra Spaces instead."],
    faq: [
      { q: "Can I remove only double blank lines?", a: "Use Remove Extra Spaces with “Collapse blank lines”, which keeps one blank line between paragraphs." },
      { q: "Does it trim spaces inside lines?", a: "No, line content is left unchanged." },
    ],
    keywords: ["remove empty lines", "delete blank lines", "remove blank lines text"],
    related: ["remove-extra-spaces", "remove-duplicate-lines", "line-counter", "sort-lines"],
  }),
  text({
    id: "sort-lines",
    name: "Sort Lines",
    icon: "arrow-down-up",
    summary: "Sort lines alphabetically, naturally (file2 before file10), numerically, by length, in reverse or randomly.",
    intro:
      "Organize lists of names, keywords, file names or numbers. Natural sort orders “file2” before “file10” the way humans expect; numeric sort uses the first number on each line; and shuffle uses a cryptographically secure random generator for fair randomization.",
    steps: ["Paste one item per line.", "Choose the sort order and case sensitivity.", "Copy the sorted list."],
    notes: ["Alphabetical sorting uses locale-aware comparison, so accented letters sort next to their base letters.", "Empty lines are sorted too; remove them first if you don't want them at the top."],
    faq: [
      { q: "How do I sort numbers correctly?", a: "Choose Numeric or Natural. Plain A→Z sorts “10” before “9” because it compares text." },
      { q: "Is the shuffle truly random?", a: "It uses crypto.getRandomValues with a Fisher–Yates shuffle, so every order is equally likely." },
    ],
    keywords: ["sort lines", "alphabetical order", "sort list online", "natural sort", "shuffle lines"],
    related: ["remove-duplicate-lines", "reverse-text", "random-picker", "remove-empty-lines"],
  }),
  text({
    id: "reverse-text",
    name: "Reverse Text",
    icon: "undo",
    summary: "Reverse text by characters, word order, letters within each word, or line order. Emoji-safe.",
    intro:
      "Create mirrored text for puzzles, check palindromes, or flip the order of a list. Character reversal works on user-perceived characters, so emoji with skin tones and accented letters stay intact instead of breaking into garbage symbols.",
    steps: ["Pick what to reverse.", "Type or paste text.", "Copy the reversed result."],
    notes: ["Right-to-left scripts such as Arabic and Hebrew may display unexpectedly after reversal because of bidirectional text rendering."],
    faq: [
      { q: "How can I check if a word is a palindrome?", a: "Reverse its characters; if the output matches the input (ignoring case and spaces), it is a palindrome." },
      { q: "What does “letters in each word” do?", a: "It keeps the word order but spells each word backwards: “hello world” becomes “olleh dlrow”." },
    ],
    keywords: ["reverse text", "backwards text", "reverse string", "mirror text"],
    related: ["sort-lines", "text-repeater", "uppercase-converter", "text-to-binary"],
  }),
  text({
    id: "text-compare",
    name: "Text Compare",
    icon: "git-compare",
    summary: "Compare two texts and highlight added and removed words or lines side by side. Great for proofreading revisions.",
    intro:
      "Spot exactly what changed between two versions of an article, contract clause or email. Word-level comparison highlights individual edits within sentences; line-level comparison is better for lists and code.",
    steps: ["Paste the original text on the left.", "Paste the changed text on the right.", "Review highlighted insertions (green) and deletions (red)."],
    notes: ["Comparison runs locally, so confidential drafts stay private.", "For code with line numbers and patch export, use the Diff Checker."],
    faq: [
      { q: "Can it ignore whitespace changes?", a: "The Diff Checker has an “Ignore whitespace” option for line-based comparison." },
      { q: "Is there a size limit?", a: "Texts of several hundred kilobytes compare quickly; extremely large inputs may slow down word-level comparison." },
    ],
    keywords: ["text compare", "compare two texts", "text difference", "find changes in text"],
    related: ["diff-checker", "find-and-replace", "word-counter", "remove-duplicate-lines"],
  }),
  text({
    id: "find-and-replace",
    name: "Find and Replace",
    icon: "replace",
    summary: "Find and replace text with match-case, whole-word and regular-expression options, including $1 capture groups.",
    intro:
      "Make bulk edits in any text: rename a product throughout a document, swap date formats, or clean exported data. Regular-expression mode supports capture groups, so you can rearrange matches — for example turning “Smith, John” into “John Smith”.",
    steps: ["Paste your text.", "Enter what to find and the replacement.", "Toggle match case, whole words or regex; the replacement count is shown."],
    notes: ["In regex mode, use $1, $2… to insert captured groups and $& for the whole match.", "Invalid regular expressions show an error instead of changing your text."],
    faq: [
      { q: "How do I replace line breaks?", a: "Enable regex and search for \\n." },
      { q: "Example of swapping names?", a: "Find (\\w+), (\\w+) and replace with $2 $1 in regex mode." },
    ],
    keywords: ["find and replace", "replace text online", "regex replace", "bulk replace words"],
    related: ["regex-tester", "remove-extra-spaces", "text-compare", "text-to-slug"],
  }),
  text({
    id: "remove-extra-spaces",
    name: "Remove Extra Spaces",
    icon: "eraser",
    summary: "Collapse multiple spaces, trim lines, convert tabs and squeeze blank lines to clean up messy text.",
    intro:
      "Copying from PDFs and web pages leaves double spaces, non-breaking spaces, tabs and ragged line ends. This cleaner collapses runs of spaces into one, trims each line and reduces stacks of blank lines to a single paragraph break.",
    steps: ["Paste the messy text.", "Choose which clean-ups to apply.", "Copy the tidy result."],
    notes: ["Non-breaking spaces and other Unicode space characters are normalized too.", "Indentation is removed when “Trim each line” is on; turn it off for code."],
    faq: [
      { q: "Why does copied PDF text have strange spacing?", a: "PDFs position words individually, so extraction often inserts extra spaces or line breaks." },
      { q: "Will it join broken lines into paragraphs?", a: "No. It cleans spacing but keeps line breaks." },
    ],
    keywords: ["remove extra spaces", "remove double spaces", "trim whitespace", "clean text"],
    related: ["remove-empty-lines", "find-and-replace", "word-counter", "text-to-slug"],
  }),
  text({
    id: "text-to-slug",
    name: "Text to Slug Generator",
    icon: "link",
    summary: "Create clean, SEO-friendly URL slugs from titles: lowercase, accents removed, hyphen or underscore separated.",
    intro:
      "A good URL slug is short, readable and contains only lowercase letters, digits and hyphens. Paste a title and get a slug instantly — accented letters become plain ASCII (é → e), “&” becomes “and”, apostrophes vanish and everything else turns into separators.\n\nConvert many titles at once by putting one per line.",
    steps: ["Paste one or more titles.", "Choose separator and optional maximum length.", "Copy the slugs."],
    notes: ["Max length cuts at a word boundary where possible.", "Non-Latin scripts without an ASCII equivalent (e.g. Chinese) are removed; consider transliterating them first."],
    faq: [
      { q: "Hyphens or underscores?", a: "Google recommends hyphens to separate words in URLs." },
      { q: "Should I remove stop words like “the”?", a: "Optional. Shorter slugs are tidier, but keep words that matter for meaning." },
    ],
    keywords: ["slug generator", "text to slug", "url slug", "seo friendly url", "slugify"],
    related: ["title-case-converter", "url-encoder", "meta-tag-generator", "utm-link-builder"],
  }),
  text({
    id: "lorem-ipsum-generator",
    name: "Lorem Ipsum Generator",
    icon: "quote",
    summary: "Generate lorem ipsum placeholder text by paragraphs, sentences or words, optionally wrapped in <p> tags.",
    intro:
      "Designers and developers use lorem ipsum to fill layouts before real content exists, so attention stays on design rather than words. Generate exactly the amount you need, starting with the classic “Lorem ipsum dolor sit amet” or fully randomized.",
    steps: ["Choose the amount and unit.", "Toggle the classic opening and HTML paragraphs.", "Copy the text or click “Generate new” for a fresh variation."],
    notes: ["Replace placeholder text before launch — search engines treat lorem ipsum as thin content."],
    faq: [
      { q: "Where does lorem ipsum come from?", a: "It is scrambled Latin derived from Cicero's “De finibus bonorum et malorum” (45 BC)." },
      { q: "Why not use real text?", a: "Readable text distracts reviewers into commenting on content instead of layout." },
    ],
    keywords: ["lorem ipsum generator", "placeholder text", "dummy text", "filler text"],
    related: ["word-counter", "text-repeater", "random-picker", "markdown-preview"],
  }),
  text({
    id: "reading-time-calculator",
    name: "Reading Time Calculator",
    icon: "clock",
    summary: "Estimate how long text takes to read and to speak aloud, with adjustable words-per-minute speeds.",
    intro:
      "Show readers how long an article takes (“5 min read”) or time a speech before you give it. The default reading speed of 238 words per minute comes from a 2019 meta-analysis of adult silent reading; the speaking default of 150 wpm suits presentations.",
    steps: ["Paste your text.", "Adjust reading or speaking speed if needed.", "Use the estimated times."],
    notes: ["Technical content, code and dense data are read much more slowly than prose.", "Speaking time does not include pauses, slides or audience interaction."],
    faq: [
      { q: "How is reading time calculated?", a: "Word count divided by words per minute, rounded to seconds." },
      { q: "How fast do people read on screens?", a: "Typically 200–260 words per minute for non-fiction." },
    ],
    keywords: ["reading time calculator", "read time", "speech time calculator", "words per minute"],
    related: ["word-counter", "sentence-counter", "time-duration-calculator", "countdown-timer"],
  }),
  text({
    id: "text-repeater",
    name: "Text Repeater",
    icon: "repeat",
    summary: "Repeat any text or emoji up to 100,000 times with new-line, space, comma or no separator.",
    intro:
      "Generate repeated strings for testing input limits, filling templates or creating patterns. Choose the repeat count and separator; the output updates instantly.",
    steps: ["Type the text to repeat.", "Set the count and separator.", "Copy the result."],
    notes: ["Output is capped at 2,000,000 characters to protect your browser from freezing.", "Please don't use repeated text to spam people or services."],
    faq: [
      { q: "Can I repeat emoji?", a: "Yes, any Unicode text works." },
      { q: "Why is there a limit?", a: "Extremely large strings can exhaust browser memory and crash the tab." },
    ],
    keywords: ["text repeater", "repeat text", "repeat string", "emoji repeater"],
    related: ["lorem-ipsum-generator", "reverse-text", "character-counter", "random-picker"],
  }),
  text({
    id: "line-counter",
    name: "Line Counter",
    icon: "list-ordered",
    summary: "Count total, non-empty and empty lines in text, code or data, and find the longest line length.",
    intro:
      "Quickly count records in a pasted list, lines of code in a snippet or rows in exported data. You also see how many lines are blank and how long the longest line is — useful for spotting malformed entries.",
    steps: ["Paste your text.", "Read the line statistics."],
    notes: ["Windows (CRLF), Unix (LF) and classic Mac (CR) line endings are all recognised.", "A trailing newline at the end of the text counts as an extra empty line, as most editors display it."],
    faq: [
      { q: "Does an empty input have zero lines?", a: "Yes. Any non-empty text has at least one line." },
      { q: "Does it count wrapped lines?", a: "No, only real line breaks count, not visual wrapping." },
    ],
    keywords: ["line counter", "count lines", "number of lines", "lines of code counter"],
    related: ["word-counter", "remove-empty-lines", "remove-duplicate-lines", "sort-lines"],
  }),
  text({
    id: "text-to-binary",
    name: "Text to Binary Converter",
    icon: "binary",
    summary: "Convert text to binary (UTF-8 bytes as 8-bit groups), including emoji and accented letters.",
    intro:
      "See how computers store text: every character is encoded as one or more bytes using UTF-8, and each byte is shown as eight binary digits. Plain English letters take one byte; accented letters take two and emoji take four.",
    steps: ["Type or paste text.", "Choose how bytes are separated.", "Copy the binary output."],
    notes: ["To decode binary back to text, use the Binary to Text converter.", "Encoding is UTF-8, the standard for the web."],
    faq: [
      { q: "What is “A” in binary?", a: "01000001 (decimal 65)." },
      { q: "Why does an emoji produce 32 bits?", a: "Most emoji are encoded as 4 bytes in UTF-8." },
    ],
    keywords: ["text to binary", "binary translator", "convert text to binary", "ascii to binary"],
    related: ["binary-to-text", "text-to-hex", "number-base-converter", "base64-encoder"],
  }),
];
