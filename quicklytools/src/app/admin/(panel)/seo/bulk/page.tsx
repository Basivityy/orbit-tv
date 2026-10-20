import { getCatalog } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { SEO_FIELDS } from "@/lib/seo-service";
import { BulkEditor } from "./BulkEditor";

export const metadata = { title: "Bulk SEO editor" };

export default async function BulkPage() {
  await requirePageUser("editSeo");
  const catalog = await getCatalog();
  const fields = Object.entries(SEO_FIELDS)
    .filter(([k]) => !["slug", "faq", "internalLinks"].includes(k))
    .map(([k, v]) => ({ key: k, label: v.label, kind: v.kind }));
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Bulk SEO editor</h1>
      <p className="text-muted text-sm">Select tools, choose a field and a value or template, preview every change, then publish. Each publish is one revertible batch in SEO history.</p>
      <BulkEditor tools={catalog.tools.map((t) => ({ id: t.id, name: t.name, category: t.category }))} categories={catalog.categories.map((c) => ({ id: c.id, name: c.name }))} fields={fields} />
    </div>
  );
}
