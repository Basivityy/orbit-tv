import Link from "next/link";
import { getCatalog } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { seoIssues } from "@/lib/seo-service";

export const metadata = { title: "SEO manager" };

export default async function SeoManager({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string }> }) {
  await requirePageUser("editSeo");
  const { filter, q } = await searchParams;
  const catalog = await getCatalog();
  let tools = catalog.tools.map((t) => ({ t, issues: seoIssues(t) }));
  if (filter === "issues") tools = tools.filter((x) => x.issues.length);
  if (filter === "noindex") tools = tools.filter((x) => !x.t.seo.robotsIndex);
  if (q) tools = tools.filter((x) => x.t.name.toLowerCase().includes(q.toLowerCase()));
  const totalIssues = catalog.tools.filter((t) => seoIssues(t).length).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">SEO manager</h1>
        <div className="flex gap-2">
          <Link href="/admin/seo/bulk" className="btn btn-primary btn-sm">Bulk editor</Link>
          <Link href="/admin/seo/history" className="btn btn-secondary btn-sm">History</Link>
          <a href="/sitemap.xml" target="_blank" className="btn btn-secondary btn-sm">sitemap.xml ↗</a>
          <a href="/robots.txt" target="_blank" className="btn btn-secondary btn-sm">robots.txt ↗</a>
        </div>
      </div>
      <form method="get" className="flex flex-wrap gap-2">
        <input className="field max-w-xs" name="q" defaultValue={q} placeholder="Search tools" />
        <select className="field max-w-xs" name="filter" defaultValue={filter ?? ""}>
          <option value="">All tools</option><option value="issues">With issues ({totalIssues})</option><option value="noindex">noindex</option>
        </select>
        <button className="btn btn-secondary">Apply</button>
      </form>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs"><tr><th className="px-3 py-2">Tool / title</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Index</th><th className="px-3 py-2">Checks</th><th /></tr></thead>
          <tbody>
            {tools.map(({ t, issues }) => (
              <tr key={t.id} className="border-t border-[var(--border)] align-top">
                <td className="max-w-xs px-3 py-2"><p className="font-semibold">{t.name}</p><p className="text-muted text-xs">{t.seo.title} <span className="font-mono">({t.seo.title.length})</span></p></td>
                <td className="text-muted max-w-sm px-3 py-2 text-xs">{t.seo.metaDescription} <span className="font-mono">({t.seo.metaDescription.length})</span></td>
                <td className="px-3 py-2 text-xs">{t.seo.robotsIndex ? "index" : <span className="font-semibold text-red-600">noindex</span>}</td>
                <td className="px-3 py-2 text-xs">{issues.length ? <span className="text-amber-600">{issues.join("; ")}</span> : <span className="text-emerald-600">OK</span>}</td>
                <td className="px-3 py-2"><Link href={`/admin/tools/${t.id}#seo`} className="btn btn-secondary btn-sm">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
