import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCatalog } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { seoIssues } from "@/lib/seo-service";
import { Card } from "@/components/admin/Form";

export const metadata = { title: "Dashboard" };

function daysAgo(n: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  await requirePageUser();
  const { denied } = await searchParams;
  const catalog = await getCatalog();
  const since30 = daysAgo(29);
  const [daily, topViews, topUses, errors24, latestErrors, recentAudit] = await Promise.all([
    prisma.dailyStat.groupBy({ by: ["date", "kind"], where: { date: { gte: since30 } }, _sum: { count: true }, orderBy: { date: "asc" } }),
    prisma.dailyStat.groupBy({ by: ["key"], where: { kind: "view", date: { gte: since30 } }, _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 10 }),
    prisma.dailyStat.groupBy({ by: ["key"], where: { kind: "use", date: { gte: since30 } }, _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 10 }),
    prisma.errorLog.aggregate({ where: { lastSeen: { gte: new Date(Date.now() - 86400_000) } }, _sum: { count: true } }),
    prisma.errorLog.findMany({ orderBy: { lastSeen: "desc" }, take: 5 }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { email: true } } } }),
  ]);

  const total = catalog.tools.length;
  const active = catalog.tools.filter((t) => t.enabled).length;
  const withIssues = catalog.tools.filter((t) => t.enabled && seoIssues(t).length > 0);
  const noindex = catalog.tools.filter((t) => !t.seo.robotsIndex).length;
  const nameOf = (key: string) => catalog.tools.find((t) => t.id === key)?.name ?? key;

  const days = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i).toISOString().slice(0, 10));
  const series = days.map((d) => ({
    d,
    views: daily.find((r) => r.kind === "view" && r.date.toISOString().slice(0, 10) === d)?._sum.count ?? 0,
    uses: daily.find((r) => r.kind === "use" && r.date.toISOString().slice(0, 10) === d)?._sum.count ?? 0,
  }));
  const max = Math.max(1, ...series.map((s) => s.views));
  const views30 = series.reduce((s, x) => s + x.views, 0);
  const uses30 = series.reduce((s, x) => s + x.uses, 0);
  const viewsToday = series[series.length - 1].views;

  const stat = (label: string, value: string | number, hint?: string, href?: string) => (
    <div className="surface rounded-2xl p-4">
      <p className="text-muted text-xs font-semibold">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{href ? <Link href={href} className="hover:text-brand-600">{value}</Link> : value}</p>
      {hint && <p className="text-muted mt-0.5 text-xs">{hint}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {denied && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">Your role does not have access to that page.</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Total tools", total, `${catalog.categories.length} categories`, "/admin/tools")}
        {stat("Active tools", active, `${total - active} deactivated`, "/admin/tools?status=disabled")}
        {stat("Page views (30 days)", views30.toLocaleString("en-US"), `${viewsToday.toLocaleString("en-US")} today`)}
        {stat("Tool uses (30 days)", uses30.toLocaleString("en-US"), "Actions such as convert, copy, download")}
        {stat("SEO issues", withIssues.length, `${noindex} tool(s) set to noindex`, "/admin/seo?filter=issues")}
        {stat("Errors (24 h)", errors24._sum.count ?? 0, "Client and server", "/admin/errors")}
      </div>

      <Card title="Traffic, last 30 days" description="Aggregated daily counts. No personal data is stored.">
        <div className="flex h-40 items-end gap-1" role="img" aria-label="Daily page views bar chart">
          {series.map((s) => (
            <div key={s.d} className="group relative flex-1" title={`${s.d}: ${s.views} views, ${s.uses} uses`}>
              <div className="rounded-t bg-brand-500/80 transition group-hover:bg-brand-600" style={{ height: `${(s.views / max) * 150}px`, minHeight: s.views ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="text-muted mt-1 flex justify-between text-[10px]"><span>{days[0]}</span><span>{days[29]}</span></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Most viewed tools (30 days)">
          {topViews.length ? (
            <ol className="space-y-1.5 text-sm">
              {topViews.map((r, i) => (
                <li key={r.key} className="flex justify-between gap-3"><span className="truncate">{i + 1}. {nameOf(r.key)}</span><span className="tabular-nums font-semibold">{r._sum.count}</span></li>
              ))}
            </ol>
          ) : <p className="text-muted text-sm">No data yet.</p>}
        </Card>
        <Card title="Most used tools (30 days)">
          {topUses.length ? (
            <ol className="space-y-1.5 text-sm">
              {topUses.map((r, i) => (
                <li key={r.key} className="flex justify-between gap-3"><span className="truncate">{i + 1}. {nameOf(r.key)}</span><span className="tabular-nums font-semibold">{r._sum.count}</span></li>
              ))}
            </ol>
          ) : <p className="text-muted text-sm">No data yet.</p>}
        </Card>
        <Card title="SEO status" actions={<Link href="/admin/seo" className="btn btn-secondary btn-sm">Open SEO manager</Link>}>
          <p className="text-sm">{active - withIssues.length} of {active} active tools have no detected issues.</p>
          <ul className="text-muted mt-2 space-y-1 text-sm">
            {withIssues.slice(0, 6).map((t) => (
              <li key={t.id}><Link href={`/admin/tools/${t.id}#seo`} className="font-medium text-[var(--text)] hover:underline">{t.name}</Link>: {seoIssues(t).join(", ")}</li>
            ))}
          </ul>
        </Card>
        <Card title="Latest system errors" actions={<Link href="/admin/errors" className="btn btn-secondary btn-sm">All errors</Link>}>
          {latestErrors.length ? (
            <ul className="space-y-2 text-sm">
              {latestErrors.map((e) => (
                <li key={e.id} className="truncate"><span className="chip mr-2">{e.source}</span>{e.message} <span className="text-muted">×{e.count}</span></li>
              ))}
            </ul>
          ) : <p className="text-muted text-sm">No errors recorded. 🎉</p>}
        </Card>
      </div>

      <Card title="Recent admin activity">
        <ul className="space-y-1.5 text-sm">
          {recentAudit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3"><span className="text-muted tabular-nums">{a.createdAt.toISOString().replace("T", " ").slice(0, 16)}</span><span className="font-medium">{a.action}</span><span className="text-muted">{a.entityId ?? ""}</span><span className="text-muted">{a.user?.email ?? "system"}</span></li>
          ))}
          {!recentAudit.length && <li className="text-muted">No activity yet.</li>}
        </ul>
      </Card>
    </div>
  );
}
