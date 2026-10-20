import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { TOOL_BY_ID } from "@/tools/registry";
import { ActionButton } from "@/components/admin/Form";
import { revertRevisionAction } from "../../../actions";

export const metadata = { title: "SEO history" };

const show = (v: unknown) => {
  if (v === null || v === undefined) return <em className="text-muted">default</em>;
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 180 ? s.slice(0, 180) + "…" : s;
};

export default async function SeoHistory({ searchParams }: { searchParams: Promise<{ tool?: string; page?: string }> }) {
  await requirePageUser("editSeo");
  const { tool, page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const where = tool ? { toolId: tool } : {};
  const [revs, total] = await Promise.all([
    prisma.seoRevision.findMany({ where, orderBy: { createdAt: "desc" }, skip: (p - 1) * 50, take: 50, include: { user: { select: { email: true } } } }),
    prisma.seoRevision.count({ where }),
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">SEO history {tool && <span className="text-muted text-base font-normal">· {TOOL_BY_ID.get(tool)?.name}</span>}</h1>
      <p className="text-muted text-sm">Every SEO change is stored with who made it, when, and the old and new value. Reverting creates a new entry, so nothing is ever lost.</p>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs"><tr><th className="px-3 py-2">When / who</th><th className="px-3 py-2">Tool / field</th><th className="px-3 py-2">Old value</th><th className="px-3 py-2">New value</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {revs.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)] align-top">
                <td className="px-3 py-2 text-xs"><p className="tabular-nums">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</p><p className="text-muted">{r.user?.email ?? "unknown"}</p>{r.note && <p className="text-muted italic">{r.note}</p>}</td>
                <td className="px-3 py-2 text-xs"><Link href={`/admin/tools/${r.toolId}`} className="font-semibold hover:underline">{TOOL_BY_ID.get(r.toolId)?.name ?? r.toolId}</Link><p className="font-mono">{r.field}</p></td>
                <td className="max-w-xs px-3 py-2 text-xs break-words text-red-700 dark:text-red-300">{show(r.oldValue)}</td>
                <td className="max-w-xs px-3 py-2 text-xs break-words text-emerald-700 dark:text-emerald-300">{show(r.newValue)}</td>
                <td className="space-y-1 px-3 py-2">
                  <ActionButton action={revertRevisionAction} fields={{ revisionId: r.id }} label="Revert" confirm="Restore the old value of this field?" />
                  {r.batchId && <ActionButton action={revertRevisionAction} fields={{ batchId: r.batchId }} label="Revert batch" variant="ghost" confirm="Revert every change made in this batch?" />}
                </td>
              </tr>
            ))}
            {!revs.length && <tr><td colSpan={5} className="text-muted px-3 py-6 text-center">No SEO changes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {p > 1 && <Link className="btn btn-secondary btn-sm" href={`?${new URLSearchParams({ ...(tool ? { tool } : {}), page: String(p - 1) })}`}>← Newer</Link>}
        {p * 50 < total && <Link className="btn btn-secondary btn-sm" href={`?${new URLSearchParams({ ...(tool ? { tool } : {}), page: String(p + 1) })}`}>Older →</Link>}
      </div>
    </div>
  );
}
