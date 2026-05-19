import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Users as UsersIcon, MapPin, Briefcase, Languages, CalendarClock, Plane, CalendarCheck } from "lucide-react";
import { getConsultantMissionStatusBatch, type ConsultantMissionStatus } from "@/server/services/mission-status";

export const dynamic = "force-dynamic";

export default async function ConsultantsPage({ searchParams }: { searchParams: { q?: string; status?: string; skill?: string; role?: string; mission?: string } }) {
  await requirePermission("consulting.read");
  const where: any = {
    // EXCLUSIVITÉ Candidat / Consultant : on masque les Users qui sont des
    // comptes portail candidat (le candidat reste dans /candidates uniquement).
    candidateProfile: { is: null }
  };
  // Par défaut : seulement les consultants actifs (qui n'ont pas quitté Dasolabs).
  // L'utilisateur peut explicitement demander "inactive" ou "all".
  const statusFilter = searchParams.status ?? "active";
  if (statusFilter === "active") where.active = true;
  else if (statusFilter === "inactive") where.active = false;
  // statusFilter === "all" → pas de filtre
  if (searchParams.q) where.OR = [
    { firstName: { contains: searchParams.q, mode: "insensitive" } },
    { lastName:  { contains: searchParams.q, mode: "insensitive" } },
    { email:     { contains: searchParams.q, mode: "insensitive" } }
  ];
  if (searchParams.skill) where.skills = { has: searchParams.skill };
  if (searchParams.role) where.role = searchParams.role;
  // Par défaut : on n'affiche que les CONSULTANTS sur cette page. Les Managers,
  // Commerciaux, etc. ont leur propre rôle métier et n'ont pas vocation à
  // apparaître dans le pool "disponibles pour mission". L'utilisateur peut
  // explicitement filtrer sur un autre rôle via le select.
  if (!searchParams.role) where.role = "CONSULTANT";

  const list = await prisma.user.findMany({
    where, orderBy: [{ active: "desc" }, { lastName: "asc" }],
    include: {
      _count: { select: { projectMemberships: true, reviewsAsSubject: true } },
      projectMemberships: { include: { project: true }, take: 3 },
      recruitedFromCandidate: { select: { id: true } }
    }
  });

  // Statut "en mission" pour chaque consultant actif (1 requête batch).
  const missionStatuses = await getConsultantMissionStatusBatch(
    list.filter(u => u.active).map(u => u.id)
  );

  // Filtre côté serveur (post-query) sur l'état mission demandé.
  const missionFilter = searchParams.mission ?? "";
  const filteredList = missionFilter
    ? list.filter(u => {
        if (!u.active) return false;
        const ms = missionStatuses.get(u.id);
        if (missionFilter === "on_mission") return ms?.state === "on_mission";
        if (missionFilter === "available")  return ms?.state === "available";
        if (missionFilter === "scheduled")  return ms?.state === "scheduled";
        return true;
      })
    : list;

  const totalActive = list.filter(u => u.active).length;
  const onMission   = Array.from(missionStatuses.values()).filter(m => m.state === "on_mission").length;
  const available   = Array.from(missionStatuses.values()).filter(m => m.state === "available").length;
  const subtitle = statusFilter === "active"
    ? `${filteredList.length} affiché(s) sur ${list.length} actif(s) — ${onMission} en mission, ${available} disponibles`
    : statusFilter === "inactive"
    ? `${filteredList.length} ancien(s) consultant(s)`
    : `${totalActive} actif(s) sur ${list.length}`;

  return (
    <div>
      <PageHeader
        title="Consultants Dasolabs"
        subtitle={subtitle}
        actions={<Link href="/users/new" className="btn-primary">+ Nouveau (admin)</Link>}
      />

      <form className="mb-5 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, email..." className="input max-w-xs" />
        <input name="skill" defaultValue={searchParams.skill ?? ""} placeholder="Compétence (ex: react)" className="input max-w-xs" />
        <select name="role" defaultValue={searchParams.role ?? ""} className="input max-w-[200px]">
          <option value="">Tous rôles</option>
          <option value="CONSULTANT">Consultant</option>
          <option value="MANAGER">Manager</option>
          <option value="COMMERCIAL">Commercial</option>
          <option value="FINANCE">Finance</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select name="status" defaultValue={statusFilter} className="input max-w-[180px]">
          <option value="active">Actifs (par défaut)</option>
          <option value="inactive">Anciens (partis)</option>
          <option value="all">Tous</option>
        </select>
        <select name="mission" defaultValue={missionFilter} className="input max-w-[200px]">
          <option value="">Mission : peu importe</option>
          <option value="on_mission">En mission</option>
          <option value="available">Disponibles maintenant</option>
          <option value="scheduled">Programmés (futur)</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
        {(searchParams.q || searchParams.status || searchParams.skill || searchParams.role || searchParams.mission) && (
          <Link href="/consultants" className="btn-ghost">Réinitialiser</Link>
        )}
      </form>

      {filteredList.length === 0 ? (
        <div className="card">
          <EmptyState icon={UsersIcon} title="Aucun consultant" description={list.length === 0 ? "Recrutez depuis le vivier candidats ou créez un utilisateur." : "Aucun consultant ne correspond à ces filtres."} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {filteredList.map(c => <ConsultantTile key={c.id} c={c as any} mission={missionStatuses.get(c.id) ?? null} />)}
        </div>
      )}
    </div>
  );
}

function ConsultantTile({ c, mission }: { c: any; mission: ConsultantMissionStatus | null }) {
  const inactive = !c.active;
  const fromCandidate = !!c.recruitedFromCandidate;

  // Bandeau statut mission (haut de la dalle)
  let missionBadge: { label: string; tone: "success" | "warning" | "info" | "neutral" } | null = null;
  if (!inactive && mission) {
    if (mission.state === "on_mission") {
      missionBadge = { label: `En mission · jusqu'au ${formatDate(mission.latestEnd)}`, tone: "warning" };
    } else if (mission.state === "scheduled") {
      missionBadge = { label: `Disponible · mission le ${formatDate(mission.nextStart)}`, tone: "info" };
    } else {
      missionBadge = { label: "Disponible", tone: "success" };
    }
  }

  const currentMission = mission?.state === "on_mission" ? mission.current[0] : null;

  return (
    <Link
      href={`/consultants/${c.id}`}
      className={"card overflow-hidden flex flex-col hover:shadow-lg hover:border-indigoaccent/40 transition-all group " + (inactive ? "opacity-60" : "")}
    >
      <div className="relative bg-gradient-to-br from-midnight-900 to-midnight-700 aspect-square overflow-hidden">
        {c.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photoUrl} alt={`${c.firstName} ${c.lastName}`} className={"w-full h-full object-cover transition-transform group-hover:scale-105 " + (inactive ? "grayscale" : "")} loading="lazy" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <PersonAvatar firstName={c.firstName} lastName={c.lastName} size={56} className="rounded-full ring-2 ring-white/10" />
          </div>
        )}
        <div className="absolute top-1 right-1 flex gap-0.5 scale-90 origin-top-right">
          {inactive ? <span className="badge-neutral text-[9px] px-1.5 py-0">Parti</span> : <span className="badge-success text-[9px] px-1.5 py-0">Actif</span>}
        </div>
        {missionBadge && (
          <div className={
            "absolute bottom-1 left-1 right-1 text-[10px] font-medium rounded px-1.5 py-0.5 flex items-center gap-1 truncate " +
            (missionBadge.tone === "warning" ? "bg-amber-500/95 text-white" :
             missionBadge.tone === "info"    ? "bg-indigoaccent/95 text-white" :
             missionBadge.tone === "success" ? "bg-emerald-600/95 text-white" :
                                                "bg-white/90 text-midnight-900")
          }>
            {missionBadge.tone === "warning" ? <Plane className="w-2.5 h-2.5 shrink-0" /> : <CalendarCheck className="w-2.5 h-2.5 shrink-0" />}
            <span className="truncate">{missionBadge.label}</span>
          </div>
        )}
      </div>

      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <div>
          <h3 className="font-semibold text-midnight-900 leading-tight text-sm truncate">{c.firstName} {c.lastName}</h3>
          {c.seniority && <p className="text-[11px] text-midnight-500 truncate">{c.seniority}{c.yearsExperience ? ` · ${c.yearsExperience} ans` : ""}</p>}
        </div>

        {currentMission && (
          <div className="text-[11px] text-midnight-700 bg-amber-50/60 border border-amber-200/60 rounded px-1.5 py-0.5 truncate">
            <span className="font-medium">{currentMission.companyName}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-0.5">
          {(c.skills as string[] ?? []).slice(0, 3).map(s => <span key={s} className="badge-info text-[9px] px-1.5 py-0">{s}</span>)}
          {(c.skills?.length ?? 0) > 3 && <span className="badge-neutral text-[9px] px-1.5 py-0">+{c.skills.length - 3}</span>}
        </div>

        <div className="flex flex-col gap-0.5 text-[11px] text-midnight-700 mt-auto pt-1.5 border-t border-border/60">
          {c.city && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-midnight-400 shrink-0" /> {c.city}</span>}
          {c.dailyCost && <span className="flex items-center gap-1 tabular-nums"><Briefcase className="w-3 h-3 text-midnight-400" /> {formatCurrency(c.dailyCost)}/j</span>}
        </div>
      </div>
    </Link>
  );
}
