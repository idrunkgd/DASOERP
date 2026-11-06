import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, Plus, MapPin, CalendarClock, Briefcase, Languages, LayoutGrid, List, Euro } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CandidateAvatar } from "./avatar";
import { CvImportButton } from "./cv-import-button";
import { FilterChips } from "@/components/ui/filter-chips";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";
import { geocodeCity, haversineKm } from "@/lib/geocoding";

export const dynamic = "force-dynamic";

type CandidateSearchParams = {
  q?: string;
  status?: string;
  skill?: string;          // multi "a,b,c" OU simple "a"
  seniority?: string;      // multi
  title?: string;          // filtre texte sur jobTitle
  costMin?: string;        // €/j coût min
  costMax?: string;        // €/j coût max
  rateMin?: string;        // €/j tarif facturable min
  rateMax?: string;        // €/j tarif facturable max
  loc?: string;            // ville de référence
  km?: string;             // rayon en km autour de loc
  view?: string;
};

export default async function CandidatesPage({ searchParams }: { searchParams: CandidateSearchParams }) {
  await requirePermission("consulting.read");
  const statuses = parseMulti(searchParams.status);
  const skills = parseMulti(searchParams.skill);
  const seniorities = parseMulti(searchParams.seniority);
  const title = (searchParams.title || "").trim();
  const costMin = Number(searchParams.costMin) || null;
  const costMax = Number(searchParams.costMax) || null;
  const rateMin = Number(searchParams.rateMin) || null;
  const rateMax = Number(searchParams.rateMax) || null;
  const loc = (searchParams.loc || "").trim();
  const km = Math.max(0, Math.min(2000, Number(searchParams.km) || 0));

  const where: any = {};
  if (statuses.length > 0) {
    where.status = inFilter(statuses);
  } else {
    where.status = { in: ["ACTIVE", "UNAVAILABLE"] };
    where.convertedToUser = { is: null };
  }
  if (searchParams.q) where.OR = [
    { firstName: { contains: searchParams.q, mode: "insensitive" } },
    { lastName:  { contains: searchParams.q, mode: "insensitive" } },
    { email:     { contains: searchParams.q, mode: "insensitive" } }
  ];
  // Compétences : AND de has — un candidat doit avoir TOUTES les skills cochées
  if (skills.length > 0) where.AND = skills.map((s) => ({ skills: { has: s } }));
  if (seniorities.length > 0) where.seniority = { in: seniorities };
  if (title) {
    where.jobTitle = { contains: title, mode: "insensitive" };
  }
  if (costMin != null || costMax != null) {
    where.dailyCost = {};
    if (costMin != null) where.dailyCost.gte = costMin;
    if (costMax != null) where.dailyCost.lte = costMax;
  }
  if (rateMin != null || rateMax != null) {
    where.dailyRate = {};
    if (rateMin != null) where.dailyRate.gte = rateMin;
    if (rateMax != null) where.dailyRate.lte = rateMax;
  }

  let list: any[] = await prisma.candidate.findMany({
    where, orderBy: [{ status: "asc" }, { lastName: "asc" }],
    include: {
      _count: { select: { applications: true } },
      salaryScenarios: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { grossMonthly: true }
      }
    }
  });

  // Filtre rayon : géocode le point de recherche puis filtre JS par Haversine.
  // Les candidats sans coords sont EXCLUS quand ce filtre est actif.
  let locGeo: { lat: number; lng: number; display: string } | null = null;
  if (loc && km > 0) {
    const g = await geocodeCity(loc);
    if (g) {
      locGeo = { lat: g.latitude, lng: g.longitude, display: g.displayName };
      list = list.filter((c) =>
        c.latitude != null && c.longitude != null &&
        haversineKm(locGeo!.lat, locGeo!.lng, c.latitude, c.longitude) <= km
      );
    }
  }
  const view: "grid" | "list" = searchParams?.view === "list" ? "list" : "grid";
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
          <div className="flex gap-2 items-center flex-wrap">
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-white">
              <Link href={buildViewHref("grid")} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 ${view === "grid" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50"}`} title="Vue grille">
                <LayoutGrid className="w-3.5 h-3.5" /><span>Grille</span>
              </Link>
              <Link href={buildViewHref("list")} className={`px-2.5 py-1.5 text-xs flex items-center gap-1 border-l border-border ${view === "list" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50"}`} title="Vue liste">
                <List className="w-3.5 h-3.5" /><span>Liste</span>
              </Link>
            </div>
            <Link href="/candidates/benchmark" className="btn-secondary btn-sm" title="Benchmark salaires candidats">
              <Euro className="w-4 h-4" />
            </Link>
            <CvImportButton />
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
        <FilterChips
          paramName="seniority"
          label="Séniorité"
          multi={true}
          options={[
            { value: "JUNIOR",    label: "Junior" },
            { value: "MEDIOR",    label: "Medior" },
            { value: "CONFIRMED", label: "Confirmé" },
            { value: "SENIOR",    label: "Senior" },
            { value: "EXPERT",    label: "Expert" }
          ]}
        />
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "skill", "title", "costMin", "costMax", "rateMin", "rateMax", "loc", "km", "page"]}
          className="space-y-2"
        >
          {/* Ligne 1 : texte libre */}
          <div className="flex gap-2 flex-wrap items-center">
            <input name="q"     defaultValue={searchParams.q ?? ""}     placeholder="Nom, email..."         className="input max-w-[200px] text-sm" />
            <input name="title" defaultValue={searchParams.title ?? ""} placeholder="Titre (ex: Automation)" className="input max-w-[200px] text-sm" />
            <input name="skill" defaultValue={searchParams.skill ?? ""} placeholder="Compétences (CSV : TIA Portal, Siemens…)" className="input max-w-[320px] text-sm" />
          </div>
          {/* Ligne 2 : localisation + rayon */}
          <div className="flex gap-2 flex-wrap items-center">
            <MapPin className="w-4 h-4 text-midnight-500" />
            <input name="loc" defaultValue={searchParams.loc ?? ""} placeholder="Ville (ex: Bruxelles)" className="input max-w-[200px] text-sm" />
            <span className="text-xs text-midnight-500">rayon</span>
            <input name="km" type="number" min="0" max="2000" defaultValue={searchParams.km ?? ""} placeholder="km" className="input max-w-[80px] text-sm" />
            {locGeo && (
              <span className="text-[11px] text-midnight-500 italic">📍 {locGeo.display}</span>
            )}
          </div>
          {/* Ligne 3 : fourchettes tarifs */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-xs text-midnight-500">Coût/j</span>
            <input name="costMin" type="number" min="0" step="10" defaultValue={searchParams.costMin ?? ""} placeholder="min" className="input max-w-[90px] text-sm" />
            <input name="costMax" type="number" min="0" step="10" defaultValue={searchParams.costMax ?? ""} placeholder="max" className="input max-w-[90px] text-sm" />
            <span className="text-xs text-midnight-500 ml-3">Tarif facturable</span>
            <input name="rateMin" type="number" min="0" step="10" defaultValue={searchParams.rateMin ?? ""} placeholder="min" className="input max-w-[90px] text-sm" />
            <input name="rateMax" type="number" min="0" step="10" defaultValue={searchParams.rateMax ?? ""} placeholder="max" className="input max-w-[90px] text-sm" />
          </div>
          <div className="flex gap-2 items-center">
            <button className="btn-secondary btn-sm">Rechercher</button>
            {(searchParams.q || searchParams.status || searchParams.skill || searchParams.seniority || searchParams.title || searchParams.loc || searchParams.km || searchParams.costMin || searchParams.costMax || searchParams.rateMin || searchParams.rateMax) && (
              <Link href="/candidates" className="btn-ghost btn-sm">Réinitialiser tous</Link>
            )}
          </div>
        </PreservedSearchForm>
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
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-midnight-50 text-midnight-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Candidat</th>
                <th className="px-3 py-2 text-left font-medium">Séniorité</th>
                <th className="px-3 py-2 text-left font-medium">Compétences</th>
                <th className="px-3 py-2 text-left font-medium">Ville</th>
                <th className="px-3 py-2 text-right font-medium">Coût / j</th>
                <th className="px-3 py-2 text-left font-medium">Statut</th>
                <th className="px-3 py-2 text-right font-medium">Missions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c: any) => {
                const archived = c.status === "ARCHIVED";
                return (
                  <tr key={c.id} className={`border-t border-border/60 hover:bg-midnight-50/60 ${archived ? "opacity-60" : ""}`}>
                    <td className="px-3 py-2">
                      <Link href={`/candidates/${c.id}`} className="flex items-center gap-2">
                        <CandidateAvatar firstName={c.firstName} lastName={c.lastName} photoUrl={c.photoUrl} size={28} className="rounded-full" />
                        <span className="font-medium text-midnight-900 hover:text-indigoaccent">{c.firstName} {c.lastName}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-midnight-700">
                      {c.seniority ?? "—"}{c.yearsExperience ? ` · ${c.yearsExperience} ans` : ""}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(c.skills as string[]).slice(0, 4).map(s => <span key={s} className="badge-info text-[10px] px-1.5 py-0">{s}</span>)}
                        {c.skills.length > 4 && <span className="badge-neutral text-[10px] px-1.5 py-0">+{c.skills.length - 4}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-midnight-700">{c.city ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-midnight-700">
                      {c.dailyCost ? `${formatCurrency(c.dailyCost)}` : "—"}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={c.status === "ACTIVE" ? "ACTIVE_CT" : c.status} /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-midnight-700">{c._count?.applications ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
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
      title={`${c.firstName} ${c.lastName}${c.seniority ? " · " + c.seniority : ""}`}
    >
      {/* Photo — carrée, c'est le gros visuel de la dalle */}
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
            <CandidateAvatar firstName={c.firstName} lastName={c.lastName} size={40} className="rounded-full ring-2 ring-white/10" />
          </div>
        )}
        {c._count?.applications > 0 && (
          <div className="absolute top-0.5 right-0.5 bg-white/90 text-midnight-900 text-[9px] font-medium rounded-full px-1 py-0">
            {c._count.applications}
          </div>
        )}
      </div>

      <div className="px-1.5 py-1 flex flex-col">
        <h3 className="font-medium text-midnight-900 leading-tight text-[11px] truncate">{c.firstName} {c.lastName}</h3>
        {c.seniority && <p className="text-[10px] text-midnight-500 truncate">{c.seniority}</p>}
      </div>
    </Link>
  );
}
