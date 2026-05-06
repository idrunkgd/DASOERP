import { prisma } from "./db";
import type { AuditAction, Prisma } from "@prisma/client";

export async function logActivity(params: {
  actorId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  message: string;
  diff?: Prisma.InputJsonValue;
  before?: any;
  after?: any;
}) {
  try {
    let diff = params.diff;
    if (!diff && (params.before || params.after)) diff = computeDiff(params.before, params.after) as any;
    await prisma.activityLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        message: params.message,
        diff
      }
    });
  } catch (e) {
    console.error("audit.log failed", e);
  }
}

/** Calcule un diff structuré { field: { before, after } } pour les champs scalaires. */
export function computeDiff(before: any, after: any): Record<string, { before: any; after: any }> | null {
  if (!before && !after) return null;
  const diff: Record<string, { before: any; after: any }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (k === "updatedAt" || k === "createdAt") continue;
    const b = serialize(before?.[k]);
    const a = serialize(after?.[k]);
    if (JSON.stringify(b) !== JSON.stringify(a)) diff[k] = { before: b, after: a };
  }
  return Object.keys(diff).length ? diff : null;
}

function serialize(v: any) {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && typeof v.toString === "function" && v.constructor?.name === "Decimal") return Number(v);
  if (v instanceof Date) return v.toISOString();
  return v;
}
