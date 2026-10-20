import Link from "next/link";
import { getCatalog } from "@/lib/data";
import { can, requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ToolIcon } from "@/components/icons";
import { ActionButton } from "@/components/admin/Form";
import { quickToggleToolAction, refreshCachesAction } from "../../actions";

export const metadata = { title: "Tools" };

export default async function ToolsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string }> }) {
  const user = await requirePageUser("editSeo");
  const sp = await searchParams;
  const catalog = await getCatalog();
  const since = new Date(Date.now() - 30 * 86400_000);
  const views = await prisma.dailyStat.groupBy({ by: ["key"], where: { kind: "view", date: { gte: since } }, _sum: { count: true } });
  const viewMap = new Map(views.map((v) => [v.key, v._sum.count ?? 0]));
  const q = (sp.q ?? "").toLowerCase().trim();
  const tools = catalog.tools.filter(
    (t) =>
      (!q || t.name.toLowerCase().includes(q) || t.id.includes(q) || t.slug.includes(q)) &&
      (!sp.category || t.category === sp.category) &&
      (!sp.status || (sp.status === "disabled" ? !t.enabled : sp.status === "popular" ? t.popular : sp.status === "hidden" ? !t.searchVisible : t.enabled)),
  );
  const manage = can(user.role, "manageTools");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Tools <span className="text-muted text-base font-normal">({tools.length} of {catalog.tools.length})</span></h1>
        {manage && <ActionButton action={refreshCachesAction} fields={{}} label="Refresh all caches" />}
      </div>
      <form className="surface flex flex-wrap items-end gap-3 rounded-2xl p-4" method="get">
        <label className="min-w-56 flex-1"><span className="label">Search</span><input className="field" name="q" defaultValue={sp.q} placeholder="Name, id or slug" /></label>
        <label><span className="label">Category</span>
          <select className="field" name="category" defaultValue={sp.category ?? ""}>
            <option value="">All</option>
            {catalog.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label><span className="label">Status</span>
          <select className="field" name="status" defaultValue={sp.status ?? ""}>
            <option value="">Any</option><option value="active">Active</option><option value="disabled">Deactivated</option><option value="popular">Popular</option><option value="hidden">Hidden from search</option>
          </select>
        </label>
        <button className="btn btn-primary">Filter</button>
      </form>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs">
            <tr><th className="px-3 py-2">Tool</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Order</th><th className="px-3 py-2">Views 30d</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Popular</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ToolIcon name={t.icon} className="h-4 w-4 text-brand-600" />
                    <div>
                      <Link href={`/admin/tools/${t.id}`} className="font-semibold hover:underline">{t.name}</Link>
                      <p className="text-muted font-mono text-xs">/tools/{t.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">{catalog.categories.find((c) => c.id === t.category)?.name}</td>
                <td className="px-3 py-2 tabular-nums">{t.order}</td>
                <td className="px-3 py-2 tabular-nums">{viewMap.get(t.id) ?? 0}</td>
                <td className="px-3 py-2">
                  {manage ? (
                    <ActionButton action={quickToggleToolAction} fields={{ toolId: t.id, field: "enabled", value: String(!t.enabled) }} label={t.enabled ? "Active" : "Deactivated"} variant={t.enabled ? "secondary" : "danger"} />
                  ) : t.enabled ? "Active" : "Deactivated"}
                </td>
                <td className="px-3 py-2">
                  {manage ? <ActionButton action={quickToggleToolAction} fields={{ toolId: t.id, field: "popular", value: String(!t.popular) }} label={t.popular ? "★ Popular" : "☆"} variant="ghost" /> : t.popular ? "★" : ""}
                </td>
                <td className="px-3 py-2 text-right"><Link href={`/admin/tools/${t.id}`} className="btn btn-secondary btn-sm">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-xs">Adding a completely new type of tool requires implementing it in code (src/tools) and deploying. Existing tools can be renamed, recategorised, reordered, hidden and fully re-optimised for SEO here.</p>
    </div>
  );
}
