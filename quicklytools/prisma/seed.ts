/**
 * Optional seed: writes the default static pages into the database so they can be
 * edited from the admin. Safe to run repeatedly (existing pages are not touched).
 * Tools, categories and settings need no seeding — defaults live in code.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_PAGES } from "../src/lib/default-pages";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const p of DEFAULT_PAGES) {
    const exists = await prisma.sitePage.findUnique({ where: { slug: p.slug } });
    if (!exists) {
      await prisma.sitePage.create({ data: { slug: p.slug, title: p.title, body: p.body, metaDescription: p.metaDescription } });
      created++;
    }
  }
  console.log(`Seed complete: ${created} page(s) created.`);
}

main().finally(() => prisma.$disconnect());
