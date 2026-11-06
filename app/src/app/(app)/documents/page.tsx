// Liste des documents avec filtres : recherche texte, tag, entité liée,
// expiration. Affiche uniquement les "docs racine" (V1) — les versions sont
// regroupées sous la fiche détail.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileIcon,
  Plus,
  Building2,
  FolderKanban,
  FileText,
  User as UserIcon,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import { UploadDocumentForm } from "./upload-form";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti } from "@/lib/filters";
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, DOC_CATEGORY_TONES } from "./categories";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: { q?: string; tag?: string; expiring?: string; category?: string };
}) {
  // Documents = repo global (contrats, chartes, docs projets/clients). Exige
  // documents.read explicitement. self.read seul ne suffit PAS — les docs
  // perso d'un user (contrat signé, CV) sont accessibles via /me.
  await requirePermissionOrRedirect("documents.read");

  const q = (searchParams.q || "").trim();
  const tags = parseMulti(searchParams.tag);
  const categories = parseMulti(searchParams.category);
  const expiring = searchParams.expiring === "1";
  // Pas de filtre spécifique → on groupe par catégorie dans l'affichage
  const groupByCategory = !q && tags.length === 0 && categories.length === 0 && !expiring;

  const where: any = { parentDocumentId: null };
  if (q.length >= 2) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { originalName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } }
    ];
  }
  if (tags.length > 0) where.tags = { hasSome: tags };
  if (categories.length > 0) where.category = { in: categories };
  if (expiring) {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    where.expiresAt = { lte: in30, gte: new Date() };
  }

  const [documents, allTags, companies, projects, offers, consultants] =
    await Promise.all([
      prisma.document.findMany({
        where,
        // En mode groupé on augmente la limite pour que chaque catégorie ait
        // de quoi afficher. Les filtres limitent naturellement le set.
        take: groupByCategory ? 200 : PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          project: { select: { id: true, name: true, reference: true } },
          offer: { select: { id: true, title: true, reference: true } },
          consultant: { select: { id: true, firstName: true, lastName: true } },
          uploadedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { versions: true } }
        }
      }),
      prisma.document.findMany({
        where: { parentDocumentId: null },
        select: { tags: true }
      }),
      prisma.company.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true }
      }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, reference: true }
      }),
      prisma.offer.findMany({
        where: { parentOfferId: null, nextVersion: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, reference: true }
      }),
      prisma.user.findMany({
        where: { active: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        select: { id: true, firstName: true, lastName: true }
      })
    ]);

  const distinctTags = Array.from(
    new Set(allTags.flatMap((d) => d.tags))
  ).sort();

  // Comptage par catégorie pour les filter-chips (incluant "sans catégorie")
  const categoryCountsRaw = await (prisma as any).document.groupBy({
    by: ["category"],
    where: { parentDocumentId: null },
    _count: { _all: true }
  });
  const categoryCounts: Record<string, number> = {};
  for (const row of categoryCountsRaw) {
    categoryCounts[row.category ?? "__NULL__"] = row._count._all;
  }

  // Compte des docs qui expirent dans les 30 jours
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  const expiringCount = await prisma.document.count({
    where: {
      parentDocumentId: null,
      expiresAt: { lte: in30, gte: new Date() }
    }
  });

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Contrats, NDAs, procédures, livrables — tout au même endroit."
      />

      <div className="card mb-6">
        <div className="card-header font-semibold">Uploader un document</div>
        <div className="p-4">
          <UploadDocumentForm
            companies={companies}
            projects={projects}
            offers={offers}
            consultants={consultants}
            existingTags={distinctTags}
          />
        </div>
      </div>

      <div className="card p-3 mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">Catégorie</span>
          <FilterChips
            paramName="category"
            label="Catégorie"
            multi={true}
            options={DOC_CATEGORIES.map((c) => ({
              value: c.value,
              label: categoryCounts[c.value]
                ? `${c.label} (${categoryCounts[c.value]})`
                : c.label
            }))}
          />
        </div>
        {distinctTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">Tags</span>
            <FilterMultiSelect
              paramName="tag"
              label="Tags"
              options={distinctTags.map((t) => ({ value: t, label: t }))}
              placeholder="Chercher un tag…"
            />
          </div>
        )}
        <FilterChips
          paramName="expiring"
          label="Filtres rapides"
          multi={false}
          options={[
            { value: "1", label: `Expire dans 30j${expiringCount > 0 ? ` (${expiringCount})` : ""}`, tone: "warning" }
          ]}
        />
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "page"]}
          className="flex flex-wrap gap-2 items-center"
        >
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher..."
            className="input max-w-xs text-sm"
          />
          <button className="btn-secondary btn-sm">Rechercher</button>
          {(q || tags.length > 0 || categories.length > 0 || expiring) && (
            <Link href="/documents" className="text-xs text-midnight-500 hover:underline">
              Réinitialiser tous
            </Link>
          )}
        </PreservedSearchForm>
      </div>

      {documents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileIcon}
            title={q || tags.length > 0 || expiring ? "Aucun résultat" : "Aucun document"}
            description={
              q || tags.length > 0 || expiring
                ? "Aucun document ne correspond à ces filtres."
                : "Uploade ton premier document ci-dessus."
            }
          />
        </div>
      ) : groupByCategory ? (
        <div className="space-y-6">
          {(() => {
            // Groupe les docs par catégorie (null → "OTHER" visuellement "Non classé")
            const byCat = new Map<string, typeof documents>();
            for (const d of documents) {
              const key = d.category ?? "__UNCAT__";
              if (!byCat.has(key)) byCat.set(key, [] as any);
              byCat.get(key)!.push(d);
            }
            // Ordre : catégories prédéfinies dans l'ordre + "Non classé" à la fin
            const order: Array<{ key: string; label: string; tone: string }> = [
              ...DOC_CATEGORIES.map((c) => ({ key: c.value, label: c.label, tone: c.tone })),
              { key: "__UNCAT__", label: "Non classé", tone: "bg-midnight-100 text-midnight-700" }
            ];
            return order
              .filter((o) => (byCat.get(o.key)?.length ?? 0) > 0)
              .map((o) => (
                <div key={o.key} className="card overflow-hidden">
                  <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between bg-midnight-50/50">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded", o.tone)}>
                        {o.label}
                      </span>
                      <span className="text-xs text-midnight-500">
                        {byCat.get(o.key)!.length} document{byCat.get(o.key)!.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {o.key !== "__UNCAT__" && (
                      <Link href={`/documents?category=${o.key}`} className="text-xs text-indigoaccent hover:underline">
                        Voir tous →
                      </Link>
                    )}
                  </div>
                  <DocRowsTable rows={byCat.get(o.key)!} />
                </div>
              ));
          })()}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Document</th>
                <th>Catégorie</th>
                <th>Tags</th>
                <th>Lié à</th>
                <th>Expiration</th>
                <th>Taille</th>
                <th>Ajouté</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => {
                const isExpired = d.expiresAt && d.expiresAt < new Date();
                const isExpiringSoon =
                  d.expiresAt &&
                  !isExpired &&
                  d.expiresAt.getTime() - Date.now() < 30 * 86400000;
                return (
                  <tr key={d.id} className={cn(isExpired && "bg-red-50/40")}>
                    <td>
                      <Link
                        href={`/documents/${d.id}`}
                        className="font-medium text-midnight-900 hover:underline flex items-center gap-2"
                      >
                        <FileIcon className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                        <span className="truncate">{d.title}</span>
                      </Link>
                      <div className="text-[10px] text-midnight-400 truncate ml-5">
                        {d.originalName}
                        {d._count.versions > 0 && (
                          <span className="ml-2 text-indigoaccent">
                            · {d._count.versions + 1} versions
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs">
                      {d.category ? (
                        <span className={cn("inline-block text-[10px] px-2 py-0.5 rounded", DOC_CATEGORY_TONES[d.category])}>
                          {DOC_CATEGORY_LABELS[d.category] ?? d.category}
                        </span>
                      ) : (
                        <span className="text-midnight-400">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {d.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-midnight-100 text-midnight-700"
                          >
                            {t}
                          </span>
                        ))}
                        {d.tags.length > 3 && (
                          <span className="text-[10px] text-midnight-400">
                            +{d.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs">
                      <EntityLinks doc={d} />
                    </td>
                    <td className="text-xs">
                      {d.expiresAt ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1",
                            isExpired && "text-red-700 font-medium",
                            isExpiringSoon && "text-amber-700"
                          )}
                        >
                          {(isExpired || isExpiringSoon) && (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {formatDate(d.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-midnight-400">—</span>
                      )}
                    </td>
                    <td className="text-xs tabular-nums">
                      {humanSize(d.size)}
                    </td>
                    <td className="text-xs text-midnight-500">
                      {formatDate(d.createdAt)}
                      {d.uploadedBy && (
                        <div className="text-[10px]">
                          {d.uploadedBy.firstName} {d.uploadedBy.lastName[0]}.
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EntityLinks({
  doc
}: {
  doc: {
    company: { id: string; name: string } | null;
    project: { id: string; name: string; reference: string } | null;
    offer: { id: string; title: string; reference: string } | null;
    consultant: { id: string; firstName: string; lastName: string } | null;
  };
}) {
  const items = [];
  if (doc.company)
    items.push(
      <Link
        key="company"
        href={`/companies/${doc.company.id}`}
        className="hover:underline inline-flex items-center gap-1"
      >
        <Building2 className="w-3 h-3 text-blue-500" />
        {doc.company.name}
      </Link>
    );
  if (doc.project)
    items.push(
      <Link
        key="project"
        href={`/projects/${doc.project.id}`}
        className="hover:underline inline-flex items-center gap-1"
      >
        <FolderKanban className="w-3 h-3 text-amber-500" />
        {doc.project.reference}
      </Link>
    );
  if (doc.offer)
    items.push(
      <Link
        key="offer"
        href={`/offers/${doc.offer.id}`}
        className="hover:underline inline-flex items-center gap-1"
      >
        <FileText className="w-3 h-3 text-violet-500" />
        {doc.offer.reference}
      </Link>
    );
  if (doc.consultant)
    items.push(
      <Link
        key="consultant"
        href={`/consultants/${doc.consultant.id}`}
        className="hover:underline inline-flex items-center gap-1"
      >
        <UserIcon className="w-3 h-3 text-indigoaccent" />
        {doc.consultant.firstName} {doc.consultant.lastName[0]}.
      </Link>
    );
  if (items.length === 0)
    return <span className="text-midnight-400">—</span>;
  return <div className="space-y-0.5">{items}</div>;
}

/** Rend un tableau de lignes de docs (utilisé dans la vue groupée par catégorie) */
function DocRowsTable({ rows }: { rows: any[] }) {
  return (
    <table className="table-base">
      <tbody>
        {rows.map((d) => {
          const isExpired = d.expiresAt && d.expiresAt < new Date();
          const isExpiringSoon = d.expiresAt && !isExpired &&
            d.expiresAt.getTime() - Date.now() < 30 * 86400000;
          return (
            <tr key={d.id} className={cn(isExpired && "bg-red-50/40")}>
              <td>
                <Link href={`/documents/${d.id}`} className="font-medium text-midnight-900 hover:underline flex items-center gap-2">
                  <FileIcon className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                  <span className="truncate">{d.title}</span>
                </Link>
                <div className="text-[10px] text-midnight-400 truncate ml-5">
                  {d.originalName}
                  {d._count?.versions > 0 && (
                    <span className="ml-2 text-indigoaccent">· {d._count.versions + 1} versions</span>
                  )}
                </div>
              </td>
              <td className="text-xs">
                <EntityLinks doc={d} />
              </td>
              <td className="text-xs">
                {d.expiresAt ? (
                  <span className={cn(
                    "inline-flex items-center gap-1",
                    isExpired && "text-red-700 font-medium",
                    isExpiringSoon && "text-amber-700"
                  )}>
                    {(isExpired || isExpiringSoon) && <AlertTriangle className="w-3 h-3" />}
                    {formatDate(d.expiresAt)}
                  </span>
                ) : <span className="text-midnight-400">—</span>}
              </td>
              <td className="text-xs tabular-nums">{humanSize(d.size)}</td>
              <td className="text-xs text-midnight-500">
                {formatDate(d.createdAt)}
                {d.uploadedBy && (
                  <div className="text-[10px]">{d.uploadedBy.firstName} {d.uploadedBy.lastName[0]}.</div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
