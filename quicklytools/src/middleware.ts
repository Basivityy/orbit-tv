import { NextResponse, type NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

/**
 * 301/302 redirect manager. Redirect rules are loaded from the database into
 * memory and refreshed at most every 60 seconds, so normal requests cost a
 * single Map lookup and no database query.
 */
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|api/|admin|favicon|icon|opengraph-image|robots.txt|sitemap.xml|ads.txt|search-index.json|manifest).*)"],
};

type Rule = { to: string; status: number; id: string };
interface State {
  map: Map<string, Rule>;
  loadedAt: number;
  loading?: Promise<void>;
}
const g = globalThis as unknown as { __redir?: State; __mwPrisma?: PrismaClient };
const TTL = 60_000;

async function load() {
  const state: State = (g.__redir ??= { map: new Map(), loadedAt: 0 });
  if (Date.now() - state.loadedAt < TTL) return state.map;
  state.loading ??= (async () => {
    try {
      const prisma = (g.__mwPrisma ??= new PrismaClient());
      const rows = await prisma.redirect.findMany({ where: { enabled: true }, select: { id: true, fromPath: true, toPath: true, statusCode: true } });
      state.map = new Map(rows.map((r) => [r.fromPath, { to: r.toPath, status: r.statusCode, id: r.id }]));
    } catch {
      // Database unavailable: keep the previous rules and retry later.
    } finally {
      state.loadedAt = Date.now();
      state.loading = undefined;
    }
  })();
  await state.loading;
  return state.map;
}

function normalize(path: string) {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  try {
    return decodeURIComponent(p).toLowerCase();
  } catch {
    return p.toLowerCase();
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // Canonical form: no trailing slash (except root).
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "");
    return NextResponse.redirect(url, 301);
  }
  const map = await load();
  if (map.size === 0) return NextResponse.next();
  const rule = map.get(normalize(pathname));
  if (!rule) return NextResponse.next();
  const target = rule.to.startsWith("/") ? new URL(rule.to + (rule.to.includes("?") ? "" : search), req.url) : new URL(rule.to);
  void (g.__mwPrisma?.redirect.update({ where: { id: rule.id }, data: { hits: { increment: 1 } } }).catch(() => undefined));
  return NextResponse.redirect(target, rule.status === 302 ? 302 : 301);
}
