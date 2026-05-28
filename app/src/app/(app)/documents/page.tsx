// Liste des documents avec filtres : recherche texte, tag, entité liée,
// expiration. Affiche uniquement les "docs racine" (V1) — les versions sont
// regroupées sous la fiche détail.
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
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

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: { q?: string; tag?: string; expiring?: string };
}) {
  await requireSession();

  const q = (searchParams.q || "").trim();
  const tag = (searchParams.tag || "").trim();
  const expiring = searchParams.expiring === "1";

  const where: any = { parentDocumentId: null };
  if (q.length >= 2) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { originalName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } }
    ];
  }
  if (tag) where.tags = { has: tag };
  if (expiring) {
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    where.expiresAt = { lte: in30, gte: new Date() };
  }

  const [documents, allTags, companies, projects, offers, consultants] =
    await Promise.all([
      prisma.document.findMany({
        where,
        take: PAGE_SIZE,
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

      <div className="card p-3 mb-4">
        <form className="flex flex-wrap gap-2 items-center">
          <input
            name="q"
            defaultValue={q}
            placeholder="Rechercher..."
            className="input max-w-xs"
          />
          <select name="tag" defaultValue={tag} className="input max-w-[200px]">
            <option value="">— Tous les tags —</option>
            {distinctTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-midnight-700">
            <input
              type="checkbox"
              name="expiring"
              value="1"
              defaultChecked={expiring}
            />
            Expire dans 30j {expiringCount > 0 && `(${expiringCount})`}
          </label>
          <button className="btn-secondary text-xs">Filtrer</button>
          {(q || tag || expiring) && (
            <Link href="/documents" className="text-xs text-midnight-500 hover:underline">
              Réinitialiser
            </Link>
          )}
        </form>
      </div>

      {documents.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileIcon}
            title={q || tag || expiring ? "Aucun résultat" : "Aucun document"}
            description={
              q || tag || expiring
                ? "Aucun document ne correspond à ces filtres."
                : "Uploade ton premier document ci-dessus."
            }
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Document</th>
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

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
