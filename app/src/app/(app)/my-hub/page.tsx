import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { HeroCard } from "@/components/ui/hero-card";
import { formatDate, formatCurrency, cn } from "@/lib/utils";
import { computeLeaveBalance } from "@/lib/leave-balance";
import {
  Briefcase, Car, Sun, Receipt, GraduationCap, FileSignature,
  Clock, ChevronRight, CheckCircle2, AlertCircle
} from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Mon espace — le vrai dashboard consultant.
 *
 * Une page dédiée qui rassemble en un écran ce qui concerne l'utilisateur :
 *   - hero card mission actuelle (client, jours restants, contact)
 *   - solde congés
 *   - notes de frais en cours
 *   - ma voiture (véhicule assigné)
 *   - formations en cours (progression sauvegardée)
 *   - historique missions (les 3 dernières)
 *   - chartes à signer
 *
 * Accessible à tout user connecté (auto-scoped à ses propres données).
 * Idéal pour les groupes qui n'ont que `self.read` — c'est leur point d'entrée.
 */
export default async function MyHubPage() {
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canViewPrices = perms.includes("finance.view_prices");

  const today = new Date();
  const in60 = new Date(Date.now() + 60 * 24 * 3600 * 1000);

  const [me, currentMission, pastMissions, myVehicle, myPendingExpenses, myPolicies, myTrainings] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { id: true, firstName: true, lastName: true, email: true, photoUrl: true }
    }),
    prisma.mission.findFirst({
      where: {
        consultantId: session.user.id,
        status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] }
      },
      include: {
        company: true,
        intermediaryCompany: { select: { name: true } },
        missionRequest: { select: { reference: true } }
      },
      orderBy: { startDate: "desc" }
    }),
    prisma.mission.findMany({
      where: {
        consultantId: session.user.id,
        status: { in: ["COMPLETED", "CANCELLED"] }
      },
      include: { company: { select: { name: true } } },
      orderBy: { endDate: "desc" },
      take: 3
    }),
    prisma.vehicle.findFirst({
      where: {
        assignments: { some: { userId: session.user.id, endDate: null } }
      },
      include: {
        leasingContract: { select: { lessor: true, endDate: true } }
      }
    }),
    prisma.expenseReport.findMany({
      where: {
        userId: session.user.id,
        status: { in: ["DRAFT", "SUBMITTED"] }
      },
      orderBy: { date: "desc" },
      take: 5
    }),
    prisma.documentSignature.findMany({
      where: { userId: session.user.id, status: "PENDING" },
      include: {
        document: { select: { title: true, category: true, mandatory: true } }
      }
    }),
    prisma.userCourseProgress.findMany({
      where: {
        userId: session.user.id,
        completedAt: null
      },
      include: {
        course: {
          select: { id: true, slug: true, title: true, subtitle: true, level: true, _count: { select: { slides: true } } }
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 4
    })
  ]);

  const leaveBalance = await computeLeaveBalance(session.user.id);
  const firstName = me.firstName ?? session.user.name.split(" ")[0];
  const dateStr = today.toLocaleDateString("fr-BE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  // Jours restants sur la mission actuelle
  const missionDaysLeft = currentMission
    ? Math.max(0, Math.round((currentMission.endDate.getTime() - today.getTime()) / (24 * 3600 * 1000)))
    : null;

  return (
    <div className="space-y-6">
      {/* ═══ HERO — mission actuelle ═══ */}
      <HeroCard
        pill={dateStr.toUpperCase()}
        title={`Bonjour ${firstName}.`}
        subtitle={currentMission
          ? `Tu es en mission chez ${currentMission.company.name} — ${currentMission.title}.`
          : "Pas de mission active en ce moment."}
      >
        {currentMission && (
          <div className="mt-6 flex flex-wrap gap-8 items-end">
            <div>
              <div className="pill bg-white/10 text-white backdrop-blur-sm">MISSION EN COURS</div>
              <div className="mt-3 text-lg font-semibold text-white">
                {currentMission.company.name}
                {currentMission.intermediaryCompany && (
                  <span className="ml-2 text-sm font-normal text-indigoaccent-light">
                    via {currentMission.intermediaryCompany.name}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-indigoaccent-light">
                {formatDate(currentMission.startDate)} → {formatDate(currentMission.endDate)}
              </div>
            </div>
            <div className="ml-auto">
              <div className="text-[10px] font-mono uppercase tracking-widest text-indigoaccent-light">Fin dans</div>
              <div className="text-6xl font-extrabold tracking-tight text-white leading-none">
                {missionDaysLeft}
                <span className="text-xl font-semibold text-indigoaccent-light ml-2">jours</span>
              </div>
            </div>
            <Link
              href={`/missions/${currentMission.id}`}
              className="pill bg-white text-midnight-900 hover:bg-white/90 transition-colors"
            >
              Voir la fiche mission →
            </Link>
          </div>
        )}
      </HeroCard>

      {/* ═══ GRILLE DE WIDGETS ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Congés */}
        <Link href="/leaves" className="card p-5 group cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Sun className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent group-hover:translate-x-1 transition-all" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400 mb-1">Congés restants</div>
          <div className="text-3xl font-extrabold tracking-tight text-midnight-900 leading-none">
            {leaveBalance.total.remaining.toFixed(1)}<span className="text-xl text-midnight-400 font-semibold">j</span>
          </div>
          <div className="text-xs text-midnight-400 mt-2">
            Sur {leaveBalance.total.entitled.toFixed(1)} j alloués · {leaveBalance.total.approved.toFixed(1)} déjà pris
          </div>
        </Link>

        {/* Notes de frais */}
        <Link href="/expenses?mine=1" className="card p-5 group cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent group-hover:translate-x-1 transition-all" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400 mb-1">Notes de frais</div>
          <div className="text-3xl font-extrabold tracking-tight text-midnight-900 leading-none">
            {myPendingExpenses.length}
          </div>
          <div className="text-xs text-midnight-400 mt-2">
            {myPendingExpenses.filter((e: any) => e.status === "DRAFT").length} brouillon(s) ·{" "}
            {myPendingExpenses.filter((e: any) => e.status === "SUBMITTED").length} soumise(s)
          </div>
        </Link>

        {/* Ma voiture */}
        <Link
          href={myVehicle ? `/fleet/${myVehicle.id}` : "/fleet"}
          className="card p-5 group cursor-pointer"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigoaccent/10 text-indigoaccent flex items-center justify-center">
              <Car className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent group-hover:translate-x-1 transition-all" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400 mb-1">Ma voiture</div>
          {myVehicle ? (
            <>
              <div className="text-lg font-bold text-midnight-900 leading-tight">
                {myVehicle.brand} {myVehicle.model}
              </div>
              <div className="font-mono text-xs text-midnight-500 mt-1 tabular-nums">{myVehicle.plate}</div>
              {myVehicle.leasingContract && (
                <div className="text-[11px] text-midnight-400 mt-2">
                  {myVehicle.leasingContract.lessor} · fin {formatDate(myVehicle.leasingContract.endDate)}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-midnight-400 italic">Aucun véhicule attribué</div>
          )}
        </Link>

        {/* Chartes à signer */}
        <Link href="/policies" className={cn("card p-5 group cursor-pointer", myPolicies.length > 0 && "border-red-200")}>
          <div className="flex items-start justify-between mb-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              myPolicies.length > 0 ? "bg-red-500/10 text-red-600" : "bg-midnight-100 text-midnight-500"
            )}>
              <FileSignature className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent group-hover:translate-x-1 transition-all" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400 mb-1">Chartes à signer</div>
          <div className={cn(
            "text-3xl font-extrabold tracking-tight leading-none",
            myPolicies.length > 0 ? "text-red-600" : "text-midnight-900"
          )}>
            {myPolicies.length}
          </div>
          <div className="text-xs text-midnight-400 mt-2">
            {myPolicies.length === 0 ? "Tout est signé 👍" : `${myPolicies.filter((p: any) => p.document.mandatory).length} obligatoire(s)`}
          </div>
        </Link>

        {/* Historique missions — span 2 */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400">Historique missions</div>
              <div className="text-lg font-bold text-midnight-900 mt-0.5">Où j'ai bossé.</div>
            </div>
            <Briefcase className="w-5 h-5 text-midnight-300" />
          </div>
          {pastMissions.length === 0 ? (
            <div className="text-sm text-midnight-400 italic py-4 text-center">
              {currentMission ? "Première mission chez Dasolabs — bienvenue !" : "Pas d'historique pour l'instant."}
            </div>
          ) : (
            <div className="space-y-2">
              {pastMissions.map((m: any) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-indigoaccent/[.03] transition-colors group"
                >
                  <div className="w-2 h-2 rounded-full bg-midnight-200 group-hover:bg-indigoaccent" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-midnight-900 truncate">{m.title}</div>
                    <div className="font-mono text-[11px] text-midnight-400 tabular-nums">
                      {m.company.name} · {formatDate(m.startDate)} → {formatDate(m.endDate)}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Formations en cours */}
        <Link href="/training" className="card p-5 group cursor-pointer">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigoaccent/10 text-indigoaccent flex items-center justify-center">
              <GraduationCap className="w-5 h-5" />
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-300 group-hover:text-indigoaccent group-hover:translate-x-1 transition-all" />
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-midnight-400 mb-1">Formations en cours</div>
          <div className="text-3xl font-extrabold tracking-tight text-midnight-900 leading-none">
            {myTrainings.length}
          </div>
          {myTrainings[0] && (
            <div className="text-xs text-midnight-400 mt-2 truncate">
              Dernière : {myTrainings[0].course.title}
            </div>
          )}
        </Link>
      </div>

      {/* ═══ FORMATIONS DÉTAIL — si en cours ═══ */}
      {myTrainings.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="pill-ink mb-2">FORMATIONS · MA PROGRESSION</div>
              <div className="text-2xl font-extrabold text-midnight-900 tracking-tight">Reprends là où tu t'es arrêté.</div>
            </div>
            <Link href="/training" className="btn-ghost text-sm">Voir toutes →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myTrainings.map((t: any) => {
              const pct = t.course._count.slides > 0
                ? Math.round((t.lastSlide / t.course._count.slides) * 100)
                : 0;
              return (
                <Link
                  key={t.courseId}
                  href={`/training/${t.course.slug}/${t.lastSlide}`}
                  className="p-4 rounded-xl border border-border/60 hover:border-indigoaccent transition-all group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="pill bg-indigoaccent/10 text-indigoaccent">
                      {t.course.level ?? "En cours"}
                    </div>
                    <div className="font-mono text-xs text-midnight-400">{pct}%</div>
                  </div>
                  <div className="font-semibold text-midnight-900 leading-tight">{t.course.title}</div>
                  {t.course.subtitle && (
                    <div className="text-xs text-midnight-400 mt-1">{t.course.subtitle}</div>
                  )}
                  <div className="mt-3 h-1.5 rounded-full bg-midnight-100 overflow-hidden">
                    <div className="h-full bg-indigoaccent" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-midnight-400 tabular-nums">
                    Slide {t.lastSlide} / {t.course._count.slides}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
