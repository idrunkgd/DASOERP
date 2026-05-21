import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CvParserClient } from "./client";

export const dynamic = "force-dynamic";

export default async function CvParserPage() {
  const session = await requireSession();
  if (!["ADMIN", "MANAGER", "COMMERCIAL"].includes(session.user.role)) {
    return <div className="text-sm text-midnight-500">Accès refusé.</div>;
  }
  return (
    <div>
      <PageHeader
        title="Parser CV automatique"
        subtitle="Dépose un CV (PDF ou image) — Claude en extrait les infos structurées et tu peux créer un candidat en un clic"
      />
      <CvParserClient />
    </div>
  );
}
