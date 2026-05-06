import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, Plus, MapPin, CalendarClock, Briefcase, Languages } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CandidateAvatar } from "./avatar";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({ searchParams }: { searchParams: { q?: string; status?: string; skill?: string } }) {
  await requirePermission("consulting.read");
  const where: any = {};
  if (searchParams.status) {
    where.status = searchParams.status;
  } else {
    // Exclusivité Candidat / Consultant : par défaut, on masque
    //  - les candidats ARCHIVED (déjà recrutés en interne)
    //  - les candidats déjà liés à un User actif (sécurité belt-and-braces)
    where.status = { in: ["ACTIVE", "UNAVAILABLE"] };
    where.convertedToUser = { is: null };
  }
  if (searchParams.q) where.OR = [
    { firstName: { contains: searchParams.q, mode: "insensitive" } },
    { lastName:  { contains: searchParams.q, mode: "insensitive" } },
    { email:     { contains: searchParams.q, mode: "insensitive" } }
  ];
  if (searchParams.skill) where.skills = { has: searchParams.skill };
  const list = await prisma.candidate.findMany({
    where, orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: { _count: { select: { applications: true } } }
  });

  return (
    <div>
      <PageHeader
        title="Candidats"
        subtitle={`${list.length} candidat(s) — vivier consultance`}
        actions={<Link href="/candidates/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau candidat</Link>}
      />

      <form className="mb-5 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, email..." className="input max-w-xs" />
        <input name="skill" defaultValue={searchParams.skill ?? ""} placeholder="Compétence (ex: react)" className="input max-w-xs" />
        <select name="status" defaultValue={searchParams.status ?? ""} className="input max-w-[220px]">
          <option value="">Disponibles + indispo (par défaut)</option>
          <option value="ACTIVE">Actifs uniquement</option>
          <option value="UNAVAILABLE">Indisponibles uniquement</option>
          <option value="ENGAGED">En mission</option>
          <option value="ARCHIVED">Archivés / recrutés</option>
        </select>
        <button className="btn-secondary">Filtrer</button>
        {(searchParams.q || searchParams.status || searchParams.skill) && (
          <Link href="/candidates" className="btn-ghost">Réinitialiser</Link>
        )}
      </form>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserPlus}
            title="Aucun candidat"
            description="Construisez votre vivier en ajoutant vos premiers profils."
            action={<Link href="/candidates/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {list.map(c => <CandidateTile key={c.id} c={c as any} />)}
        </div>
      )}
    </div>
  );
}

function CandidateTile({ c }: { c: any }) {
  const archived = ["ARCHIVED"].includes(c.status);
  const unavailable = c.status === "UNAVAILABLE";
  return (
    <Link
      href={`/candidates/${c.id}`}
      className={
        "card overflow-hidden flex flex-col hover:shadow-lg hover:border-indigoaccent/40 transition-all group " +
        (archived ? "opacity-60" : "")
      }
    >
      {/* Photo — carrée pour gagner en compacité */}
      <div className="relative bg-gradient-to-br from-midnight-900 to-midnight-700 aspect-square overflow-hidden">
        {c.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.photoUrl}
            alt={`${c.firstName} ${c.lastName}`}
            className={
              "w-full h-full object-cover transition-transform group-hover:scale-105 " +
              (unavailable ? "grayscale-[40%]" : "")
            }
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <CandidateAvatar firstName={c.firstName} lastName={c.lastName} size={56} className="rounded-full ring-2 ring-white/10" />
          </div>
        )}
        <div className="absolute top-1 right-1 scale-90 origin-top-right">
          <StatusBadge status={c.status === "ACTIVE" ? "ACTIVE_CT" : c.status} />
        </div>
        {c._count?.applications > 0 && (
          <div className="absolute bottom-1 left-1 bg-white/90 text-midnight-900 text-[10px] font-medium rounded-full px-1.5 py-0.5">
            {c._count.applications} mis.
          </div>
        )}
      </div>

      <div className="p-2.5 flex-1 flex flex-col gap-1.5">
        <div>
          <h3 className="font-semibold text-midnight-900 leading-tight text-sm truncate">{c.firstName} {c.lastName}</h3>
          {c.seniority && <p className="text-[11px] text-midnight-500 truncate">{c.seniority}{c.yearsExperience ? ` · ${c.yearsExperience} ans` : ""}</p>}
        </div>

        <div className="flex flex-wrap gap-0.5">
          {(c.skills as string[]).slice(0, 3).map(s => <span key={s} className="badge-info text-[9px] px-1.5 py-0">{s}</span>)}
          {c.skills.length > 3 && <span className="badge-neutral text-[9px] px-1.5 py-0">+{c.skills.length - 3}</span>}
        </div>

        <div className="flex flex-col gap-0.5 text-[11px] text-midnight-700 mt-auto pt-1.5 border-t border-border/60">
          {c.city && <span className="flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-midnight-400 shrink-0" /> {c.city}</span>}
          {c.dailyCost && <span className="flex items-center gap-1 tabular-nums"><Briefcase className="w-3 h-3 text-midnight-400" /> {formatCurrency(c.dailyCost)}/j</span>}
        </div>
      </div>
    </Link>
  );
}
