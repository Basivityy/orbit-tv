import Link from "next/link";
import { getCatalog, getSettings } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_PAGES } from "@/lib/default-pages";
import { Card } from "@/components/admin/Form";
import { FooterForm, HomeForm, NavForm, SiteForm } from "./SettingsForms";

export const metadata = { title: "Content" };

export default async function ContentPage() {
  await requirePageUser("editContent");
  const [s, catalog, pages] = await Promise.all([getSettings(), getCatalog(), prisma.sitePage.findMany({ select: { slug: true, updatedAt: true, published: true } })]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Content manager</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pages" description="About, contact, legal pages and FAQ.">
          <ul className="divide-y divide-[var(--border)]">
            {DEFAULT_PAGES.map((p) => {
              const row = pages.find((x) => x.slug === p.slug);
              return (
                <li key={p.slug} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span><span className="font-semibold">/{p.slug}</span> <span className="text-muted">{row ? `edited ${row.updatedAt.toISOString().slice(0, 10)}${row.published ? "" : " · unpublished"}` : "default text"}</span></span>
                  <Link href={`/admin/content/pages/${p.slug}`} className="btn btn-secondary btn-sm">Edit</Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="Categories" description="Names, descriptions, intro text and SEO for category pages.">
          <Link href="/admin/content/categories" className="btn btn-secondary">Edit categories</Link>
        </Card>
      </div>
      <SiteForm value={s.site} />
      <HomeForm value={s.home} tools={catalog.tools.map((t) => ({ id: t.id, name: t.name }))} />
      <NavForm value={s.nav} />
      <FooterForm value={s.footer} />
    </div>
  );
}
