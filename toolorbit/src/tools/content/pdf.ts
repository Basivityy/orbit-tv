import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const pdf = (d: Def): ToolDefinition => ({ category: "pdf", processing: "browser", ...d });

const PRIVACY = "Your PDF is processed in your browser with pdf-lib and never uploaded.";

export const pdfTools: ToolDefinition[] = [
  pdf({
    id: "merge-pdf",
    name: "Merge PDF",
    icon: "combine",
    popular: true,
    summary: "Combine multiple PDF files into one document in the order you choose. Free, no upload, no watermark, no page limit.",
    intro:
      "Join contracts, invoices, scans and reports into a single PDF. Add as many files as you like, reorder them with the arrow buttons and download one merged document. Page content, links within pages and page sizes are preserved exactly.\n\n" + PRIVACY,
    steps: ["Add two or more PDF files.", "Use the arrows to set the order.", "Click Merge and save the combined PDF."],
    notes: ["Password-protected PDFs must be unlocked first.", "Bookmarks (outlines) and form fields from the source files are not merged into the result.", "Files up to 200 MB each are supported; very large merges depend on your device's memory."],
    faq: [
      { q: "Is there a limit on the number of files?", a: "You can add up to 100 files per merge. The practical limit is your device's memory." },
      { q: "Will merging reduce quality?", a: "No. Pages are copied as-is; nothing is re-compressed or rasterized." },
    ],
    keywords: ["merge pdf", "combine pdf", "join pdf files", "pdf merger"],
    related: ["split-pdf", "reorder-pdf", "jpg-to-pdf", "pdf-page-numbers"],
  }),
  pdf({
    id: "split-pdf",
    name: "Split PDF",
    icon: "scissors",
    popular: true,
    summary: "Split a PDF into single pages, fixed-size chunks or custom page ranges. Results download as a ZIP. Free and private.",
    intro:
      "Break a large PDF into smaller documents: one file per page, every N pages, or custom ranges such as chapters. Each output file keeps the original page content untouched.\n\n" + PRIVACY,
    steps: ["Choose a PDF.", "Select “Every N pages” or enter custom ranges like 1-3, 4-10.", "Download the ZIP containing the split files."],
    notes: ["Custom ranges may overlap; each range becomes its own file.", "To pull out a single selection of pages into one file, use Extract PDF Pages instead."],
    faq: [
      { q: "How do I split every page into its own file?", a: "Choose “Every N pages” and enter 1." },
      { q: "Can I split a password-protected PDF?", a: "Unlock it first with PDF Unlock (you need the password)." },
    ],
    keywords: ["split pdf", "separate pdf pages", "pdf splitter", "split pdf by range"],
    related: ["extract-pdf-pages", "merge-pdf", "delete-pdf-pages", "pdf-page-counter"],
  }),
  pdf({
    id: "rotate-pdf",
    name: "Rotate PDF",
    icon: "rotate",
    summary: "Rotate all or individual PDF pages by 90°, 180° or 270° with live thumbnails. Lossless and private.",
    intro:
      "Fix scanned pages that came out sideways or upside down. Rotate the whole document at once, or click individual thumbnails to turn just those pages. Rotation is stored in the page settings, so text and images are not re-rendered and quality stays identical.\n\n" + PRIVACY,
    steps: ["Open a PDF to see page thumbnails.", "Click pages to rotate them 90°, or use the “Rotate all” buttons.", "Download the rotated PDF."],
    notes: ["Thumbnails are rendered with PDF.js as you scroll, so large documents stay fast.", "Previews are hidden for documents over 500 pages; use Rotate all for those."],
    faq: [
      { q: "Is the rotation permanent?", a: "Yes, the saved PDF opens rotated in every viewer." },
      { q: "Will rotating change the file size?", a: "Only by a few bytes, because only page settings change." },
    ],
    keywords: ["rotate pdf", "turn pdf pages", "rotate pdf page", "fix sideways pdf"],
    related: ["reorder-pdf", "delete-pdf-pages", "merge-pdf", "image-rotator"],
  }),
  pdf({
    id: "delete-pdf-pages",
    name: "Delete PDF Pages",
    icon: "file-minus",
    summary: "Remove unwanted pages from a PDF by clicking thumbnails or entering page ranges. Download the cleaned document instantly.",
    intro:
      "Drop blank scan pages, outdated appendices or cover sheets before sending a document. Select pages visually or type ranges like 2, 5-7, then download a PDF without them.\n\n" + PRIVACY,
    steps: ["Open your PDF.", "Click the pages to remove (or type a range and press Apply).", "Download the new PDF."],
    notes: ["At least one page must remain.", "The original file on your device is never modified; you download a new copy."],
    faq: [
      { q: "Can I recover deleted pages?", a: "Yes — just open the original file again. Nothing is changed on your device." },
      { q: "Does deleting pages remove hidden content?", a: "The removed pages are not included in the new file. Shared resources such as fonts may still be embedded if remaining pages use them." },
    ],
    keywords: ["delete pdf pages", "remove pages from pdf", "pdf page remover"],
    related: ["extract-pdf-pages", "split-pdf", "reorder-pdf", "rotate-pdf"],
  }),
  pdf({
    id: "extract-pdf-pages",
    name: "Extract PDF Pages",
    icon: "file-output",
    summary: "Select specific pages from a PDF and save them as a new document. Visual page picker plus range input.",
    intro:
      "Pull out exactly the pages you need — a signed page, a single chapter or the summary from a long report — into a new PDF. Pages keep their original order in the result.\n\n" + PRIVACY,
    steps: ["Open a PDF.", "Click thumbnails or enter ranges such as 1, 4-6 to select pages.", "Download the extracted PDF."],
    notes: ["To change the page order, use Reorder PDF after extracting.", "Use Split PDF if you want each range as a separate file."],
    faq: [
      { q: "What does a range like 8- mean?", a: "From page 8 to the last page." },
      { q: "Is text still selectable?", a: "Yes, pages are copied without conversion." },
    ],
    keywords: ["extract pdf pages", "save pdf page", "select pages from pdf"],
    related: ["split-pdf", "delete-pdf-pages", "merge-pdf", "pdf-to-jpg"],
  }),
  pdf({
    id: "reorder-pdf",
    name: "Reorder PDF Pages",
    icon: "arrow-down-up",
    summary: "Rearrange PDF pages by drag and drop or arrow buttons, reverse the order, and save. Works fully offline in your browser.",
    intro:
      "Put scanned pages back in order, move an appendix to the end or reverse a document scanned back-to-front. Drag thumbnails to their new position or use the arrow buttons for precise moves.\n\n" + PRIVACY,
    steps: ["Open your PDF.", "Drag pages (or use the arrows) into the order you want.", "Download the reordered PDF."],
    notes: ["Drag and drop works with a mouse; on touch devices use the arrow buttons.", "Documents over 500 pages cannot be reordered visually."],
    faq: [
      { q: "Can I reverse a whole document?", a: "Yes, click “Reverse order”." },
      { q: "Can I duplicate a page?", a: "Not in this tool. Extract the page and merge it back with Merge PDF." },
    ],
    keywords: ["reorder pdf", "rearrange pdf pages", "change page order pdf", "sort pdf pages"],
    related: ["merge-pdf", "rotate-pdf", "delete-pdf-pages", "extract-pdf-pages"],
  }),
  pdf({
    id: "jpg-to-pdf",
    name: "JPG to PDF",
    icon: "file-image",
    popular: true,
    summary: "Turn JPG photos and scans into a PDF. Choose A4, Letter or image-sized pages, orientation and margins. No upload.",
    intro:
      "Combine photos of receipts, documents or a whole photo set into one PDF that is easy to email or print. JPG data is embedded directly without re-compression, so the PDF looks exactly like your photos and stays compact.\n\nYour images are processed in the browser and never uploaded.",
    steps: ["Add JPG images and arrange their order.", "Pick page size, orientation and margin.", "Create and download the PDF."],
    notes: ["Automatic orientation turns each page landscape when the photo is wider than tall.", "Other image formats (WebP, HEIC) dropped here are converted to JPEG first."],
    faq: [
      { q: "Will the PDF be blurry?", a: "No. The original JPG data is embedded unchanged and scaled to fit the page." },
      { q: "Can I make one page per photo at the photo's own size?", a: "Yes, choose “Same as image” as the page size." },
    ],
    keywords: ["jpg to pdf", "jpeg to pdf", "photo to pdf", "convert images to pdf"],
    related: ["png-to-pdf", "merge-pdf", "pdf-to-jpg", "image-compressor"],
  }),
  pdf({
    id: "png-to-pdf",
    name: "PNG to PDF",
    icon: "file-image",
    summary: "Convert PNG images, screenshots and diagrams to PDF with lossless quality and transparency on a white page.",
    intro:
      "Screenshots, diagrams and scanned line art stay razor-sharp when embedded as PNG. Create a single PDF from one or many PNG files, with standard paper sizes or pages that match each image exactly.\n\nEverything runs locally in your browser.",
    steps: ["Add PNG files and order them.", "Choose page size, orientation and margins.", "Create the PDF and download it."],
    notes: ["PNG embedding is lossless, so PDFs made from large screenshots can be big. Compress the images first if size matters."],
    faq: [
      { q: "Is transparency kept?", a: "Transparent areas show the page background (white) in the PDF." },
      { q: "How many images can I add?", a: "Up to 200 per PDF." },
    ],
    keywords: ["png to pdf", "screenshot to pdf", "convert png to pdf"],
    related: ["jpg-to-pdf", "merge-pdf", "pdf-to-png", "image-compressor"],
  }),
  pdf({
    id: "pdf-to-jpg",
    name: "PDF to JPG",
    icon: "image-down",
    popular: true,
    summary: "Convert PDF pages to high-quality JPG images at 72–300 DPI. All pages or a page range, downloaded as a ZIP.",
    intro:
      "Need a page as an image for a presentation, social post or website? This tool renders each page with Mozilla's PDF.js — the engine inside Firefox — and saves it as a JPG at the resolution you choose.\n\nRendering happens on your device, so confidential documents never leave it.",
    steps: ["Open a PDF.", "Set the resolution and, optionally, a page range.", "Download a single JPG or a ZIP of all pages."],
    notes: ["150 DPI is sharp on screens; use 300 DPI for print.", "At most 300 pages can be converted per run to keep memory in check.", "Fonts that are not embedded in the PDF are substituted, which can change how text looks."],
    faq: [
      { q: "JPG or PNG?", a: "JPG gives much smaller files for photos and scans. PNG is better for crisp text and diagrams." },
      { q: "Can I convert only one page?", a: "Yes, type its number in the page range field." },
    ],
    keywords: ["pdf to jpg", "pdf to jpeg", "convert pdf to image", "pdf page to image"],
    related: ["pdf-to-png", "jpg-to-pdf", "extract-pdf-pages", "image-compressor"],
  }),
  pdf({
    id: "pdf-to-png",
    name: "PDF to PNG",
    icon: "image",
    summary: "Render PDF pages to lossless PNG images at up to 300 DPI. Ideal for diagrams, slides and text-heavy pages.",
    intro:
      "PNG keeps text edges and line art perfectly crisp, making it the best choice for converting slides, charts and technical drawings into images. Pages are rendered locally with PDF.js on a white background.",
    steps: ["Open a PDF.", "Choose resolution and optional page range.", "Download the PNG images (ZIP for multiple pages)."],
    notes: ["PNG files are larger than JPG for photographic pages.", "Higher DPI uses more memory; drop to 150 DPI if your device struggles."],
    faq: [
      { q: "Is the background transparent?", a: "No, pages are rendered on white like they appear in viewers." },
      { q: "What DPI should I choose for slides?", a: "144–200 DPI gives sharp results on high-density screens with moderate file size." },
    ],
    keywords: ["pdf to png", "convert pdf to png", "pdf to image lossless"],
    related: ["pdf-to-jpg", "png-to-pdf", "pdf-grayscale", "image-resizer"],
  }),
  pdf({
    id: "pdf-page-counter",
    name: "PDF Page Counter",
    icon: "hash",
    summary: "Count pages in one or hundreds of PDFs at once and get the total. Fast, private, no upload.",
    intro:
      "Estimating print jobs, translation quotes or scanning work? Drop a batch of PDFs and instantly see the page count of each file plus the grand total. Only the document structure is read, so even large files are counted in milliseconds.",
    steps: ["Choose one or many PDF files.", "Read the page count per file and the total.", "Add more files to keep counting, or clear the list."],
    notes: ["Password-protected PDFs can usually still be counted because the page tree is not encrypted.", "Damaged files are listed as unreadable."],
    faq: [
      { q: "How many files can I count at once?", a: "Up to 500 files per selection, and you can keep adding more." },
      { q: "Does it count blank pages?", a: "Yes, every page in the document counts, including blank ones." },
    ],
    keywords: ["pdf page counter", "count pdf pages", "number of pages in pdf"],
    related: ["pdf-page-size-checker", "pdf-metadata-viewer", "split-pdf", "merge-pdf"],
  }),
  pdf({
    id: "pdf-page-size-checker",
    name: "PDF Page Size Checker",
    icon: "ruler",
    summary: "See the size of every page in a PDF in points, millimetres and inches, with A4/Letter detection and rotation.",
    intro:
      "Printers and publishers reject files with the wrong paper size. This checker lists every page's dimensions, identifies standard sizes such as A4, US Letter, Legal and A3, and flags documents that mix page sizes.",
    steps: ["Drop a PDF.", "Review the table of page sizes.", "Look for “mixed page sizes” before sending to print."],
    notes: ["Sizes reflect the visible (rotated) page as viewers show it.", "PDF points are 1/72 inch."],
    faq: [
      { q: "What is the size of A4 in points?", a: "595 × 842 points (210 × 297 mm)." },
      { q: "And US Letter?", a: "612 × 792 points (8.5 × 11 inches)." },
    ],
    keywords: ["pdf page size", "check pdf dimensions", "pdf paper size a4 letter"],
    related: ["pdf-page-counter", "pdf-metadata-viewer", "image-dpi-checker", "text-to-pdf"],
  }),
  pdf({
    id: "pdf-metadata-viewer",
    name: "PDF Metadata Viewer & Editor",
    icon: "file-search",
    summary: "View PDF title, author, creator app, producer, dates, version and encryption — and edit title, author, subject and keywords.",
    intro:
      "PDF files carry document properties that search engines, document management systems and recipients can see — sometimes revealing an author's name or the software used. Inspect them here, then edit the title, author, subject and keywords and save a new copy.\n\n" + PRIVACY,
    steps: ["Drop a PDF to read its properties.", "Edit the fields in “Edit metadata” if needed.", "Download the PDF with updated metadata."],
    notes: ["XMP metadata streams written by some apps may still contain older values; this tool edits the standard document information dictionary.", "Encrypted PDFs can be viewed but not edited."],
    faq: [
      { q: "Does the PDF title matter for SEO?", a: "Google may use the PDF title metadata as the search result title, so a descriptive title helps." },
      { q: "Can I remove the author name?", a: "Yes, clear the Author field and save." },
    ],
    keywords: ["pdf metadata", "edit pdf properties", "pdf author", "pdf info viewer"],
    related: ["image-metadata-viewer", "pdf-page-counter", "pdf-password-protect", "exif-remover"],
  }),
  pdf({
    id: "pdf-watermark",
    name: "Add Watermark to PDF",
    icon: "stamp",
    summary: "Stamp text watermarks such as CONFIDENTIAL or DRAFT on every PDF page. Control size, color, opacity, angle and tiling.",
    intro:
      "Mark drafts, confidential documents or sample copies with a clear text watermark on every page. Adjust font size, opacity, color and angle, and choose a single centred stamp or a tiled pattern across the page.\n\n" + PRIVACY,
    steps: ["Open a PDF.", "Type the watermark text and adjust its style.", "Download the watermarked document."],
    notes: ["The watermark uses the built-in Helvetica font, which supports Latin characters. Other scripts are replaced with “?” and you will be warned.", "A text watermark can be removed by someone with PDF editing tools; it is a deterrent, not protection."],
    faq: [
      { q: "Can I add an image or logo watermark?", a: "Use PDF Sign with an uploaded image to place a logo on every page." },
      { q: "Does the watermark cover the text?", a: "It is drawn on top with transparency, so content stays readable at low opacity (15–30%)." },
    ],
    keywords: ["pdf watermark", "add watermark to pdf", "confidential stamp pdf", "draft watermark"],
    related: ["pdf-page-numbers", "pdf-password-protect", "pdf-sign", "merge-pdf"],
  }),
  pdf({
    id: "pdf-page-numbers",
    name: "Add Page Numbers to PDF",
    icon: "list-ordered",
    summary: "Number PDF pages with formats like “Page 1 of 10”, six positions, custom start number and an option to skip the cover.",
    intro:
      "Add professional page numbers to reports, theses and merged documents. Choose where numbers appear, the text format and the starting number, and optionally skip the cover page.\n\n" + PRIVACY,
    steps: ["Open a PDF.", "Set format (use {n} and {total}), position, size and start number.", "Download the numbered PDF."],
    notes: ["Numbers are drawn on top of existing content; check pages with footers to avoid overlap and adjust the margin.", "Roman numerals are not supported."],
    faq: [
      { q: "How do I show “3 / 12”?", a: "Use the format {n} / {total}." },
      { q: "Can I start counting at 5?", a: "Yes, set “Start at” to 5." },
    ],
    keywords: ["add page numbers to pdf", "number pdf pages", "pdf pagination"],
    related: ["merge-pdf", "pdf-watermark", "text-to-pdf", "reorder-pdf"],
  }),
  pdf({
    id: "pdf-grayscale",
    name: "Convert PDF to Grayscale",
    icon: "contrast",
    summary: "Turn a color PDF into black and white for cheaper printing. Choose quality from 96 to 300 DPI. Runs locally.",
    intro:
      "Print shops often charge more for color, and some submissions require grayscale. This tool renders every page with PDF.js, converts it to grayscale using perceptual luminance and rebuilds the PDF.\n\nBecause pages become images, text is no longer selectable — the tool tells you this up front so you can decide.",
    steps: ["Open a PDF.", "Pick the output quality (150 DPI for screen, 300 for print).", "Convert and download."],
    notes: ["Output pages are JPEG images; text selection and search are lost.", "Documents are limited to 500 pages.", "If you need a vector grayscale PDF, use a desktop tool such as Ghostscript."],
    faq: [
      { q: "Why does the file get bigger?", a: "Vector text is small; images of text are larger. Lower the DPI for a smaller file." },
      { q: "Is this good enough for printing?", a: "At 300 DPI the output is sharp for normal document printing." },
    ],
    keywords: ["pdf grayscale", "pdf to black and white", "convert pdf color to grayscale"],
    related: ["image-grayscale", "pdf-to-jpg", "text-to-pdf", "pdf-page-counter"],
  }),
  pdf({
    id: "pdf-password-protect",
    name: "Password Protect PDF",
    icon: "lock",
    popular: true,
    summary: "Encrypt a PDF with AES-256 and a password, and control printing, copying and editing permissions. Done in your browser.",
    intro:
      "Protect contracts, statements and medical documents before emailing them. The PDF is encrypted with AES-256 (the strongest standard PDF encryption) right in your browser — neither the file nor the password is ever sent anywhere.\n\nYou can also restrict printing, copying and editing for compliant PDF viewers.",
    steps: ["Open the PDF.", "Enter and confirm a strong password; set permissions.", "Download the encrypted PDF."],
    notes: ["Choose a long password (12+ characters); short passwords on encrypted files can be brute-forced offline.", "Permission restrictions rely on viewer cooperation and are weaker than the open password.", "There is no way to recover a forgotten password."],
    faq: [
      { q: "Which apps can open AES-256 PDFs?", a: "Adobe Acrobat/Reader X and later, Chrome, Edge, Firefox, macOS Preview and iOS all support it." },
      { q: "How do I send the password safely?", a: "Share it through a different channel than the file, for example by phone or a separate messenger." },
    ],
    keywords: ["password protect pdf", "encrypt pdf", "lock pdf", "secure pdf aes 256"],
    related: ["pdf-unlock", "pdf-watermark", "password-generator", "pdf-metadata-viewer"],
  }),
  pdf({
    id: "pdf-unlock",
    name: "Unlock PDF (with Password)",
    icon: "key",
    summary: "Remove the open password from a PDF you are authorised to access. Enter the password once and save an unlocked copy.",
    intro:
      "Tired of typing the same password every time you open a bank statement or payslip? If you know the password, this tool decrypts the PDF locally and saves a copy without protection.\n\nThe tool cannot and will not guess unknown passwords.",
    steps: ["Choose the protected PDF.", "Enter its password.", "Download the unlocked copy."],
    notes: ["Only remove protection from documents you own or are permitted to modify.", "Store unlocked copies of sensitive documents securely."],
    faq: [
      { q: "I forgot the password. Can you help?", a: "No. Strong PDF encryption cannot be bypassed without the password, and we do not offer password cracking." },
      { q: "Is my password sent anywhere?", a: "No. Decryption happens in your browser." },
    ],
    keywords: ["unlock pdf", "remove pdf password", "decrypt pdf", "pdf password remover"],
    related: ["pdf-password-protect", "merge-pdf", "pdf-metadata-viewer", "split-pdf"],
  }),
  pdf({
    id: "pdf-sign",
    name: "Sign PDF",
    icon: "pen",
    popular: true,
    summary: "Draw, type or upload your signature and place it on any PDF page with a click. Free electronic signature, no account.",
    intro:
      "Sign forms, NDAs and agreements without printing and scanning. Draw your signature with a mouse or finger, type it in a script font or upload a photo of it, then click on the page preview where it should go and adjust its size.\n\n" + PRIVACY,
    steps: ["Open the PDF.", "Create your signature by drawing, typing or uploading.", "Click the page to position it, set the size and download the signed PDF."],
    notes: ["This creates a visual electronic signature, not a certificate-based digital signature (PAdES).", "If a recipient requires a qualified or certificate-based signature, use a dedicated e-signature service."],
    faq: [
      { q: "Is an electronic signature legally binding?", a: "In the US (ESIGN Act, UETA) and EU (eIDAS), simple electronic signatures are generally valid for many documents, but some documents require stronger forms. When in doubt, ask the recipient." },
      { q: "Is my signature stored?", a: "No. It exists only in this page until you close it." },
    ],
    keywords: ["sign pdf", "electronic signature", "add signature to pdf", "esign pdf free"],
    related: ["pdf-watermark", "pdf-password-protect", "merge-pdf", "pdf-page-numbers"],
  }),
  pdf({
    id: "text-to-pdf",
    name: "Text to PDF",
    icon: "file-text",
    summary: "Turn plain text into a clean, paginated PDF with your choice of font, size, margins and paper size.",
    intro:
      "Convert notes, logs, code or drafts into a tidy PDF that anyone can open. Long lines wrap automatically, blank lines are preserved and pages break where they should.",
    steps: ["Paste or type your text.", "Choose font, paper size, font size and margins.", "Create and download the PDF."],
    notes: ["The standard PDF fonts cover Latin-1 characters (Western European languages). Emoji, Cyrillic, Greek and Asian scripts are replaced with “?” — you'll see a warning if that happens.", "Text is real, selectable text in the PDF."],
    faq: [
      { q: "Can I keep code indentation?", a: "Yes. Use the Courier font so spaces line up." },
      { q: "Is there a length limit?", a: "Several hundred pages generate in seconds; very long texts depend on device memory." },
    ],
    keywords: ["text to pdf", "txt to pdf", "convert text to pdf", "create pdf from text"],
    related: ["jpg-to-pdf", "pdf-page-numbers", "merge-pdf", "word-counter"],
  }),
];
