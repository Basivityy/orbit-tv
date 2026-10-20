import type { ToolDefinition } from "../types";

type Def = Omit<ToolDefinition, "category" | "processing"> & { processing?: ToolDefinition["processing"] };
const image = (d: Def): ToolDefinition => ({ category: "image", processing: "browser", ...d });

export const imageTools: ToolDefinition[] = [
  image({
    id: "jpg-to-png",
    name: "JPG to PNG Converter",
    icon: "image",
    popular: true,
    summary: "Convert JPG/JPEG photos to PNG instantly in your browser. Batch conversion, no upload, no watermark, no sign-up.",
    intro:
      "PNG is a lossless format, which makes it the right choice when you need to edit an image repeatedly, add transparency later, or paste a screenshot into a design tool without further quality loss. This converter decodes your JPG with the browser's built-in image engine and re-encodes every pixel into a PNG file.\n\nConversion happens entirely on your device, so even large camera photos convert in a second or two and never touch our servers.",
    steps: ["Choose one or more JPG files, or drag them onto the drop zone.", "Each image converts automatically — the list shows the new size and dimensions.", "Download files one by one or grab them all as a ZIP."],
    notes: [
      "Converting to PNG cannot restore detail that JPEG compression already removed; it only prevents further loss.",
      "PNG files of photos are usually 3–6× larger than the JPG. That is expected for a lossless format.",
      "EXIF orientation is applied, so rotated phone photos come out the right way up. Other EXIF metadata is not copied.",
    ],
    faq: [
      { q: "Will my JPG become transparent?", a: "No. JPG has no transparency, so the PNG keeps the same opaque background. Use a background-removal tool if you need transparency." },
      { q: "Is there a file limit?", a: "Each file can be up to 50 MB and 100 megapixels. You can convert dozens of files in one batch; they are processed one after another to keep memory use low." },
    ],
    keywords: ["jpg to png", "jpeg to png", "convert jpg", "jpg png converter"],
    related: ["png-to-jpg", "image-compressor", "png-to-webp", "image-resizer"],
  }),
  image({
    id: "png-to-jpg",
    name: "PNG to JPG Converter",
    icon: "image-down",
    popular: true,
    summary: "Convert PNG images to JPG with adjustable quality and a custom background color for transparent areas. Free and private.",
    intro:
      "JPG files are much smaller than PNG for photographs and are accepted by practically every website, form and email client. This tool converts PNG to JPG with a quality slider so you can balance size and sharpness.\n\nBecause JPG cannot store transparency, transparent pixels are filled with a background color you choose (white by default) instead of turning black, which is a common problem with other converters.",
    steps: ["Pick a quality level (85–92% is a good default for photos).", "Choose the background color for transparent areas.", "Drop your PNG files and download the converted JPGs."],
    notes: [
      "Screenshots, logos and text-heavy graphics often look better and stay smaller as PNG; JPG is best for photos.",
      "Changing the quality or background re-converts the files already in the list automatically.",
    ],
    faq: [
      { q: "Why is my JPG blurry around text?", a: "JPEG compression creates artifacts around sharp edges. Raise the quality to 95% or keep text graphics as PNG or WebP." },
      { q: "What quality should I use?", a: "80–90% gives files several times smaller than PNG with no visible difference for most photos. Below 70% artifacts become noticeable." },
    ],
    keywords: ["png to jpg", "png to jpeg", "convert png", "transparent png to jpg"],
    related: ["jpg-to-png", "image-compressor", "png-to-webp", "image-resizer"],
  }),
  image({
    id: "webp-to-png",
    name: "WebP to PNG Converter",
    icon: "images",
    summary: "Convert WebP images to PNG for apps and editors that don't support WebP. Transparency is preserved. Runs in your browser.",
    intro:
      "WebP is common on the web, but older versions of Photoshop, Office, some CMS plugins and many upload forms still refuse it. Converting to PNG gives you a universally supported, lossless copy that keeps any transparency from the original.\n\nYour browser decodes the WebP (including animated WebP, of which the first frame is used) and writes a standard PNG file.",
    steps: ["Select or drop your .webp files.", "Wait a moment while they convert.", "Download each PNG or all of them as a ZIP."],
    notes: ["Animated WebP files are converted to a single still PNG of the first frame.", "The PNG is often larger than the WebP because PNG compression is less efficient."],
    faq: [
      { q: "Does it keep transparency?", a: "Yes. Alpha transparency in the WebP is preserved exactly in the PNG." },
      { q: "Why do I get WebP files when I save images from websites?", a: "Many sites serve WebP because it is 25–35% smaller than JPEG or PNG at similar quality, which speeds up page loads." },
    ],
    keywords: ["webp to png", "convert webp", "webp converter", "open webp"],
    related: ["png-to-webp", "jpg-to-png", "image-compressor", "avif-to-jpg"],
  }),
  image({
    id: "png-to-webp",
    name: "PNG to WebP Converter",
    icon: "image-plus",
    summary: "Convert PNG to WebP to cut file size by 25–80% while keeping transparency. Quality control, batch mode, no upload.",
    intro:
      "WebP supports both lossy compression and transparency, which makes it an excellent replacement for PNG on websites: smaller files load faster and improve Core Web Vitals such as Largest Contentful Paint.\n\nSet a quality level, drop your PNG files and compare the before and after sizes immediately in the list.",
    steps: ["Choose a quality (75–85% suits most web graphics).", "Drop your PNG images.", "Check the size reduction and download the WebP files."],
    notes: ["All current browsers display WebP, but some desktop software and older email clients do not.", "Encoding uses your browser's WebP encoder; Safari versions before 17 cannot encode WebP and will show an error."],
    faq: [
      { q: "Is WebP lossless?", a: "WebP can be lossless or lossy. This tool uses the browser's lossy encoder with alpha, which gives the biggest savings. At 100% quality differences are practically invisible." },
      { q: "Should I serve WebP or AVIF?", a: "AVIF is usually smaller still, but encoding is slower and support is slightly newer. WebP is the safe, fast default." },
    ],
    keywords: ["png to webp", "convert to webp", "webp converter", "optimize png"],
    related: ["webp-to-png", "jpg-to-avif", "image-compressor", "png-to-jpg"],
  }),
  image({
    id: "avif-to-jpg",
    name: "AVIF to JPG Converter",
    icon: "file-image",
    summary: "Convert AVIF images to widely compatible JPG files. Decodes natively or with WebAssembly, entirely on your device.",
    intro:
      "AVIF offers excellent compression but is still unsupported by many image editors, office suites and upload forms. This converter turns AVIF files into standard JPGs you can open anywhere.\n\nModern browsers decode AVIF natively; if yours cannot, the tool automatically loads a WebAssembly AVIF decoder so conversion still works without uploading anything.",
    steps: ["Set the JPG quality and background color.", "Drop one or more .avif files.", "Download the converted JPGs individually or as a ZIP."],
    notes: ["High bit-depth (10/12-bit HDR) AVIF images are converted to standard 8-bit JPG, so HDR highlights are tone-mapped by the browser.", "Transparent areas are filled with the chosen background color."],
    faq: [
      { q: "What is AVIF?", a: "AVIF is an image format based on the AV1 video codec. It typically produces files around 50% smaller than JPEG at similar quality." },
      { q: "Why can't I open AVIF files on my computer?", a: "Support depends on the operating system and app. Windows needs the AV1 extension and many editors lack support, so converting to JPG is the simplest fix." },
    ],
    keywords: ["avif to jpg", "avif to jpeg", "convert avif", "open avif file"],
    related: ["jpg-to-avif", "webp-to-png", "heic-to-jpg", "image-compressor"],
  }),
  image({
    id: "jpg-to-avif",
    name: "JPG to AVIF Converter",
    icon: "file-image",
    summary: "Convert JPG photos to AVIF for much smaller files. Uses a WebAssembly AV1 encoder in your browser — nothing is uploaded.",
    intro:
      "AVIF can cut photo sizes roughly in half compared with JPEG at similar visual quality, which makes it attractive for websites and image-heavy pages. Browsers cannot encode AVIF through the standard canvas API, so this tool runs the open-source libavif encoder compiled to WebAssembly in a background worker.\n\nExpect a few seconds per large photo; the page stays responsive while encoding runs.",
    steps: ["Pick a quality (50–65% is a good starting point for AVIF).", "Drop your JPG images.", "Compare file sizes and download the AVIF results."],
    notes: ["AVIF encoding is CPU-intensive; very large images (over 20 MP) may take 10+ seconds on phones.", "AVIF quality numbers are not equivalent to JPEG quality: 60% AVIF often looks like 85% JPEG.", "Serve AVIF with a JPEG or WebP fallback for older software."],
    faq: [
      { q: "Which browsers can display AVIF?", a: "Chrome, Edge, Firefox, Opera and Safari 16.4+ all display AVIF." },
      { q: "Is the conversion private?", a: "Yes. The encoder runs locally in a Web Worker; your photos never leave the device." },
    ],
    keywords: ["jpg to avif", "convert to avif", "avif encoder", "jpeg to avif"],
    related: ["avif-to-jpg", "png-to-webp", "image-compressor", "image-resizer"],
  }),
  image({
    id: "heic-to-jpg",
    name: "HEIC to JPG Converter",
    icon: "smartphone",
    popular: true,
    summary: "Convert iPhone HEIC/HEIF photos to JPG in your browser. Batch convert, adjustable quality, photos stay on your device.",
    intro:
      "iPhones save photos as HEIC by default. The format is efficient, but Windows, many websites and older apps cannot open it. This converter decodes HEIC with a WebAssembly build of libheif and saves standard JPG files that work everywhere.\n\nBecause personal photos often contain sensitive moments and location data, all decoding happens locally — nothing is uploaded.",
    steps: ["Choose the JPG quality.", "Select your .heic or .heif files (you can pick many at once).", "Download the JPGs one by one or as a ZIP."],
    notes: [
      "The HEIC decoder (about 1 MB) loads the first time you convert a file.",
      "Live Photos and burst sequences are converted to a single still image.",
      "EXIF metadata such as GPS location is not carried over to the JPG.",
    ],
    faq: [
      { q: "Can I stop my iPhone from taking HEIC photos?", a: "Yes: Settings → Camera → Formats → Most Compatible saves new photos as JPG. Existing photos stay HEIC." },
      { q: "Why does conversion take a few seconds?", a: "HEIC decoding runs in WebAssembly rather than native code. A 12 MP photo typically takes 1–3 seconds." },
    ],
    keywords: ["heic to jpg", "heic converter", "iphone photo to jpg", "heif to jpg"],
    related: ["heic-to-png", "image-compressor", "exif-remover", "image-resizer"],
  }),
  image({
    id: "heic-to-png",
    name: "HEIC to PNG Converter",
    icon: "smartphone",
    summary: "Convert HEIC/HEIF photos from iPhone and iPad to lossless PNG files directly in your browser.",
    intro:
      "Choose PNG over JPG when you plan to edit the photo further, need pixel-perfect quality for a print shop, or want to avoid stacking compression artifacts. This tool decodes HEIC locally with WebAssembly and writes lossless PNG files.",
    steps: ["Drop one or more HEIC/HEIF files.", "Wait for the conversion to finish.", "Download your PNG files or a ZIP of all of them."],
    notes: ["PNG files of photos are large — often 10–20 MB for a 12 MP image.", "If you only need to share a photo, HEIC to JPG produces much smaller files."],
    faq: [
      { q: "Does PNG preserve the full HEIC quality?", a: "PNG stores exactly the 8-bit pixels decoded from the HEIC. HDR or 10-bit depth information beyond 8 bits per channel is reduced." },
      { q: "Are my photos uploaded?", a: "No. Conversion runs entirely in your browser." },
    ],
    keywords: ["heic to png", "heif to png", "convert heic lossless"],
    related: ["heic-to-jpg", "png-to-jpg", "image-resizer", "image-metadata-viewer"],
  }),
  image({
    id: "svg-to-png",
    name: "SVG to PNG Converter",
    icon: "file-type",
    summary: "Render SVG vector graphics to sharp PNG images at any width up to 8192 px, with transparency. Free, private, instant.",
    intro:
      "SVG files scale perfectly, but many platforms — social networks, app stores, slide decks and email — need a raster image. This tool renders your SVG with the browser's own SVG engine at the exact width you choose and exports a transparent PNG.\n\nSet a large width to get crisp results for print or high-density displays.",
    steps: ["Enter the output width in pixels (height keeps the SVG's proportions).", "Drop your SVG files.", "Download the PNGs."],
    notes: [
      "For security, SVGs are rendered as images: scripts do not run and external files (web fonts, linked images) are not loaded. Convert text to outlines in your design tool if fonts look wrong.",
      "SVGs without width/height or viewBox attributes default to 512 px.",
    ],
    faq: [
      { q: "Why does my text use a different font?", a: "Fonts referenced from the web or installed only in your design tool are not available inside an image render. Outline the text before exporting the SVG." },
      { q: "What is the maximum size?", a: "Up to 8192 px wide, and the total image may not exceed 100 megapixels." },
    ],
    keywords: ["svg to png", "convert svg", "svg rasterize", "vector to png"],
    related: ["png-to-ico", "favicon-generator", "image-resizer", "png-to-webp"],
  }),
  image({
    id: "png-to-ico",
    name: "PNG to ICO Converter",
    icon: "square",
    summary: "Create multi-size Windows .ico files from PNG, JPG, WebP or SVG. Choose sizes from 16×16 to 256×256.",
    intro:
      "ICO files bundle several sizes of the same icon so Windows and browsers can pick the sharpest one for each context — 16 px for browser tabs, 32 px for taskbars, 48 px and 256 px for desktop icons. This tool builds a standards-compliant .ico container with PNG-compressed entries.",
    steps: ["Tick the sizes you want inside the icon (16, 32 and 48 cover most uses).", "Drop your source image.", "The .ico file downloads automatically."],
    notes: ["Non-square images are centred on a transparent square canvas.", "PNG-compressed ICO entries are supported by Windows Vista and later and by all modern browsers."],
    faq: [
      { q: "What sizes does a favicon.ico need?", a: "16×16, 32×32 and 48×48 are the common trio. For a complete set including Apple and Android icons use the Favicon Generator." },
      { q: "Can I convert ICO back to PNG?", a: "Most image viewers open ICO files; you can then save a PNG. A dedicated ICO extractor is not part of this tool." },
    ],
    keywords: ["png to ico", "ico converter", "create ico file", "windows icon"],
    related: ["favicon-generator", "svg-to-png", "image-resizer", "image-cropper"],
  }),
  image({
    id: "favicon-generator",
    name: "Favicon Generator",
    icon: "sparkles",
    popular: true,
    summary: "Generate a complete favicon package — favicon.ico, PNG icons, Apple touch icon, Android icons and web manifest — from one image.",
    intro:
      "Modern websites need more than a single favicon.ico. Browsers, iOS home screens, Android launchers and progressive web apps each look for different files. Upload a logo once and get every file plus the exact HTML to paste into your page's <head>.",
    steps: ["Enter your site name and theme color.", "Upload a square logo (an SVG or a 512×512 PNG works best).", "Download the ZIP and copy the HTML snippet into your site."],
    notes: ["The Apple touch icon always gets a solid background because iOS shows transparent areas as black.", "Keep the design simple: detail disappears at 16×16 pixels."],
    faq: [
      { q: "Where do I put the files?", a: "Upload all files to the root of your website (the same folder as index.html) so paths like /favicon.ico resolve, then add the HTML snippet to every page." },
      { q: "Why doesn't my new favicon show up?", a: "Browsers cache favicons aggressively. Hard-refresh, open a private window, or append a version query such as /favicon.ico?v=2." },
    ],
    keywords: ["favicon generator", "favicon maker", "apple touch icon", "site webmanifest"],
    related: ["png-to-ico", "svg-to-png", "meta-tag-generator", "open-graph-generator"],
  }),
  image({
    id: "image-compressor",
    name: "Image Compressor",
    icon: "minimize",
    popular: true,
    summary: "Compress JPG, PNG, WebP and AVIF images and see the savings instantly. Optional downscaling. Runs locally, no upload.",
    intro:
      "Large images slow down websites, bounce off email size limits and eat phone storage. This compressor re-encodes images with a quality you choose and can optionally downscale anything wider than a maximum width — the two changes that save the most bytes.\n\nThe result list shows the exact percentage saved for every file, so you can fine-tune quality until the trade-off looks right.",
    steps: ["Choose quality, output format and an optional maximum width.", "Drop your images (batch is supported).", "Compare sizes and download the smaller files."],
    notes: [
      "Re-encoding a JPEG that was already heavily compressed may not shrink it further — the list highlights files that got larger.",
      "WebP and AVIF give the best savings; JPEG gives the best compatibility.",
      "Compression strips EXIF metadata, which also removes GPS data.",
    ],
    faq: [
      { q: "How much can I compress without visible loss?", a: "For photos, quality 75–85% usually reduces size by 50–80% versus camera originals with no visible difference at normal viewing size." },
      { q: "Is PNG compression lossless here?", a: "Choosing PNG output re-encodes losslessly, so savings are small. For real reductions convert to WebP or reduce dimensions." },
    ],
    keywords: ["image compressor", "compress jpg", "reduce image size", "compress png", "optimize images"],
    related: ["image-resizer", "png-to-webp", "jpg-to-avif", "exif-remover"],
  }),
  image({
    id: "image-resizer",
    name: "Image Resizer",
    icon: "maximize",
    popular: true,
    summary: "Resize images to exact pixel dimensions or by percentage, with aspect-ratio lock and high-quality downscaling.",
    intro:
      "Resize photos for social media, product listings, email or website layouts. Enter a width, a height, or both: with the aspect-ratio lock on, the image is scaled to fit inside the box without distortion. Percentage mode is handy for quickly halving camera photos.\n\nDownscaling uses multi-step high-quality resampling to avoid the jagged edges and moiré that single-step browser scaling can produce.",
    steps: ["Choose pixels or percentage.", "Enter the target size and output format.", "Drop your images and download the resized copies."],
    notes: ["Enlarging an image cannot add real detail; expect softness above 150–200%.", "Maximum output is 32,767 px per side and 100 megapixels total."],
    faq: [
      { q: "What size should Instagram or Facebook images be?", a: "1080×1080 for square posts, 1080×1350 for portrait and 1080×1920 for stories. Facebook link images use 1200×630." },
      { q: "Can I resize many photos to the same width?", a: "Yes. Enter only the width with the ratio lock on and drop all photos; each keeps its own proportions." },
    ],
    keywords: ["image resizer", "resize image", "resize photo", "change image size", "resize jpg"],
    related: ["image-compressor", "image-cropper", "aspect-ratio-calculator", "image-rotator"],
  }),
  image({
    id: "image-cropper",
    name: "Image Cropper",
    icon: "crop",
    summary: "Crop images visually or with exact pixel values. Aspect presets for square, 16:9, 4:5 and stories. Free and private.",
    intro:
      "Draw a crop box over your image, move and resize it, or type exact coordinates. Aspect-ratio presets help you hit the shapes social networks and video thumbnails expect without guesswork. The crop is applied at full resolution — the on-screen preview is only scaled for display.",
    steps: ["Upload an image.", "Drag on the image to draw a crop area, or pick an aspect ratio and fine-tune X, Y, width and height.", "Choose the format and download."],
    notes: ["Works with touch screens: drag with your finger to draw and move the box.", "HEIC and AVIF sources are supported if your browser can decode them (HEIC via WebAssembly)."],
    faq: [
      { q: "Does cropping reduce quality?", a: "Pixels inside the crop are copied exactly. Saving as PNG keeps them lossless; JPEG and WebP apply compression at high quality (92%)." },
      { q: "How do I make a perfect square?", a: "Select the 1:1 preset; the box will keep a square shape while you drag." },
    ],
    keywords: ["crop image", "image cropper", "crop photo online", "crop to square"],
    related: ["image-resizer", "image-rotator", "aspect-ratio-calculator", "image-compressor"],
  }),
  image({
    id: "image-rotator",
    name: "Image Rotator",
    icon: "rotate",
    summary: "Rotate images 90°, 180° or by any custom angle, with transparent or solid corner fill. Batch processing in your browser.",
    intro:
      "Fix sideways phone photos, straighten a slightly tilted scan or rotate a whole batch of images at once. Quarter turns are lossless in pixel terms; custom angles expand the canvas so nothing is cut off, and you can choose how to fill the new corners.",
    steps: ["Choose a quick rotation or set a custom angle.", "Pick the output format (PNG keeps transparent corners).", "Drop images and download the rotated files."],
    notes: ["Images are first displayed using their EXIF orientation, so the rotation you choose applies to what you see on screen.", "Custom angles use high-quality interpolation, which slightly softens sharp edges."],
    faq: [
      { q: "Why is my photo sideways on some sites but not on my phone?", a: "Phones often store the photo unrotated plus an EXIF orientation flag. Some sites ignore the flag. Rotating here bakes the orientation into the pixels." },
      { q: "Can I rotate counter-clockwise?", a: "Yes, use “90° left” or a negative custom angle." },
    ],
    keywords: ["rotate image", "rotate photo", "image rotator", "rotate jpg"],
    related: ["image-flipper", "image-cropper", "image-resizer", "rotate-pdf"],
  }),
  image({
    id: "image-flipper",
    name: "Image Flipper",
    icon: "flip",
    summary: "Mirror images horizontally or flip them vertically in one click. Batch mode, any format, no upload needed.",
    intro:
      "Flip selfies that came out mirrored, create symmetric designs or prepare transfer prints that must be reversed. Horizontal flipping mirrors left and right; vertical flipping mirrors top and bottom. Choosing both is the same as a 180° rotation.",
    steps: ["Tick horizontal, vertical or both.", "Choose an output format.", "Drop your images and download."],
    notes: ["Text in the image will read backwards after a horizontal flip — that is expected.", "Flipping is a pixel-exact operation; PNG output is completely lossless."],
    faq: [
      { q: "Why are front-camera selfies mirrored?", a: "The camera preview behaves like a mirror, and some phones save the photo that way. A horizontal flip shows the scene as others see it." },
      { q: "What is the difference between flipping and rotating 180°?", a: "A vertical flip mirrors top and bottom only. Flipping both ways is identical to rotating 180°." },
    ],
    keywords: ["flip image", "mirror image", "flip photo horizontally", "mirror selfie"],
    related: ["image-rotator", "image-cropper", "image-resizer", "image-grayscale"],
  }),
  image({
    id: "image-grayscale",
    name: "Image to Grayscale",
    icon: "contrast",
    summary: "Convert color photos to black and white with adjustable strength, using perceptual luminance weights. Free and private.",
    intro:
      "Turn color images into grayscale for print, a classic black-and-white look or accessibility checks. The conversion uses Rec. 709 luminance weights (21% red, 72% green, 7% blue), which match how bright colors appear to the human eye better than a simple average.\n\nLower the strength slider for a muted, partially desaturated look.",
    steps: ["Set the strength (100% for full black and white).", "Choose the output format.", "Drop images and download the grayscale versions."],
    notes: ["The output is still saved as an RGB image with equal channels, which every app can open.", "For grayscale PDFs use the PDF Grayscale tool."],
    faq: [
      { q: "Is this the same as desaturating?", a: "Close, but desaturation in HSL averages the brightest and darkest channel, which can make greens look too dark. Luminance weighting keeps perceived brightness." },
      { q: "Can I undo it later?", a: "No — color information is discarded. Keep your original file." },
    ],
    keywords: ["grayscale image", "black and white photo", "convert image to grayscale", "desaturate image"],
    related: ["image-brightness", "image-contrast", "pdf-grayscale", "image-blur"],
  }),
  image({
    id: "image-blur",
    name: "Blur Image",
    icon: "droplets",
    summary: "Apply a smooth Gaussian-style blur to whole images with an adjustable radius. Ideal for backgrounds and placeholders.",
    intro:
      "Create soft backgrounds for text overlays, low-detail placeholder images or a dreamy effect. The blur uses three passes of a box filter, a well-known approximation of a Gaussian blur that produces smooth results and works identically in every browser — including Safari, which lacks canvas blur filters.\n\nProcessing runs in a background worker, so even large images don't freeze the page.",
    steps: ["Set the blur radius.", "Choose an output format.", "Drop your images and download the blurred results."],
    notes: ["This tool blurs the entire image. It is not a reliable way to hide faces or text partially; use an editor that blurs a selected area and verify the result.", "Very large radii on big images can take a few seconds."],
    faq: [
      { q: "Is blurring enough to hide sensitive information?", a: "Light blurring of text or license plates can sometimes be reversed or guessed. For redaction, cover the area with a solid box instead." },
      { q: "Why do edges look soft but not dark?", a: "The filter uses premultiplied alpha and edge clamping, avoiding the dark halos many simple blur implementations produce." },
    ],
    keywords: ["blur image", "gaussian blur online", "blur photo background"],
    related: ["image-brightness", "image-contrast", "image-grayscale", "image-compressor"],
  }),
  image({
    id: "image-brightness",
    name: "Image Brightness Adjuster",
    icon: "sun",
    summary: "Brighten dark photos or darken overexposed ones with a simple slider. Batch processing, any common format.",
    intro:
      "Quickly fix underexposed photos or tone down images that are too bright. The adjustment works like the CSS brightness() filter: every color channel is multiplied by the same factor, so hues stay true while the overall exposure changes.",
    steps: ["Move the slider: positive values brighten, negative values darken.", "Choose the output format.", "Drop your images and download."],
    notes: ["Highlights that are already pure white cannot be recovered by darkening.", "For flat-looking photos, combine a small brightness boost with the Contrast tool."],
    faq: [
      { q: "Will brightening add noise?", a: "It amplifies existing noise in dark areas. Moderate changes (±30%) usually look natural." },
      { q: "Can I process several photos with the same setting?", a: "Yes. Drop them all at once; changing the slider re-processes the whole list." },
    ],
    keywords: ["brighten image", "image brightness", "darken photo", "adjust exposure"],
    related: ["image-contrast", "image-grayscale", "image-blur", "image-compressor"],
  }),
  image({
    id: "image-contrast",
    name: "Image Contrast Adjuster",
    icon: "contrast",
    summary: "Increase or reduce image contrast to make photos punchier or softer. Works on batches, entirely in your browser.",
    intro:
      "Contrast controls the difference between light and dark areas. Increasing it makes washed-out photos and scanned documents crisper; reducing it creates a soft, faded look. The adjustment pivots around mid-gray, the same curve the CSS contrast() filter uses.",
    steps: ["Set the contrast change with the slider.", "Choose the output format.", "Drop images and download the adjusted versions."],
    notes: ["Strong increases clip shadows to black and highlights to white.", "For scanned text, +30% to +60% often improves legibility."],
    faq: [
      { q: "What is the difference between brightness and contrast?", a: "Brightness shifts all tones lighter or darker; contrast stretches or compresses tones around the middle." },
      { q: "Does it change colors?", a: "Saturation can appear stronger with more contrast because channel differences grow, but hue is preserved." },
    ],
    keywords: ["image contrast", "increase contrast", "adjust contrast photo"],
    related: ["image-brightness", "image-grayscale", "image-blur", "image-resizer"],
  }),
  image({
    id: "image-color-picker",
    name: "Image Color Picker",
    icon: "pipette",
    summary: "Pick exact HEX, RGB and HSL colors from any image, and see its dominant color palette. Works offline in your browser.",
    intro:
      "Upload a screenshot, logo or photo and click anywhere to read the exact color value. Hover to preview colors as you move, keep a history of picked colors and copy them in HEX, RGB or HSL. The tool also extracts the image's dominant colors, useful for building matching palettes.",
    steps: ["Upload an image.", "Hover to preview and click to pick a color.", "Copy the value in the format you need, or click a dominant color swatch."],
    notes: ["Very large images are displayed at up to 1600 px; picked values come from that scaled copy, which averages neighbouring pixels slightly.", "Colors from JPEG photos vary pixel to pixel because of compression and noise."],
    faq: [
      { q: "Can I pick colors from my screen outside the browser?", a: "Not from this page. Take a screenshot and upload it, or use the EyeDropper feature in Chrome/Edge developer tools." },
      { q: "How are dominant colors calculated?", a: "Pixels are grouped into color buckets and the most frequent buckets are averaged, ignoring transparent pixels." },
    ],
    keywords: ["image color picker", "get color from image", "hex color from image", "eyedropper online"],
    related: ["color-converter", "random-color-generator", "hex-to-rgb", "gradient-generator"],
  }),
  image({
    id: "image-dpi-checker",
    name: "Image DPI Checker",
    icon: "ruler",
    summary: "Check the DPI/PPI stored in JPG and PNG files, see print sizes at common resolutions and set the DPI of PNGs losslessly.",
    intro:
      "Print shops often ask for “300 DPI images”. DPI is just a number stored in the file telling software how large to print the pixels; what really matters is the pixel count. This checker reads the stored resolution from JFIF, EXIF or PNG pHYs data and shows how large the image will print at 72, 150, 300 and 600 DPI.\n\nFor PNG files you can also write a new DPI value without touching a single pixel.",
    steps: ["Drop a JPG or PNG image.", "Read the stored DPI and calculated print sizes.", "Optionally set a new DPI for PNG files and download."],
    notes: ["Changing the DPI value does not make an image sharper. To print larger at 300 DPI you need more pixels.", "Some apps ignore stored DPI entirely and use their own defaults (often 72 or 96)."],
    faq: [
      { q: "Is DPI the same as PPI?", a: "Strictly, PPI describes image pixels and DPI describes printer dots, but in file metadata the terms are used interchangeably." },
      { q: "How many pixels do I need for a 4×6 inch print at 300 DPI?", a: "1200 × 1800 pixels." },
    ],
    keywords: ["image dpi checker", "check dpi", "change dpi png", "300 dpi image", "ppi checker"],
    related: ["image-resizer", "image-metadata-viewer", "aspect-ratio-calculator", "pdf-page-size-checker"],
  }),
  image({
    id: "image-metadata-viewer",
    name: "Image Metadata (EXIF) Viewer",
    icon: "info",
    summary: "View EXIF, GPS, IPTC and XMP metadata in photos: camera, lens, exposure, date and location. Private and instant.",
    intro:
      "Photos carry hidden information: camera model, lens, shutter speed, aperture, ISO, editing software, the exact time — and often GPS coordinates of where they were taken. This viewer reads all of it locally and warns you clearly when a photo contains a location, so you can decide whether to share it.",
    steps: ["Drop a photo (JPG, HEIC, PNG, WebP, TIFF and more).", "Review the metadata table and any location warning.", "Export the metadata as JSON if needed."],
    notes: ["Many social networks strip metadata on upload, but messaging apps, email and cloud links often keep it.", "Screenshots and edited exports usually contain little metadata."],
    faq: [
      { q: "How do I remove the location before sharing?", a: "Use the EXIF Remover tool, which strips metadata from JPEG and PNG losslessly." },
      { q: "Can metadata be faked?", a: "Yes. Metadata is easy to edit, so it is evidence, not proof." },
    ],
    keywords: ["exif viewer", "image metadata", "photo metadata", "gps location photo", "exif data"],
    related: ["exif-remover", "image-dpi-checker", "heic-to-jpg", "pdf-metadata-viewer"],
  }),
  image({
    id: "exif-remover",
    name: "EXIF Remover",
    icon: "eye-off",
    popular: true,
    summary: "Remove EXIF, GPS and XMP metadata from photos before sharing. JPEG and PNG are cleaned losslessly — no quality loss.",
    intro:
      "Before you post a photo online or send it to a stranger, strip the hidden data that can reveal where you live, the device you own and when the picture was taken. For JPEG and PNG this tool removes metadata blocks directly from the file without re-compressing the image, so quality is untouched and the process is instant.\n\nOther formats such as WebP and HEIC are re-encoded, which also discards all metadata.",
    steps: ["Drop one or more photos.", "Check which metadata blocks were removed.", "Download the cleaned files."],
    notes: ["The color profile (ICC) is kept so colors look the same.", "Removing EXIF also removes the orientation flag: if a phone photo appears sideways afterwards, rotate it with the Image Rotator."],
    faq: [
      { q: "How can I check that it worked?", a: "Open the cleaned file in the Image Metadata Viewer — it should report no EXIF or GPS data." },
      { q: "Does this remove hidden watermarks?", a: "No. Metadata removal does not affect invisible watermarks embedded in the pixels themselves." },
    ],
    keywords: ["remove exif", "exif remover", "remove gps from photo", "strip metadata", "remove location from photo"],
    related: ["image-metadata-viewer", "image-compressor", "heic-to-jpg", "pdf-metadata-viewer"],
  }),
  image({
    id: "image-to-base64",
    name: "Image to Base64 Converter",
    icon: "binary",
    summary: "Convert images to Base64 data URIs, CSS backgrounds, HTML img tags or Markdown. Shows size overhead. No upload.",
    intro:
      "Embedding small icons and placeholders directly into HTML, CSS or JSON avoids extra HTTP requests and is handy for email templates and single-file demos. This converter encodes any image as Base64 and formats it the way you need.",
    steps: ["Drop an image (up to 10 MB).", "Choose data URI, raw Base64, <img>, CSS or Markdown.", "Copy the output."],
    notes: ["Base64 adds about 33% to the file size and the result cannot be cached separately, so inline only small images (under ~10–20 KB).", "Some email clients block data-URI images; test before sending."],
    faq: [
      { q: "How do I convert Base64 back to an image?", a: "Paste the data URI into the Base64 Decoder and use “Download file”." },
      { q: "Should I inline SVG as Base64?", a: "SVG can usually be inlined as URL-encoded text instead, which is smaller than Base64." },
    ],
    keywords: ["image to base64", "base64 image encoder", "data uri generator", "png to base64"],
    related: ["base64-encoder", "base64-decoder", "image-compressor", "svg-to-png"],
  }),
];
