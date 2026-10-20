import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { ActionButton, AdminForm, Card, Input, SubmitButton } from "@/components/admin/Form";
import { createRedirectAction, deleteRedirectAction, toggleRedirectAction } from "../../actions";

export const metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  await requirePageUser("manageRedirects");
  const rows = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Redirect manager</h1>
      <Card title="Add or update a redirect" description="301 = permanent (passes SEO value). 302 = temporary. Changes are active within 60 seconds.">
        <AdminForm action={createRedirectAction} resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px]">
                <Input label="From path" name="fromPath" placeholder="/old-page" required />
                <Input label="To (path or URL)" name="toPath" placeholder="/tools/new-page" required />
                <label className="block"><span className="label">Type</span><select className="field" name="statusCode"><option value="301">301</option><option value="302">302</option></select></label>
              </div>
              <div className="mt-3"><Input label="Note (optional)" name="note" /></div>
              <div className="mt-3"><SubmitButton>Save redirect</SubmitButton></div>
        </AdminForm>
      </Card>
      <div className="surface overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs"><tr><th className="px-3 py-2">From</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Hits</th><th className="px-3 py-2">Note</th><th className="px-3 py-2" /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-[var(--border)] ${r.enabled ? "" : "opacity-50"}`}>
                <td className="px-3 py-2 font-mono text-xs">{r.fromPath}</td>
                <td className="px-3 py-2 font-mono text-xs break-all">{r.toPath}</td>
                <td className="px-3 py-2">{r.statusCode}</td>
                <td className="px-3 py-2 tabular-nums">{r.hits}</td>
                <td className="text-muted px-3 py-2 text-xs">{r.note}</td>
                <td className="space-x-1 px-3 py-2 whitespace-nowrap">
                  <ActionButton action={toggleRedirectAction} fields={{ id: r.id, enabled: String(!r.enabled) }} label={r.enabled ? "Disable" : "Enable"} />
                  <ActionButton action={deleteRedirectAction} fields={{ id: r.id }} label="Delete" variant="danger" confirm={`Delete redirect ${r.fromPath}?`} />
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="text-muted px-3 py-6 text-center">No redirects yet. Tool slug changes create them automatically.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
