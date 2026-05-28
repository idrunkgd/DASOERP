// Fiche détail d'un document : métadonnées éditables, liste des versions,
// suppression. La V1 (parent racine) est l'ancre — les versions ultérieures
// y sont liées via parentDocumentId.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import {
  ChevronLeft,
  Download,
  FileIcon,
  Building2,
  FolderKanban,
  FileText,
  User as UserIcon
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DocumentMetaForm } from "./meta-form";
import { VersionsPanel } from "./versions-panel";
import { deleteDocument } from "@/server/actions/documents";

export const dynamic = "force-dynamic";

export default async function DocumentDetail({
  params
}: {
  params: { id: string };
}) {
  await requireSession();

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, reference: true } },
      offer: { select: { id: true, title: true, reference: true } },
      consultant: { select: { id: true, firstName: true, lastName: true } },
      uploadedBy: { select: { firstName: true, lastName: true } },
      versions: {
        orderBy: { version: "desc" },
        include: { uploadedBy: { select: { firstName: true, lastName: true } } }
      },
      parentDocument: { select: { id: true, title: true } }
    }
  });

  if (!doc) notFound();

  // Si on tombe sur une version (parent != null), on redirige vers la racine
  if (doc.parentDocumentId) {
    redirect(`/documents/${doc.parentDocumentId}`);
  }

  const [companies, projects, offers, consultants] = await Promise.all([
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

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Documents", href: "/documents" },
          { label: doc.title }
        ]}
        title={doc.title}
        subtitle={`${doc.originalName} · ${humanSize(doc.size)} · ${doc.mimeType}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/documents" className="btn-secondary text-xs">
              <ChevronLeft className="w-3 h-3" /> Retour
            </Link>
            <a
              href={`/api/documents/${doc.id}/download`}
              className="btn-primary text-xs"
            >
              <Download className="w-3 h-3" />
              Télécharger V{doc.version}
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Métadonnées éditables */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header font-semibold">Informations</div>
            <div className="p-4">
              <DocumentMetaForm
                document={{
                  id: doc.id,
                  title: doc.title,
                  description: doc.description,
                  tags: doc.tags,
                  expiresAt: doc.expiresAt ? doc.expiresAt.toISOString().slice(0, 10) : null,
                  companyId: doc.companyId,
                  projectId: doc.projectId,
                  offerId: doc.offerId,
                  consultantId: doc.consultantId
                }}
                companies={companies}
                projects={projects}
                offers={offers}
                consultants={consultants}
              />
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-header font-semibold">Liens</div>
            <div className="p-4 text-sm space-y-2">
              {doc.company && (
                <Link
                  href={`/companies/${doc.company.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Building2 className="w-4 h-4 text-blue-500" />
                  {doc.company.name}
                </Link>
              )}
              {doc.project && (
                <Link
                  href={`/projects/${doc.project.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <FolderKanban className="w-4 h-4 text-amber-500" />
                  {doc.project.reference} — {doc.project.name}
                </Link>
              )}
              {doc.offer && (
                <Link
                  href={`/offers/${doc.offer.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <FileText className="w-4 h-4 text-violet-500" />
                  {doc.offer.reference} — {doc.offer.title}
                </Link>
              )}
              {doc.consultant && (
                <Link
                  href={`/consultants/${doc.consultant.id}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <UserIcon className="w-4 h-4 text-indigoaccent" />
                  {doc.consultant.firstName} {doc.consultant.lastName}
                </Link>
              )}
              {!doc.company && !doc.project && !doc.offer && !doc.consultant && (
                <p className="text-xs text-midnight-400">
                  Aucun lien — modifie les champs ci-dessus pour en ajouter.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Versions */}
        <div className="lg:col-span-1">
          <VersionsPanel
            documentId={doc.id}
            currentVersion={{
              id: doc.id,
              version: doc.version,
              originalName: doc.originalName,
              size: doc.size,
              createdAt: formatDate(doc.createdAt),
              uploadedBy: doc.uploadedBy
                ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName[0]}.`
                : null
            }}
            versions={doc.versions.map((v) => ({
              id: v.id,
              version: v.version,
              originalName: v.originalName,
              size: v.size,
              createdAt: formatDate(v.createdAt),
              uploadedBy: v.uploadedBy
                ? `${v.uploadedBy.firstName} ${v.uploadedBy.lastName[0]}.`
                : null
            }))}
          />

          <div className="card mt-4 p-4">
            <form
              action={async () => {
                "use server";
                await deleteDocument(doc.id);
                redirect("/documents");
              }}
            >
              <button
                type="submit"
                className="text-xs text-red-700 hover:text-red-900 w-full text-left"
                onClick={(e: any) => {
                  if (!confirm(`Supprimer définitivement « ${doc.title} » et toutes ses versions ?`))
                    e.preventDefault();
                }}
              >
                Supprimer ce document (et ses {doc.versions.length} version(s))
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
