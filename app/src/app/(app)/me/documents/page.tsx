import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { FileText, Download, Award } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Mes documents — page self-scopée. N'importe quel user connecté voit ici :
 *   - Ses certificats (générés auto par les cours certifiants)
 *   - Ses contrats signés
 *   - Tout Document dont il est consultantId
 * Aucune permission `documents.read` requise — on ne montre QUE ses propres
 * docs, filtrés par consultantId = session.user.id.
 */
export default async function MyDocumentsPage() {
  const session = await requireSession();
  const docs = await prisma.document.findMany({
    where: { consultantId: session.user.id, parentDocumentId: null },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const certs = docs.filter((d) => d.tags?.includes("certificat"));
  const others = docs.filter((d) => !d.tags?.includes("certificat"));

  return (
    <div>
      <PageHeader
        pill="MON ESPACE · DOCUMENTS"
        title="Mes documents"
        subtitle={`${docs.length} document(s) — certificats, contrats, RH`}
      />

      {certs.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-400 mb-3">🎓 Certificats</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {certs.map((d) => (
              <DocCard key={d.id} doc={d} accent="mint" />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-400 mb-3">
          {certs.length > 0 ? "Autres documents" : "Documents"}
        </h2>
        {others.length === 0 ? (
          <div className="card p-10 text-center text-sm text-midnight-500 italic">
            Aucun autre document. Tes contrats et attestations apparaîtront ici quand ils seront émis.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {others.map((d) => (
              <DocCard key={d.id} doc={d} accent="blue" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocCard({ doc, accent }: { doc: any; accent: "mint" | "blue" }) {
  const Icon = doc.tags?.includes("certificat") ? Award : FileText;
  const iconBg = accent === "mint" ? "bg-emerald-500/10 text-emerald-600" : "bg-indigoaccent/10 text-indigoaccent";
  return (
    <a
      href={`/api/documents/${doc.id}/download`}
      target="_blank"
      rel="noreferrer"
      className="card p-5 group cursor-pointer flex items-start gap-4"
    >
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-midnight-900 truncate group-hover:text-indigoaccent transition-colors">
          {doc.title}
        </div>
        {doc.description && (
          <div className="text-xs text-midnight-500 mt-1 line-clamp-2">{doc.description}</div>
        )}
        <div className="text-[11px] font-mono text-midnight-400 mt-2 tabular-nums">
          {formatDate(doc.createdAt)} · {(doc.size / 1024).toFixed(0)} Ko
        </div>
      </div>
      <Download className="w-4 h-4 text-midnight-400 group-hover:text-indigoaccent transition-colors" />
    </a>
  );
}
