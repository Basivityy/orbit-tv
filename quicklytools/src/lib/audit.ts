import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function audit(userId: string | null, action: string, opts: { entity?: string; entityId?: string; details?: Prisma.InputJsonValue; ip?: string } = {}) {
  try {
    await prisma.auditLog.create({ data: { userId, action, entity: opts.entity, entityId: opts.entityId, details: opts.details, ip: opts.ip } });
  } catch (e) {
    console.error("[audit] failed to write", e instanceof Error ? e.message : e);
  }
}
