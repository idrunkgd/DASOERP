// Liste de tous les onboardings (en cours + récemment terminés).
// Permet aussi de lancer un onboarding manuel pour un user qui n'en a pas.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { GraduationCap, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { NewOnboardingForm } from "./new-onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingListPage() {
  await requireSession();

  const [onboardings, usersWithoutOnboarding, templates] = await Promise.all([
    prisma.onboarding.findMany({
      where: { status: { in: ["IN_PROGRESS", "DONE"] } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        items: { select: { done: true } },
        template: { select: { name: true } }
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }]
    }),
    prisma.user.findMany({
      where: {
        active: true,
        onboarding: { is: null }
      },
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, firstName: true, lastName: true, role: true, email: true }
    }),
    prisma.onboardingTemplate.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="Checklists d'arrivée des nouveaux utilisateurs Dasolabs."
      />

      <div className="card mb-6">
        <div className="card-header font-semibold">Lancer un nouvel onboarding</div>
        <div className="p-4">
          <NewOnboardingForm
            users={usersWithoutOnboarding}
            templates={templates}
          />
          {usersWithoutOnboarding.length === 0 && (
            <p className="text-xs text-midnight-500 mt-2">
              Tous les utilisateurs actifs ont déjà un onboarding.
            </p>
          )}
        </div>
      </div>

      {onboardings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={GraduationCap}
            title="Aucun onboarding en cours"
            description="Lance le premier en sélectionnant un utilisateur ci-dessus."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {onboardings.map((ob) => {
            const total = ob.items.length;
            const done = ob.items.filter((i) => i.done).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isDone = ob.status === "DONE";
            return (
              <Link
                key={ob.id}
                href={`/onboarding/${ob.userId}`}
                className="card p-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-midnight-900 truncate">
                      {ob.user.firstName} {ob.user.lastName}
                    </div>
                    <div className="text-[11px] text-midnight-500 truncate">
                      {ob.user.role}{ob.template?.name && ` · ${ob.template.name}`}
                    </div>
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-midnight-300 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-midnight-500 mb-1.5">
                  Démarrage : {formatDate(ob.startDate)}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-midnight-100 rounded overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        isDone ? "bg-emerald-500" : "bg-indigoaccent"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-midnight-600 tabular-nums">
                    {done}/{total}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-[11px] text-indigoaccent opacity-0 group-hover:opacity-100 transition-opacity">
                  Ouvrir <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
