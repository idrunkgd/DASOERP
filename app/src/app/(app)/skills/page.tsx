import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { SkillsManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  await requirePermission("settings.manage");
  const skills = await prisma.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader
        title="Catalogue de compétences"
        subtitle={`${skills.length} compétence(s) — utilisées dans les formulaires Utilisateur, Candidat et Profil de service`}
      />
      <div className="card p-4 mb-5 text-sm border-indigoaccent/30 bg-indigoaccent/5">
        Ce catalogue facilite la saisie via des cases à cocher. Les utilisateurs peuvent <strong>toujours</strong> ajouter une compétence libre hors catalogue (champ texte additionnel).
      </div>
      <SkillsManager skills={skills} />
    </div>
  );
}
