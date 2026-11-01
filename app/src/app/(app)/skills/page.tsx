import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { SkillsManager } from "./manager";
import { listOrphanSkills } from "@/server/actions/skills";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  await requirePermission("settings.manage");
  const [skills, orphans] = await Promise.all([
    prisma.skill.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    listOrphanSkills()
  ]);
  return (
    <div>
      <PageHeader
        title="Catalogue de compétences"
        subtitle={`${skills.length} compétence(s) · ${orphans.length} orpheline(s) détectée(s) dans les CV`}
      />
      <div className="card p-4 mb-5 text-sm border-indigoaccent/30 bg-indigoaccent/5">
        Ce catalogue facilite la saisie via des cases à cocher. Les utilisateurs peuvent <strong>toujours</strong> ajouter une compétence libre hors catalogue — on les retrouve ensuite dans la section <strong>orphelines</strong> ci-dessous pour les fusionner proprement.
      </div>
      <SkillsManager skills={skills} orphans={orphans} />
    </div>
  );
}
