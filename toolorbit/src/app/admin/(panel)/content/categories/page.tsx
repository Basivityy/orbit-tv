import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { CATEGORIES } from "@/tools/categories";
import { AdminForm, Card, SubmitButton } from "@/components/admin/Form";
import { saveCategoryAction } from "../../../actions";

export const metadata = { title: "Categories" };

export default async function CategoriesAdmin() {
  await requirePageUser("editContent");
  const rows = await prisma.categoryOverride.findMany();
  return (
    <div className="space-y-5">
      <Link href="/admin/content" className="text-muted text-sm hover:underline">← Content</Link>
      <h1 className="text-2xl font-bold">Categories</h1>
      {CATEGORIES.map((c) => {
        const o = rows.find((r) => r.categoryId === c.id);
        return (
          <Card key={c.id} title={`${c.name} — /category/${c.slug}`} description="Empty fields use the defaults shown as placeholders.">
            <AdminForm action={saveCategoryAction}>
              <input type="hidden" name="categoryId" value={c.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="label">Name</span><input className="field" name="name" defaultValue={o?.name ?? ""} placeholder={c.name} /></label>
                <label className="block"><span className="label">Sort order</span><input className="field" type="number" name="sortOrder" defaultValue={o?.sortOrder ?? ""} placeholder={String(c.order)} /></label>
                <label className="block sm:col-span-2"><span className="label">Short description</span><input className="field" name="description" defaultValue={o?.description ?? ""} placeholder={c.description} /></label>
                <label className="block sm:col-span-2"><span className="label">Intro text</span><textarea className="field !font-sans !text-sm" name="intro" rows={3} defaultValue={o?.intro ?? ""} placeholder={c.intro} /></label>
                <label className="block"><span className="label">SEO title</span><input className="field" name="seoTitle" defaultValue={o?.seoTitle ?? ""} placeholder={`${c.name} – Free Online ${c.name}`} /></label>
                <label className="block"><span className="label">Meta description</span><input className="field" name="metaDescription" defaultValue={o?.metaDescription ?? ""} placeholder={c.description} /></label>
              </div>
              <div className="mt-4"><SubmitButton>Save category</SubmitButton></div>
            </AdminForm>
          </Card>
        );
      })}
    </div>
  );
}
