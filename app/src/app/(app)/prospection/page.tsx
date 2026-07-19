import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewInteractionForm } from "./new-form";
import { InteractionsTable } from "./interactions-table";
import { formatDate } from "@/lib/utils";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Page principale de la chasseuse de têtes.
 * Trois blocs :
 *  1. « À relancer aujourd'hui » — nextActionAt <= today && !done
 *  2. Formulaire de nouvelle interaction (repliable)
 *  3. Timeline de toutes les interactions récentes avec filtre
 */
export default async function ProspectionPage({
  searchParams
}: {
  searchParams: { status?: string; purpose?: string };
}) {
  await requirePermission("consulting.write");
  const session = await requireSession();

  const statusFilter = searchParams.status;
  const purposeFilter = searchParams.purpose;

  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);

  const [toFollowUp, interactions, candidates, contacts, templates] = await Promise.all([
    // Relances du jour (et en retard)
    prisma.outreachInteraction.findMany({
      where: {
        ownerId: session.user.id,
        nextActionDone: false,
        nextActionAt: { not: null, lte: today }
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true } },
        contact:   { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { nextActionAt: "asc" },
      take: 20
    }),
    prisma.outreachInteraction.findMany({
      where: {
        ...(statusFilter ? { status: statusFilter as any } : {}),
        ...(purposeFilter ? { purpose: purposeFilter as any } : {})
      },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true } },
        contact:   { select: { id: true, firstName: true, lastName: true, company: { select: { name: true } } } },
        template:  { select: { name: true } },
        owner:     { select: { firstName: true, lastName: true } }
      },
      orderBy: { sentAt: "desc" },
      take: 100
    }),
    // Recherche rapide côté client — on charge top 500 candidats actifs
    prisma.candidate.findMany({
      where: { status: { in: ["ACTIVE", "UNAVAILABLE"] } },
      select: { id: true, firstName: true, lastName: true, seniority: true },
      orderBy: { updatedAt: "desc" },
      take: 500
    }),
    prisma.contact.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, company: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 500
    }),
    prisma.outreachTemplate.findMany({
      where: { isArchived: false },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Prospection"
        subtitle="Sourcing outbound (candidats & clients) — chaque contact tracé, chaque relance planifiée."
      />

      {/* Panneau relances du jour */}
      {toFollowUp.length > 0 && (
        <section className="card p-4 mb-5 border-amber-200 bg-amber-50/40">
          <h2 className="font-semibold flex items-center gap-2 mb-3 text-amber-900">
            <Bell className="w-4 h-4" />
            À relancer aujourd'hui ({toFollowUp.length})
          </h2>
          <ul className="divide-y divide-amber-200">
            {toFollowUp.map((i) => {
              const targetName = i.candidate
                ? `${i.candidate.firstName} ${i.candidate.lastName}`
                : i.contact
                  ? `${i.contact.firstName} ${i.contact.lastName}`
                  : i.freeformName ?? "?";
              return (
                <li key={i.id} className="py-2 text-sm flex items-center justify-between">
                  <div>
                    <span className="font-medium">{targetName}</span>
                    {i.nextActionNote && <span className="text-midnight-600"> — {i.nextActionNote}</span>}
                  </div>
                  <span className="text-xs text-midnight-500">
                    {i.nextActionAt && formatDate(i.nextActionAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Nouvelle interaction */}
      <NewInteractionForm
        candidates={candidates as any}
        contacts={contacts as any}
        templates={templates as any}
      />

      {/* Filtres */}
      <div className="flex gap-2 mb-3 mt-6 text-sm items-center">
        <span className="text-midnight-500">Filtrer :</span>
        <Link href="/prospection" className={"badge-neutral " + (!statusFilter && !purposeFilter ? "!bg-indigoaccent !text-white" : "")}>Tous</Link>
        <Link href="/prospection?status=SENT" className="badge-neutral">Envoyés</Link>
        <Link href="/prospection?status=REPLIED_POSITIVE" className="badge-neutral">Réponses +</Link>
        <Link href="/prospection?status=REPLIED_NEGATIVE" className="badge-neutral">Réponses −</Link>
        <Link href="/prospection?status=NO_RESPONSE" className="badge-neutral">Sans réponse</Link>
        <span className="text-midnight-300 mx-2">|</span>
        <Link href="/prospection?purpose=SOURCE_CANDIDATE" className="badge-neutral">Sourcing candidat</Link>
        <Link href="/prospection?purpose=SELL_TO_CLIENT" className="badge-neutral">Prospect client</Link>
      </div>

      <InteractionsTable interactions={interactions as any} />
    </div>
  );
}
