/**
 * Log runtime des erreurs applicatives — insertion dans la table AppLog.
 * Consultable sur /logs. Ne throw JAMAIS (le logger doit être silencieux
 * s'il échoue, pour ne pas cascader une erreur secondaire).
 */
import { prisma } from "./db";

export type LogLevel = "ERROR" | "WARN" | "INFO";

export type LogAppErrorInput = {
  level?: LogLevel;
  message: string;
  stack?: string | null;
  path?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown> | null;
};

/**
 * Insère une ligne dans AppLog. Ne throw pas — en cas d'échec DB, on log
 * en console et on retourne silencieusement (le caller doit continuer).
 */
export async function logAppError(input: LogAppErrorInput): Promise<void> {
  try {
    await (prisma as any).appLog.create({
      data: {
        level: input.level ?? "ERROR",
        message: (input.message ?? "(no message)").slice(0, 8000),
        stack: input.stack?.slice(0, 16000) ?? null,
        path: input.path?.slice(0, 500) ?? null,
        userId: input.userId ?? null,
        meta: (input.meta ?? null) as any
      }
    });
  } catch (e) {
    console.error("[app-log] failed to insert log entry:", e);
  }
}

/**
 * Helper pour capturer une Error native.
 */
export async function logError(err: unknown, context?: Omit<LogAppErrorInput, "message" | "stack">) {
  const e = err as Error;
  await logAppError({
    level: "ERROR",
    message: e?.message ?? String(err),
    stack: e?.stack ?? null,
    ...context
  });
}
