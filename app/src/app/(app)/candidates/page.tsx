import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, Plus, MapPin, CalendarClock, Briefcase, Languages, LayoutGrid, List as ListIcon } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CandidateAvatar } from "./avatar";
import { LinkedInImportButton } from "./linkedin-import-button";
import { CandidateQuickActions } from "./quick-actions";
import { FilterChips } from "@/components/ui/filter-chips";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";

export default async function CandidatesPage({ searchParams }: { searchParams: { q?: string; status?: string; skill?: string; view?: string } }) {
  await requirePermission("consulting.read");
  const statuses = parseMulti(searchParams.status);
  const where: any = {};
  if (statuses.length > 0) {
    where.status = inFilter(statuses);
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

  const view: "grid" | "list" = searchParams?.view === "list" ? "list" : "grid";
  // Construit l'URL de l'autre vue en préservant les autres filtres
  function buildViewHref(targetView: "grid" | "list") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams ?? {})) {
      if (k === "view" || !v) continue;
      params.set(k, String(v));
    }
    params.set("view", targetView);
    return `/candidates?${params.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Candidats"
        subtitle={`${list.length} candidat(s) — vivier consultance`}
        actions={
          <div className="flex gap-2">
            <LinkedInImportButton />
            <Link href="/candidates/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau candidat</Link>
          </div>
        }
      />

      <div className="mb-5 space-y-3">
        <FilterChips
          paramName="status"
          label="Statut"
          options={[
            { value: "ACTIVE",      label: "Actif",         tone: "success" },
            { value: "UNAVAILABLE", label: "Indisponible",  tone: "warning" },
            { value: "ENGAGED",     label: "En mission",    tone: "info" },
            { value: "ARCHIVED",    label: "Archivé/recruté", tone: "neutral" }
          ]}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PreservedSearchForm
            searchParams={searchParams as Record<string, string | undefined>}
            except={["q", "skill", "page"]}
            className="flex gap-2 flex-wrap items-center"
          >
            <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, email..." className="input max-w-xs text-sm" />
            <input name="skill" defaultValue={searchParams.skill ?? ""} placeholder="Compétence (ex: react)" className="input max-w-xs text-sm" />
            <button className="btn-secondary btn-sm">Rechercher</button>
            {(searchParams.q || searchParams.status || searchParams.skill) && (
              <Link href="/candidates" className="btn-ghost btn-sm">Réinitialiser tous</Link>
            )}
          </PreservedSearchForm>

          {/* Toggle vue grille / liste */}
          <div className="inline-flex items-center bg-midnight-50 border border-border rounded-md p-0.5">
            <Link
              href={buildViewHref("grid")}
              className={
                "px-2.5 py-1 text-xs font-medium rounded inline-flex items-center gap-1 transition " +
                (view === "grid" ? "bg-white shadow-sm text-midnight-900" : "text-midnight-500 hover:text-midnight-700")
              }
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grille
            </Link>
            <Link
              href={buildViewHref("list")}
              className={
                "px-2.5 py-1 text-xs font-medium rounded inline-flex items-center gap-1 transition " +
                (view === "list" ? "bg-white shadow-sm text-midnight-900" : "text-midnight-500 hover:text-midnight-700")
              }
            >
              <ListIcon className="w-3.5 h-3.5" /> Liste
            </Link>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserPlus}
            title="Aucun candidat"
            description="Construisez votre vivier en ajoutant vos premiers profils."
            action={<Link href="/candidates/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>}
          />
        </div>
      ) : view === "list" ? (
        <CandidateListView list={list as any[]} />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5">
          {list.map(c => <CandidateTile key={c.id} c={c as any} />)}
        </div>
      )}
    </div>
  );
}

function CandidateListView({ list }: { list: any[] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-midnight-50/40">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Nom</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Séniorité</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Compétences</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Ville</th>
            <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Tarif/j</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Dispo</th>
            <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase tracking-wide">Statut</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className="border-t border-border/40 hover:bg-midnight-50/30">
              <td className="px-3 py-2">
                <Link href={`/candidates/${c.id}`} className="flex items-center gap-2 hover:text-indigoaccent">
                  <CandidateAvatar firstName={c.firstName} lastName={c.lastName} size={28} className="rounded-full shrink-0" />
                  <span className="font-medium text-midnight-900 truncate">{c.firstName} {c.lastName}</span>
                </Link>
              </td>
              <td className="px-3 py-2 text-midnight-700 text-xs">
                {c.seniority ?? "—"}{c.yearsExperience ? ` · ${c.yearsExperience}a` : ""}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-0.5 flex-wrap max-w-[280px]">
                  {(c.skills as string[]).slice(0, 4).map((s) => (
                    <span key={s} className="badge-info text-[9px] px-1.5 py-0">{s}</span>
                  ))}
                  {c.skills.length > 4 && <span className="badge-neutral text-[9px] px-1.5 py-0">+{c.skills.length - 4}</span>}
                </div>
              </td>
              <td className="px-3 py-2 text-midnight-700 text-xs truncate max-w-[120px]">{c.city ?? "—"}</td>
              <td className="px-3 py-2 text-right text-midnight-700 text-xs tabular-nums">
                {c.dailyCost ? formatCurrency(c.dailyCost) : "—"}
              </td>
              <td className="px-3 py-2 text-midnight-700 text-xs">
                {c.availableFrom ? formatDate(c.availableFrom) : (c.status === "ACTIVE" ? <span className="text-emerald-600">immédiat</span> : "—")}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status === "ACTIVE" ? "ACTIVE_CT" : c.status} />
              </td>
              <td className="px-3 py-2 w-10 text-right">
                <CandidateQuickActions id={c.id} current={c.status} compact />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateTile({ c }: { c: any }) {
  const archived = ["ARCHIVED"].includes(c.status);
  const unavailable = c.status === "UNAVAILABLE";
  return (
    <div className="relative group">
      {/* Action rapide positionnée sur la tuile, visible au hover */}
      <div className="absolute top-1 left-1 z-20 opacity-0 group-hover:opacity-100 transition">
        <CandidateQuickActions id={c.id} current={c.status} compact />
      </div>
      <Link
        href={`/candidates/${c.id}`}
        className={
          "card overflow-hidden flex flex-col hover:shadow-lg hover:border-indigoaccent/40 transition-all h-full " +
          (archived ? "opacity-60" : "")
        }
      >
        {/* Photo compacte — ratio 4:3 au lieu de carré pour gagner en hauteur */}
        <div className="relative bg-gradient-to-br from-midnight-900 to-midnight-700 aspect-[4/3] overflow-hidden">
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
              <CandidateAvatar firstName={c.firstName} lastName={c.lastName} size={42} className="rounded-full ring-2 ring-white/10" />
            </div>
          )}
          <div className="absolute top-1 right-1 scale-75 origin-top-right">
            <StatusBadge status={c.status === "ACTIVE" ? "ACTIVE_CT" : c.status} />
          </div>
          {c._count?.applications > 0 && (
            <div className="absolute bottom-1 left-1 bg-white/90 text-midnight-900 text-[9px] font-medium rounded-full px-1.5 py-0.5">
              {c._count.applications} mis.
            </div>
          )}
        </div>

        <div className="p-2 flex-1 flex flex-col gap-1">
          <div>
            <h3 className="font-semibold text-midnight-900 leading-tight text-xs truncate">{c.firstName} {c.lastName}</h3>
            {c.seniority && <p className="text-[10px] text-midnight-500 truncate">{c.seniority}{c.yearsExperience ? ` · ${c.yearsExperience}a` : ""}</p>}
          </div>

          <div className="flex flex-wrap gap-0.5">
            {(c.skills as string[]).slice(0, 2).map(s => <span key={s} className="badge-info text-[9px] px-1 py-0">{s}</span>)}
            {c.skills.length > 2 && <span className="badge-neutral text-[9px] px-1 py-0">+{c.skills.length - 2}</span>}
          </div>

          <div className="flex flex-col gap-0.5 text-[10px] text-midnight-700 mt-auto pt-1 border-t border-border/60">
            {c.city && <span className="flex items-center gap-1 truncate"><MapPin className="w-2.5 h-2.5 text-midnight-400 shrink-0" /> {c.city}</span>}
            {c.dailyCost && <span className="flex items-center gap-1 tabular-nums"><Briefcase className="w-2.5 h-2.5 text-midnight-400" /> {formatCurrency(c.dailyCost)}/j</span>}
          </div>
        </div>
      </Link>
    </div>
  );
}
