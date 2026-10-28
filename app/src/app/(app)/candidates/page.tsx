import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserPlus, Plus, MapPin, CalendarClock, Briefcase, Languages, LayoutGrid, List } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CandidateAvatar } from "./avatar";
import { LinkedInImportButton } from "./linkedin-import-button";
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
          <div className="flex gap-2 items-center">
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <Link href={buildViewHref("grid")} className={`px-2 py-1.5 text-xs flex items-center gap-1 ${view === "grid" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50"}`} title="Vue grille">
                <LayoutGrid className="w-3.5 h-3.5" /> Grille
              </Link>
              <Link href={buildViewHref("list")} className={`px-2 py-1.5 text-xs flex items-center gap-1 border-l border-border ${view === "list" ? "bg-midnight-900 text-white" : "text-midnight-600 hover:bg-midnight-50"}`} title="Vue liste">
                <List className="w-3.5 h-3.5" /> Liste
              </Link>
            </div>
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
