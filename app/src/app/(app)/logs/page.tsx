/**
 * Page /logs — consultation des erreurs runtime enregistrées dans AppLog.
 * Filtres : niveau (ERROR/WARN/INFO), période (24h/7j/30j), user.
 * Accessible aux utilisateurs avec permission 'users.manage' (Admin).
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LogsPage({
  searchParams
}: {
  searchParams: { level?: string; days?: string; userId?: string; q?: string };
}) {
  await requirePermission("users.manage");

  const level = ["ERROR", "WARN", "INFO"].includes(searchParams.level ?? "") ? searchParams.level : null;
  const days = Math.min(30, Math.max(1, parseInt(searchParams.days ?? "7", 10) || 7));
  const q = (searchParams.q ?? "").trim();
  const userId = searchParams.userId ?? null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const where: any = { createdAt: { gte: since } };
  if (level) where.level = level;
  if (userId) where.userId = userId;
  if (q) where.message = { contains: q, mode: "insensitive" };

  const p = prisma as any;
  const [logs, totalErr24h, totalWarn24h] = await Promise.all([
    p.appLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    p.appLog.count({
      where: { level: "ERROR", createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }
    }),
    p.appLog.count({
      where: { level: "WARN", createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Logs d'erreurs"
        subtitle={`${totalErr24h} erreurs · ${totalWarn24h} warnings dans les 24 dernières heures`}
      />

      {/* Filtres */}
      <form method="get" className="card p-3 mb-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[10px] text-midnight-500 uppercase tracking-wider mb-1">Niveau</label>
          <select name="level" defaultValue={level ?? ""} className="input h-8 text-sm">
            <option value="">Tous</option>
            <option value="ERROR">Erreurs</option>
            <option value="WARN">Warnings</option>
            <option value="INFO">Info</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-midnight-500 uppercase tracking-wider mb-1">Période</label>
          <select name="days" defaultValue={String(days)} className="input h-8 text-sm">
            <option value="1">Dernières 24h</option>
            <option value="3">3 derniers jours</option>
            <option value="7">7 derniers jours</option>
            <option value="14">14 derniers jours</option>
            <option value="30">30 derniers jours</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] text-midnight-500 uppercase tracking-wider mb-1">Recherche message</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="ex : prisma, timeout, 500..."
            className="input h-8 w-full text-sm"
          />
        </div>
        <button type="submit" className="btn-primary btn-sm">Filtrer</button>
        {(level || q || days !== 7 || userId) && (
          <Link href="/logs" className="btn-ghost btn-sm">Réinitialiser</Link>
        )}
      </form>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-midnight-50/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Date</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Niveau</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Message</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Route</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">User</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-sm text-midnight-500 italic">
                Aucune entrée pour ces filtres.
              </td></tr>
            ) : logs.map((l: any) => (
              <tr key={l.id} className="border-t border-border/40 hover:bg-midnight-50/30 align-top">
                <td className="px-3 py-2 tabular-nums text-xs text-midnight-500 whitespace-nowrap">
                  {l.createdAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    l.level === "ERROR" ? "bg-red-100 text-red-700"
                    : l.level === "WARN" ? "bg-amber-100 text-amber-700"
                    : "bg-blue-100 text-blue-700"
                  }`}>
                    {l.level}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <details>
                    <summary className="cursor-pointer text-midnight-900 hover:text-indigoaccent break-all">
                      {l.message.length > 200 ? l.message.slice(0, 200) + "…" : l.message}
                    </summary>
                    {l.stack && (
                      <pre className="mt-2 p-2 bg-midnight-950 text-red-100 text-[10px] rounded max-h-64 overflow-auto whitespace-pre-wrap">
                        {l.stack}
                      </pre>
                    )}
                    {l.meta ? (
                      <pre className="mt-2 p-2 bg-midnight-100 text-midnight-900 text-[10px] rounded overflow-auto">
                        {JSON.stringify(l.meta, null, 2)}
                      </pre>
                    ) : null}
                  </details>
                </td>
                <td className="px-3 py-2 text-xs text-midnight-500 break-all max-w-[240px]">
                  {l.path ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-midnight-500">
                  {l.user ? `${l.user.firstName} ${l.user.lastName}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-midnight-500 mt-3 italic">
        Affichage limité aux 200 entrées les plus récentes. Rétention : 30 jours (à nettoyer manuellement pour l&apos;instant).
      </p>
    </div>
  );
}
