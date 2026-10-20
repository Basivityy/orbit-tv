import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { ActionButton } from "@/components/admin/Form";
import { clearErrorsAction } from "../../actions";

export const metadata = { title: "System errors" };

export default async function ErrorsPage() {
  await requirePageUser("viewAudit");
  const rows = await prisma.errorLog.findMany({ orderBy: { lastSeen: "desc" }, take: 200 });
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">System errors</h1>{rows.length > 0 && <ActionButton action={clearErrorsAction} fields={{}} label="Clear all" variant="danger" confirm="Delete all error entries?" />}</div>
      <p className="text-muted text-sm">Client errors come from crashed tools in visitors&apos; browsers (no personal data or file contents). Identical errors within an hour are grouped.</p>
      <div className="space-y-2">
        {rows.map((e) => (
          <details key={e.id} className="surface rounded-xl px-4 py-3">
            <summary className="cursor-pointer text-sm"><span className="chip mr-2">{e.source}</span><strong>{e.message}</strong> <span className="text-muted">×{e.count} · {e.path} · last {e.lastSeen.toISOString().replace("T", " ").slice(0, 16)}</span></summary>
            {e.stack && <pre className="bg-surface-2 mt-2 max-h-64 overflow-auto rounded-lg p-2 text-xs">{e.stack}</pre>}
            {e.userAgent && <p className="text-muted mt-1 font-mono text-xs">{e.userAgent}</p>}
          </details>
        ))}
        {!rows.length && <p className="text-muted">No errors recorded.</p>}
      </div>
    </div>
  );
}
