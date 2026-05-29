// Page de suivi d'un onboarding : checklist groupée par catégorie + entretiens
// planifiés (depuis ConsultantReview).
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CalendarClock, ChevronLeft, MessageSquare } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { OnboardingChecklist } from "./checklist";
import { archiveOnboarding } from "@/server/actions/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingDetailPage({
  params
}: {
  params: { userId: string };
}) {
  await requirePermission("onboarding.read");

  const onboarding = await prisma.onboarding.findUnique({
    where: { userId: params.userId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true }
      },
      template: { select: { name: true } },
      items: {
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ category: "asc" }, { position: "asc" }]
      }
    }
  });

  if (!onboarding) {
    // Pas encore d'onboarding pour ce user — redirige vers la liste avec message
    redirect("/onboarding");
  }

  // Entretiens planifiés du subject — on prend tous ceux à venir (status SCHEDULED)
  // + ceux passés des 6 derniers mois.
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const reviews = await prisma.consultantReview.findMany({
    where: {
      subjectId: params.userId,
      OR: [
        { outcome: "SCHEDULED" },
        { scheduledAt: { gte: sixMonthsAgo } }
      ]
    },
    include: {
      conductedBy: { select: { firstName: true, lastName: true } }
    },
    orderBy: { scheduledAt: "asc" }
  });

  const users = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true }
  });

  const total = onboarding.items.length;
  const done = onboarding.items.filter((i) => i.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Groupe les items par catégorie (déjà ordonné par category, position)
  const byCategory: { category: string; items: typeof onboarding.items }[] = [];
  for (const it of onboarding.items) {
    const last = byCategory[byCategory.length - 1];
    if (last && last.category === it.category) last.items.push(it);
    else byCategory.push({ category: it.category, items: [it] });
  }

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Onboarding", href: "/onboarding" },
          { label: `${onboarding.user.firstName} ${onboarding.user.lastName}` }
        ]}
        title={`${onboarding.user.firstName} ${onboarding.user.lastName}`}
        subtitle={`${onboarding.user.role} · démarrage ${formatDate(onboarding.startDate)}${
          onboarding.template?.name ? ` · template ${onboarding.template.name}` : ""
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/onboarding" className="btn-secondary text-xs">
              <ChevronLeft className="w-3 h-3" />
              Retour
            </Link>
            <form
              action={async () => {
                "use server";
                await archiveOnboarding(onboarding.id);
                redirect("/onboarding");
              }}
            >
              <button type="submit" className="btn-secondary text-xs">
                Archiver
              </button>
            </form>
          </div>
        }
      />

      {/* Bandeau progression */}
      <div className="card p-4 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm font-semibold text-midnight-900">
            Progression {done}/{total}
          </div>
          <div className="text-xs text-midnight-500">{pct}%</div>
        </div>
        <div className="h-2 bg-midnight-100 rounded overflow-hidden">
          <div
            className={cn(
              "h-full transition-all",
              onboarding.status === "DONE" ? "bg-emerald-500" : "bg-indigoaccent"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist principale */}
        <div className="lg:col-span-2">
          <OnboardingChecklist
            onboardingId={onboarding.id}
            grouped={byCategory.map((g) => ({
              category: g.category,
              items: g.items.map((i) => ({
                id: i.id,
                title: i.title,
                description: i.description,
                done: i.done,
                dueDate: i.dueDate ? formatDate(i.dueDate) : null,
                ownerName: i.owner
                  ? `${i.owner.firstName} ${i.owner.lastName[0]}.`
                  : null
              }))
            }))}
            users={users}
          />
        </div>

        {/* Entretiens planifiés */}
        <div className="lg:col-span-1">
          <div className="card">
            <div className="card-header font-semibold text-sm flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Entretiens planifiés
            </div>
            <div className="p-3">
              {reviews.length === 0 ? (
                <div className="text-xs text-midnight-400 text-center py-4">
                  Aucun entretien planifié.
                </div>
              ) : (
                <ul className="space-y-2">
                  {reviews.map((r) => {
                    const past = r.scheduledAt < new Date();
                    return (
                      <li
                        key={r.id}
                        className={cn(
                          "flex items-start gap-2 text-xs p-2 rounded",
                          r.outcome === "COMPLETED" && "bg-emerald-50",
                          r.outcome === "SCHEDULED" && past && "bg-amber-50",
                          r.outcome === "CANCELLED" && "opacity-50"
                        )}
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-midnight-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-midnight-900">
                            {labelForReviewKind(r.kind)}
                          </div>
                          <div className="text-[11px] text-midnight-500">
                            {formatDate(r.scheduledAt)} · {labelForReviewOutcome(r.outcome)}
                            {r.conductedBy &&
                              ` · ${r.conductedBy.firstName} ${r.conductedBy.lastName[0]}.`}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href={`/reviews?subjectId=${onboarding.userId}`}
                className="block text-center mt-3 text-xs text-indigoaccent hover:underline"
              >
                Voir tous les entretiens →
              </Link>
            </div>
          </div>

          {/* Notes libres */}
          {onboarding.notes && (
            <div className="card mt-4 p-4">
              <div className="text-xs font-semibold text-midnight-700 mb-1">
                Notes
              </div>
              <div className="text-xs text-midnight-600 whitespace-pre-wrap">
                {onboarding.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function labelForReviewKind(k: string): string {
  return (
    {
      ONBOARDING: "Entretien d'arrivée",
      CHECK_IN: "Point régulier",
      ANNUAL_REVIEW: "Entretien annuel",
      END_OF_MISSION: "Fin de mission",
      PERFORMANCE: "Performance",
      CAREER: "Carrière",
      OFFBOARDING: "Entretien de départ",
      OTHER_REVIEW: "Autre"
    } as Record<string, string>
  )[k] ?? k;
}

function labelForReviewOutcome(o: string): string {
  return (
    {
      SCHEDULED: "Planifié",
      COMPLETED: "Terminé",
      CANCELLED: "Annulé",
      RESCHEDULED: "Reprogrammé"
    } as Record<string, string>
  )[o] ?? o;
}
