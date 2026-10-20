import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { DEFAULT_PAGES } from "@/lib/default-pages";
import { ActionButton, AdminForm, Card, SubmitButton, Toggle } from "@/components/admin/Form";
import { resetPageAction, savePageAction } from "../../../../actions";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  await requirePageUser("editContent");
  const { slug } = await params;
  const def = DEFAULT_PAGES.find((p) => p.slug === slug);
  if (!def) notFound();
  const row = await prisma.sitePage.findUnique({ where: { slug } });
  const p = row ?? { ...def, published: true };
  return (
    <div className="space-y-5">
      <Link href="/admin/content" className="text-muted text-sm hover:underline">← Content</Link>
      <h1 className="text-2xl font-bold">/{slug}</h1>
      <Card title="Page content" description="Markdown. Placeholders: {{siteName}}, {{contactEmail}}, {{siteUrl}}, {{toolCount}}, {{date}} (last update)." actions={row ? <ActionButton action={resetPageAction} fields={{ slug }} label="Restore default text" confirm="Discard your edits and restore the default text?" /> : undefined}>
        <AdminForm action={savePageAction}>
          <input type="hidden" name="slug" value={slug} />
          <div className="grid gap-4">
            <label className="block"><span className="label">Title</span><input className="field" name="title" defaultValue={p.title} required maxLength={120} /></label>
            <label className="block"><span className="label">Meta description</span><input className="field" name="metaDescription" defaultValue={p.metaDescription ?? ""} maxLength={320} /></label>
            <label className="block"><span className="label">Body (Markdown)</span><textarea className="field" name="body" rows={24} defaultValue={p.body} /></label>
            <Toggle name="published" label="Published" defaultChecked={p.published} hint="Unpublished pages return 404." />
          </div>
          <div className="mt-4 flex gap-2"><SubmitButton>Save page</SubmitButton><a href={`/${slug}`} target="_blank" className="btn btn-secondary">View ↗</a></div>
        </AdminForm>
      </Card>
      {(slug === "privacy-policy" || slug === "terms-of-service") && <p className="text-muted text-xs">Legal pages are templates. Review them with qualified counsel for your jurisdictions before going live.</p>}
    </div>
  );
}
