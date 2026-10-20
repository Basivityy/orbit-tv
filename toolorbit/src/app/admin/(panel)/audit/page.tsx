import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";

export const metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePageUser("viewAudit");
  const p = Math.max(1, Number((await searchParams).page) || 1);
  const [rows, total] = await Promise.all([prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (p - 1) * 100, take: 100, include: { user: { select: { email: true } } } }), prisma.auditLog.count()]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left"><tr><th className="px-3 py-2">Time (UTC)</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Entity</th><th className="px-3 py-2">IP</th><th className="px-3 py-2">Details</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--border)] align-top">
                <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{r.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="px-3 py-1.5">{r.user?.email ?? "—"}</td>
                <td className="px-3 py-1.5 font-semibold">{r.action}</td>
                <td className="px-3 py-1.5 font-mono">{[r.entity, r.entityId].filter(Boolean).join(":")}</td>
                <td className="px-3 py-1.5 font-mono">{r.ip}</td>
                <td className="text-muted max-w-md px-3 py-1.5 font-mono break-all">{r.details ? JSON.stringify(r.details).slice(0, 300) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        {p > 1 && <Link className="btn btn-secondary btn-sm" href={`?page=${p - 1}`}>← Newer</Link>}
        {p * 100 < total && <Link className="btn btn-secondary btn-sm" href={`?page=${p + 1}`}>Older →</Link>}
      </div>
    </div>
  );
}
