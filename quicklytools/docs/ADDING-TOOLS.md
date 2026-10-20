# Adding a new tool

The architecture scales to 500+ tools without redesign: each tool is a registry entry + content + a component in its category chunk. Typical simple tools reuse an engine and need ~20 lines.

## 1. Logic (pure, testable)

Put non-UI logic in `src/tools/logic/<area>.ts` and add unit tests in `tests/unit/`.

## 2. UI

Add a component to `src/tools/impl/<category>.tsx` and register it in that file's default export map with the tool id:

```tsx
const MyTool = () => <TextTransformTool transform={(t) => myFn(t)} sample="…" />;
// …
"my-tool": MyTool,
```

Reusable engines:

| Engine | For |
|---|---|
| `TextTransformTool` | input → output text transforms, options, file open, download |
| `TextStatsTool` | live statistics over text |
| `FormCalculator` | validated numeric/date forms → stats + optional table + formula |
| `ImageBatch` | image in → processed image out, batch + ZIP, worker pipeline |
| `kit.tsx` | FileDrop, CopyButton, DownloadButton, StatGrid, DataTable, KeyValueList… |

Rules: process files locally; enforce size limits; show errors with `ErrorBox`; call `useReportUse()` when the user performs the main action; import heavy libraries with `await import()`; be explicit about browser limitations.

If a tool needs a new category, add it to `src/tools/categories.ts`, the `CategoryId` union and `src/tools/loaders.ts`.

## 3. Content & metadata

Add an entry to `src/tools/content/<category>.ts` (id = permanent URL slug):

* `summary` (≤160 chars, unique), `intro` (≥35 words, unique), `steps`, `notes` (honest limitations), `faq` (≥2), `keywords`, `related`, `icon` (key from `src/components/icons.tsx`), `processing` (`browser`, `server` or `network`).

`tests/unit/registry.test.ts` enforces uniqueness, minimum content and that every registry entry has an implementation.

## 4. Verify & deploy

```bash
npm run typecheck && npm run lint && npm test && npm run build
BASE_URL=http://localhost:3000 npx playwright test tests/e2e/all-tools.spec.ts -g my-tool
./scripts/update.sh   # on the server
```

The new page appears in the sitemap, search and category automatically; admins can then tune its name, SEO and placement without code.
