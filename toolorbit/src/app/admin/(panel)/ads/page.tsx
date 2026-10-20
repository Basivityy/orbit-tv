import { getCatalog, getSettings } from "@/lib/data";
import { requirePageUser } from "@/lib/auth";
import { AdsForm } from "./AdsForm";

export const metadata = { title: "Ads manager" };

export default async function AdsPage() {
  await requirePageUser("manageAds");
  const [s, catalog] = await Promise.all([getSettings(), getCatalog()]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Ads manager (Google AdSense)</h1>
      <AdsForm value={s.ads} categories={catalog.categories.map((c) => ({ id: c.id, name: c.name }))} tools={catalog.tools.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
