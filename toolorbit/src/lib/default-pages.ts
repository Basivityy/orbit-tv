/**
 * Default content for static pages. Editable in Admin → Content.
 * Placeholders: {{siteName}}, {{contactEmail}}, {{siteUrl}}, {{toolCount}}, {{date}}.
 * The privacy policy and terms are a sound starting point but must be reviewed
 * by the site owner (ideally with legal counsel) before launch.
 */
export interface DefaultPage {
  slug: string;
  title: string;
  metaDescription: string;
  body: string;
}

export const DEFAULT_PAGES: DefaultPage[] = [
  {
    slug: "about",
    title: "About {{siteName}}",
    metaDescription: "{{siteName}} offers {{toolCount}} free online tools that run in your browser — fast, private and without sign-up.",
    body: `{{siteName}} is a collection of {{toolCount}} free online tools for working with images, PDFs, text, code, numbers and everyday calculations.

## Built to be fast and private

Most online converters upload your files to a server, process them there and send them back. We designed {{siteName}} the other way around: the vast majority of our tools run **entirely in your browser** using modern web technologies such as Web Workers, the Canvas API and WebAssembly. Your photos, contracts and data never leave your device, and you don't wait for uploads.

A few tools by nature need a server — for example *What Is My IP* can only learn your public address from the network request itself. Those tools say so clearly on their page.

## Honest tools

Every tool explains what it does, how to use it and what its limitations are. If a browser can't do something (for example, cracking a PDF password or reading third-party cookies), we tell you rather than pretending.

## Free to use

All tools are free and need no account. The site is supported by advertising that is kept away from tool controls and results.

Have a suggestion or found a bug? [Contact us](/contact).`,
  },
  {
    slug: "contact",
    title: "Contact",
    metaDescription: "Contact the {{siteName}} team with questions, bug reports, tool suggestions or business inquiries.",
    body: `We'd love to hear from you — whether you found a bug, have an idea for a new tool or a business inquiry.

**Email:** [{{contactEmail}}](mailto:{{contactEmail}})

When reporting a problem with a tool, please include:

- the tool's address (URL),
- your browser and version (our [What Is My Browser](/tools/browser-information) tool can copy a report for you),
- what you expected and what happened instead.

Please **do not** send us the private files you were processing. Our tools run in your browser, so we never need your documents to investigate an issue.

We usually reply within two business days.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    metaDescription: "How {{siteName}} handles your data: browser-based processing, minimal analytics, cookies and advertising.",
    body: `*Last updated: {{date}}*

This Privacy Policy explains what information {{siteName}} ("we", "us") collects when you use {{siteUrl}} (the "Site"), how we use it and the choices you have.

## 1. Files and text you process

Most tools on the Site process your files and text **locally in your web browser**. This content is not uploaded to our servers, and we cannot see, store or recover it. Tools that need a network request (such as *What Is My IP*) state this on their page; they do not store the result.

## 2. Information collected automatically

- **Server logs.** Like any website, our web servers and our content delivery network (Cloudflare) process technical data such as IP address, browser type and requested pages to deliver and protect the Site. Logs are kept for a limited period for security and troubleshooting.
- **Aggregated usage statistics.** We count page views and tool usage per day as anonymous totals (for example "Merge PDF was used 120 times today"). These counters contain no IP addresses, cookies or identifiers.
- **Error reports.** If a tool crashes, your browser may send us a short technical error message and the page address so we can fix the bug. It never includes your files or input.

## 3. Cookies and similar technologies

We do not need cookies to provide the tools. Some browser storage is used only on your device, for example to remember your theme, favourite tools and recently used tools.

**Advertising.** The Site may display ads served by Google AdSense. Google and its partners may use cookies or similar technologies to serve ads based on your prior visits to this and other websites, and to measure ads. Google's use of advertising cookies enables it and its partners to serve ads based on your visits.

- Learn how Google uses information: [How Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites).
- You can opt out of personalised advertising in [Google Ads Settings](https://adssettings.google.com) or via [www.aboutads.info](https://www.aboutads.info/choices) and [youronlinechoices.eu](https://www.youronlinechoices.eu/).

Where required by law (for example in the EEA, the UK and Switzerland) we ask for your consent before personalised ads or non-essential cookies are used. You can change your choice at any time using the "Cookie settings" link in the footer.

## 4. Legal bases (EEA/UK)

We process technical data based on our legitimate interest in operating and securing the Site, and advertising cookies based on your consent where consent is required.

## 5. Your rights

Depending on where you live, you may have rights to access, correct, delete or object to the processing of personal data, and to withdraw consent. Residents of California may have rights under the CCPA/CPRA, including the right to opt out of the "sale" or "sharing" of personal information for cross-context behavioural advertising — use the cookie settings to refuse personalised ads. Contact us at {{contactEmail}} to exercise your rights.

## 6. Children

The Site is not directed to children under 13 (or under 16 in the EEA), and we do not knowingly collect their personal information.

## 7. Security

We use HTTPS everywhere, security headers and access controls. No method of transmission over the internet is 100% secure, but because tools run locally, your files are never exposed to our servers in the first place.

## 8. Changes

We may update this policy. The "Last updated" date shows the latest version.

## 9. Contact

Questions? Email [{{contactEmail}}](mailto:{{contactEmail}}).`,
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    metaDescription: "The terms that apply when you use the free online tools on {{siteName}}.",
    body: `*Last updated: {{date}}*

By using {{siteName}} at {{siteUrl}} (the "Site") you agree to these Terms.

## 1. The service

The Site provides free online tools. Most tools run in your browser; results depend on your device, browser and the files you provide.

## 2. Acceptable use

You agree not to:

- use the Site for unlawful purposes or to process content you have no right to process;
- attempt to disrupt, overload, scrape at scale or gain unauthorised access to the Site or its infrastructure;
- remove protection from documents you are not authorised to access.

## 3. No warranty

The Site and tools are provided **"as is" and "as available"** without warranties of any kind. Calculators provide estimates for information only and are not financial, legal, tax or medical advice. Always keep a copy of your original files.

## 4. Limitation of liability

To the maximum extent permitted by law, {{siteName}} is not liable for any indirect, incidental or consequential damages, or for loss of data, profits or business arising from your use of the Site.

## 5. Third-party content and advertising

The Site may show third-party advertisements and links. We are not responsible for third-party websites or products.

## 6. Intellectual property

The Site's design, text and code are owned by {{siteName}} or its licensors. Open-source components are used under their respective licences. You keep all rights to the content you process.

## 7. Changes and termination

We may change or discontinue tools at any time and update these Terms. Continued use after changes means you accept the updated Terms.

## 8. Contact

Questions about these Terms: [{{contactEmail}}](mailto:{{contactEmail}}).`,
  },
  {
    slug: "faq",
    title: "Frequently Asked Questions",
    metaDescription: "Answers to common questions about {{siteName}}: privacy, file limits, supported browsers and pricing.",
    body: `## Are the tools really free?

Yes. All tools are free to use without an account. The Site is funded by advertising.

## Are my files uploaded?

For almost all tools, no. Images, PDFs and text are processed in your browser. Each tool page says how it works; tools that need the network (like *What Is My IP*) say so.

## Is there a file size limit?

Limits depend on the tool and your device's memory. Image tools accept files up to 50 MB (100 megapixels); PDF tools up to 200 MB per file. Large files on older phones may take longer.

## Which browsers are supported?

Current versions of Chrome, Edge, Firefox and Safari on desktop and mobile. A few features depend on newer browser capabilities and say so when unavailable.

## Do the tools work offline?

Once a tool page has loaded, most tools keep working without an internet connection until you reload the page.

## How do I report a bug or suggest a tool?

Email [{{contactEmail}}](mailto:{{contactEmail}}) — see our [contact page](/contact).`,
  },
];

export function fillPlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}
