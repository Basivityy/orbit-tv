"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  createSession, destroySession, getCurrentUser, hashPassword, LOCK_MINUTES, MAX_FAILED_LOGINS, ROLE_RANK, validatePasswordStrength, verifyPassword,
} from "@/lib/auth";
import { adminAction, bool, json, opt, str, UserError, type ActionState } from "@/lib/admin-action";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/request";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { revalidateCatalog, revalidateEverything, revalidatePages } from "@/lib/revalidate";
import { applySeoChanges, revertBatch, revertRevision, SEO_FIELDS, type SeoChange, type SeoField, type SeoValue } from "@/lib/seo-service";
import { SETTING_DEFAULTS, type SettingKey } from "@/lib/settings-schema";
import { TOOL_BY_ID } from "@/tools/registry";
import { CATEGORY_BY_ID, isCategoryId } from "@/tools/categories";
import { ICONS } from "@/components/icons";
import { getCatalog } from "@/lib/data";
import { DEFAULT_PAGES } from "@/lib/default-pages";

// ---------- Authentication ----------

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(256) });

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const h = await headers();
  const ip = clientIp(h);
  const ipLimit = rateLimit(`login:ip:${ip}`, 10, 15 * 60_000);
  if (!ipLimit.ok) return { ok: false, message: `Too many attempts. Try again in ${Math.ceil(ipLimit.retryAfter / 60)} minute(s).` };
  const parsed = loginSchema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { ok: false, message: "Enter a valid email and password." };
  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await verifyPassword(null, password); // equalise timing
    return { ok: false, message: "This account is temporarily locked after repeated failed sign-ins. Try again later." };
  }
  const valid = await verifyPassword(user?.passwordHash ?? null, password);
  if (!user || !valid || !user.active) {
    if (user) {
      const failed = user.failedLogins + 1;
      await prisma.adminUser.update({
        where: { id: user.id },
        data: { failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : undefined },
      });
      await audit(user.id, "login.failed", { ip, details: { locked: failed >= MAX_FAILED_LOGINS } });
    }
    return { ok: false, message: "Invalid email or password." };
  }
  await prisma.adminUser.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  resetRateLimit(`login:ip:${ip}`);
  await createSession(user.id);
  await audit(user.id, "login.success", { ip });
  redirect("/admin");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "logout");
  redirect("/admin/login");
}

export const changeOwnPasswordAction = adminAction("viewDashboard", async ({ user, ip }, form) => {
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next !== String(form.get("confirm") ?? "")) throw new UserError("The new passwords do not match.");
  const weak = validatePasswordStrength(next);
  if (weak) throw new UserError(weak);
  const row = await prisma.adminUser.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(row.passwordHash, current))) throw new UserError("Your current password is incorrect.");
  await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  // Sign out other sessions.
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await createSession(user.id);
  await audit(user.id, "user.password_changed", { entity: "user", entityId: user.id, ip });
  return { ok: true, message: "Password changed. Other sessions were signed out." };
});

// ---------- Tools ----------

export const updateToolAction = adminAction("manageTools", async ({ user, ip }, form) => {
  const toolId = str(form, "toolId");
  if (!TOOL_BY_ID.has(toolId)) throw new UserError("Unknown tool.");
  const categoryId = str(form, "categoryId");
  if (categoryId && !isCategoryId(categoryId)) throw new UserError("Unknown category.");
  const icon = str(form, "icon");
  if (icon && !ICONS[icon]) throw new UserError("Unknown icon.");
  const relatedIds = json<string[]>(form, "relatedIds", []).filter((id) => TOOL_BY_ID.has(id) && id !== toolId).slice(0, 12);
  const sortOrder = str(form, "sortOrder");
  const data = {
    name: opt(form, "name", 80),
    description: opt(form, "description", 300),
    categoryId: categoryId || null,
    icon: icon || null,
    enabled: bool(form, "enabled"),
    popular: bool(form, "popular"),
    searchVisible: bool(form, "searchVisible"),
    sortOrder: sortOrder === "" ? null : Math.max(-10000, Math.min(10000, Math.round(Number(sortOrder) || 0))),
    hasRelated: bool(form, "customRelated"),
    relatedIds,
  };
  await prisma.toolOverride.upsert({ where: { toolId }, create: { toolId, ...data }, update: data });
  await audit(user.id, "tool.update", { entity: "tool", entityId: toolId, details: data as Prisma.InputJsonValue, ip });
  const cat = await getCatalog();
  const t = cat.tools.find((x) => x.id === toolId);
  await revalidateCatalog([`/tools/${t?.slug ?? toolId}`, ...cat.categories.map((c) => `/category/${c.slug}`)]);
  return { ok: true, message: "Tool saved and pages refreshed." };
});

export const quickToggleToolAction = adminAction("manageTools", async ({ user, ip }, form) => {
  const toolId = str(form, "toolId");
  const field = str(form, "field");
  if (!TOOL_BY_ID.has(toolId) || !["enabled", "popular"].includes(field)) throw new UserError("Invalid request.");
  const value = str(form, "value") === "true";
  await prisma.toolOverride.upsert({ where: { toolId }, create: { toolId, [field]: value }, update: { [field]: value } });
  await audit(user.id, `tool.${field}`, { entity: "tool", entityId: toolId, details: { value }, ip });
  const cat = await getCatalog();
  await revalidateCatalog([`/tools/${cat.tools.find((t) => t.id === toolId)?.slug ?? toolId}`, ...cat.categories.map((c) => `/category/${c.slug}`)]);
  return { ok: true, message: "Updated." };
});

export const resetToolAction = adminAction("manageTools", async ({ user, ip }, form) => {
  const toolId = str(form, "toolId");
  await prisma.toolOverride.deleteMany({ where: { toolId } });
  await audit(user.id, "tool.reset", { entity: "tool", entityId: toolId, ip });
  await revalidateCatalog([`/tools/${toolId}`]);
  return { ok: true, message: "Tool settings reset to defaults." };
});

// ---------- SEO ----------

function seoValueFromForm(form: FormData, field: SeoField): SeoValue {
  const spec = SEO_FIELDS[field];
  if (spec.kind === "bool") {
    const v = str(form, field);
    return v === "" || v === "default" ? null : v === "true";
  }
  if (spec.kind === "json") {
    const v = json<SeoValue[] | null>(form, field, null);
    return Array.isArray(v) && v.length ? v : null;
  }
  return str(form, field) || null;
}

export const updateSeoAction = adminAction("editSeo", async ({ user, ip }, form) => {
  const toolId = str(form, "toolId");
  if (!TOOL_BY_ID.has(toolId)) throw new UserError("Unknown tool.");
  const changes: SeoChange[] = (Object.keys(SEO_FIELDS) as SeoField[]).filter((f) => form.has(f)).map((field) => ({ toolId, field, value: seoValueFromForm(form, field) }));
  const res = await applySeoChanges(user.id, changes, str(form, "note") || undefined);
  if (res.changed) {
    await audit(user.id, "seo.update", { entity: "tool", entityId: toolId, details: { batchId: res.batchId, changed: res.changed }, ip });
    await revalidateCatalog(res.paths);
  }
  return { ok: true, message: res.changed ? `${res.changed} field(s) updated. Public HTML refreshed.` : "No changes." };
});

const bulkSchema = z.object({
  toolIds: z.array(z.string()).min(1, "Select at least one tool.").max(500),
  field: z.enum(Object.keys(SEO_FIELDS).filter((f) => f !== "slug" && f !== "faq" && f !== "internalLinks") as [SeoField, ...SeoField[]]),
  mode: z.enum(["set", "template", "reset"]),
  value: z.string().max(50000),
  find: z.string().max(500).optional(),
});

/**
 * Bulk SEO editor. step=preview returns the before/after table without writing;
 * step=apply writes the same computed values in one transaction with history.
 */
export const bulkSeoAction = adminAction("editSeo", async ({ user, ip }, form) => {
  const input = bulkSchema.parse({ toolIds: json<string[]>(form, "toolIds", []), field: str(form, "field"), mode: str(form, "mode"), value: String(form.get("value") ?? ""), find: str(form, "find") || undefined });
  const cat = await getCatalog();
  const kind = SEO_FIELDS[input.field].kind;
  const rows = input.toolIds.map((id) => {
    const t = cat.tools.find((x) => x.id === id);
    if (!t) throw new UserError(`Unknown tool ${id}`);
    const current = (t.seo as Record<string, unknown>)[input.field] ?? "";
    let next: string | boolean | null;
    if (input.mode === "reset") next = null;
    else if (kind === "bool") next = input.value === "true";
    else if (input.mode === "template") {
      const catName = cat.categories.find((c) => c.id === t.category)?.name ?? "";
      next = input.value.replace(/\{name\}/g, t.name).replace(/\{category\}/g, catName).replace(/\{description\}/g, t.description).replace(/\{current\}/g, String(current));
      if (input.find) next = String(current).split(input.find).join(next);
    } else next = input.value;
    return { toolId: id, name: t.name, before: String(current), after: next === null ? "(default)" : String(next), value: next };
  });
  if (str(form, "step") !== "apply") return { ok: true, message: `Preview of ${rows.length} change(s). Review, then publish.`, data: rows.map(({ value: _v, ...r }) => r) };
  const res = await applySeoChanges(user.id, rows.map((r) => ({ toolId: r.toolId, field: input.field, value: r.value })), `Bulk ${input.mode} ${input.field}`);
  await audit(user.id, "seo.bulk", { details: { field: input.field, mode: input.mode, count: res.changed, batchId: res.batchId }, ip });
  if (res.changed) await revalidateCatalog(res.paths);
  return { ok: true, message: `Published ${res.changed} change(s). Batch ${res.batchId.slice(0, 8)} can be reverted from SEO history.` };
});

export const revertRevisionAction = adminAction("editSeo", async ({ user, ip }, form) => {
  const id = str(form, "revisionId");
  const batch = str(form, "batchId");
  const res = batch ? await revertBatch(user.id, batch) : await revertRevision(user.id, id);
  await audit(user.id, "seo.revert", { details: { revisionId: id || null, batchId: batch || null, newBatch: res.batchId }, ip });
  if (res.changed) await revalidateCatalog(res.paths);
  return { ok: true, message: res.changed ? `Reverted ${res.changed} field(s).` : "Nothing to revert — values already match." };
});

// ---------- Content & settings ----------

export const saveSettingAction = adminAction("editContent", async ({ user, ip }, form) => {
  const key = str(form, "key") as SettingKey;
  if (!(key in SETTING_DEFAULTS) || key === "ads") throw new UserError("Unknown setting.");
  const def = SETTING_DEFAULTS[key];
  const value = def.schema.parse(json(form, "value", null));
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
  await audit(user.id, "settings.update", { entity: "setting", entityId: key, ip });
  await revalidateEverything();
  return { ok: true, message: "Saved. All pages will show the change." };
});

export const saveAdsAction = adminAction("manageAds", async ({ user, ip }, form) => {
  const value = SETTING_DEFAULTS.ads.schema.parse(json(form, "value", null));
  if (value.enabled && !value.publisherId) throw new UserError("Enter your AdSense publisher ID before enabling ads.");
  await prisma.setting.upsert({ where: { key: "ads" }, create: { key: "ads", value: value as Prisma.InputJsonValue }, update: { value: value as Prisma.InputJsonValue } });
  await audit(user.id, "ads.update", { details: { enabled: value.enabled, consentMode: value.consentMode }, ip });
  await revalidateEverything();
  return { ok: true, message: "Ad settings saved." };
});

const pageSchema = z.object({
  slug: z.string().refine((s) => DEFAULT_PAGES.some((p) => p.slug === s), "Unknown page"),
  title: z.string().trim().min(1).max(120),
  body: z.string().max(100_000),
  metaDescription: z.string().trim().max(320),
  published: z.boolean(),
});

export const savePageAction = adminAction("editContent", async ({ user, ip }, form) => {
  const p = pageSchema.parse({ slug: str(form, "slug"), title: str(form, "title"), body: String(form.get("body") ?? ""), metaDescription: str(form, "metaDescription"), published: bool(form, "published") });
  await prisma.sitePage.upsert({ where: { slug: p.slug }, create: p, update: p });
  await audit(user.id, "page.update", { entity: "page", entityId: p.slug, ip });
  await revalidatePages(p.slug);
  return { ok: true, message: "Page saved." };
});

export const resetPageAction = adminAction("editContent", async ({ user, ip }, form) => {
  const slug = str(form, "slug");
  await prisma.sitePage.deleteMany({ where: { slug } });
  await audit(user.id, "page.reset", { entity: "page", entityId: slug, ip });
  await revalidatePages(slug);
  return { ok: true, message: "Page restored to the default text." };
});

export const saveCategoryAction = adminAction("editContent", async ({ user, ip }, form) => {
  const id = str(form, "categoryId");
  if (!isCategoryId(id)) throw new UserError("Unknown category.");
  const sortOrder = str(form, "sortOrder");
  const data = {
    name: opt(form, "name", 60),
    description: opt(form, "description", 300),
    intro: opt(form, "intro", 3000),
    seoTitle: opt(form, "seoTitle", 120),
    metaDescription: opt(form, "metaDescription", 320),
    sortOrder: sortOrder === "" ? null : Math.round(Number(sortOrder) || 0),
  };
  await prisma.categoryOverride.upsert({ where: { categoryId: id }, create: { categoryId: id, ...data }, update: data });
  await audit(user.id, "category.update", { entity: "category", entityId: id, ip });
  await revalidateCatalog([`/category/${CATEGORY_BY_ID[id].slug}`]);
  return { ok: true, message: "Category saved." };
});

// ---------- Redirects ----------

const pathRe = /^\/[^\s?#]*$/;
const redirectSchema = z.object({
  fromPath: z.string().trim().max(300).regex(pathRe, "From must be a site path starting with / (no query string)."),
  toPath: z.string().trim().max(500).refine((v) => pathRe.test(v.split("?")[0]) || /^https?:\/\/\S+$/i.test(v), "To must be a path or full URL."),
  statusCode: z.coerce.number().refine((n) => n === 301 || n === 302),
  note: z.string().trim().max(200).optional(),
});

export const createRedirectAction = adminAction("manageRedirects", async ({ user, ip }, form) => {
  const r = redirectSchema.parse({ fromPath: str(form, "fromPath"), toPath: str(form, "toPath"), statusCode: str(form, "statusCode") || 301, note: str(form, "note") || undefined });
  const from = r.fromPath.length > 1 ? r.fromPath.replace(/\/+$/, "").toLowerCase() : r.fromPath;
  if (from === r.toPath.toLowerCase()) throw new UserError("A redirect cannot point to itself.");
  if (from.startsWith("/admin") || from.startsWith("/api") || from.startsWith("/_next")) throw new UserError("System paths cannot be redirected.");
  const loop = await prisma.redirect.findFirst({ where: { fromPath: r.toPath.toLowerCase(), toPath: from } });
  if (loop) throw new UserError("This would create a redirect loop.");
  await prisma.redirect.upsert({ where: { fromPath: from }, create: { ...r, fromPath: from }, update: { ...r, fromPath: from, enabled: true } });
  await audit(user.id, "redirect.save", { entity: "redirect", entityId: from, details: r, ip });
  return { ok: true, message: "Redirect saved. It becomes active within 60 seconds." };
});

export const toggleRedirectAction = adminAction("manageRedirects", async ({ user, ip }, form) => {
  const id = str(form, "id");
  const r = await prisma.redirect.update({ where: { id }, data: { enabled: str(form, "enabled") === "true" } });
  await audit(user.id, "redirect.toggle", { entity: "redirect", entityId: r.fromPath, details: { enabled: r.enabled }, ip });
  return { ok: true, message: "Updated." };
});

export const deleteRedirectAction = adminAction("manageRedirects", async ({ user, ip }, form) => {
  const id = str(form, "id");
  const r = await prisma.redirect.delete({ where: { id } });
  await audit(user.id, "redirect.delete", { entity: "redirect", entityId: r.fromPath, ip });
  return { ok: true, message: "Redirect deleted." };
});

// ---------- Users ----------

const roles = ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as const;
const newUserSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(80),
  role: z.enum(roles),
  password: z.string(),
});

export const createUserAction = adminAction("manageUsers", async ({ user, ip }, form) => {
  const u = newUserSchema.parse({ email: str(form, "email"), name: str(form, "name"), role: str(form, "role"), password: String(form.get("password") ?? "") });
  const weak = validatePasswordStrength(u.password);
  if (weak) throw new UserError(weak);
  if (await prisma.adminUser.findUnique({ where: { email: u.email } })) throw new UserError("A user with this email already exists.");
  const created = await prisma.adminUser.create({ data: { email: u.email, name: u.name, role: u.role, passwordHash: await hashPassword(u.password) } });
  await audit(user.id, "user.create", { entity: "user", entityId: created.id, details: { email: u.email, role: u.role }, ip });
  return { ok: true, message: `User ${u.email} created.` };
});

export const updateUserAction = adminAction("manageUsers", async ({ user, ip }, form) => {
  const id = str(form, "id");
  const role = str(form, "role") as Role;
  if (!roles.includes(role as (typeof roles)[number])) throw new UserError("Invalid role.");
  const active = bool(form, "active");
  const target = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  if (target.role === "OWNER" && (role !== "OWNER" || !active)) {
    const owners = await prisma.adminUser.count({ where: { role: "OWNER", active: true } });
    if (owners <= 1) throw new UserError("You cannot demote or deactivate the last active owner.");
  }
  await prisma.adminUser.update({ where: { id }, data: { role, active } });
  if (!active || ROLE_RANK[role] < ROLE_RANK[target.role]) await prisma.session.deleteMany({ where: { userId: id } });
  const pw = String(form.get("password") ?? "");
  if (pw) {
    const weak = validatePasswordStrength(pw);
    if (weak) throw new UserError(weak);
    await prisma.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(pw), failedLogins: 0, lockedUntil: null } });
    await prisma.session.deleteMany({ where: { userId: id } });
  }
  await audit(user.id, "user.update", { entity: "user", entityId: id, details: { role, active, passwordReset: !!pw }, ip });
  return { ok: true, message: "User updated." };
});

export const deleteUserAction = adminAction("manageUsers", async ({ user, ip }, form) => {
  const id = str(form, "id");
  if (id === user.id) throw new UserError("You cannot delete your own account.");
  const target = await prisma.adminUser.findUniqueOrThrow({ where: { id } });
  if (target.role === "OWNER" && (await prisma.adminUser.count({ where: { role: "OWNER" } })) <= 1) throw new UserError("You cannot delete the last owner.");
  await prisma.adminUser.delete({ where: { id } });
  await audit(user.id, "user.delete", { entity: "user", entityId: id, details: { email: target.email }, ip });
  return { ok: true, message: "User deleted." };
});

// ---------- Maintenance ----------

export const clearErrorsAction = adminAction("viewAudit", async ({ user, ip }) => {
  const r = await prisma.errorLog.deleteMany({});
  await audit(user.id, "errors.clear", { details: { count: r.count }, ip });
  return { ok: true, message: `Cleared ${r.count} error entries.` };
});

export const refreshCachesAction = adminAction("manageTools", async ({ user, ip }) => {
  await revalidateEverything();
  await audit(user.id, "cache.refresh", { ip });
  return { ok: true, message: "All caches refreshed." };
});
