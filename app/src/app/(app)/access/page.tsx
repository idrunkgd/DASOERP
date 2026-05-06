import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, ROLE_LABELS, PERMISSION_GROUPS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { GroupsBlock } from "./groups-block";
import { UserAssignmentTable } from "./user-assignment";
import { Plus, ShieldCheck, SlidersHorizontal } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  await requirePermission("users.manage");

  const [groups, users] = await Promise.all([
    prisma.accessGroup.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } }
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      include: { accessGroup: true, _count: { select: { permissionOverrides: true } } }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Gestion des accès"
        subtitle="Rôle = fonction · Groupe = droits dans l'application · Surcharges = ajustements fins"
        actions={
          <>
            <Link href="/access/overrides" className="btn-secondary"><SlidersHorizontal className="w-4 h-4" /> Surcharges fines</Link>
            <Link href="/access/groups/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau groupe</Link>
          </>
        }
      />

      <div className="card p-4 mb-5 text-sm border-indigoaccent/30 bg-indigoaccent/5">
        <p className="text-midnight-900 font-medium mb-1 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Comment ça marche</p>
        <ul className="text-midnight-700 list-disc pl-5 space-y-0.5">
          <li>Le <strong>rôle</strong> (Consultant, Manager…) décrit la <em>fonction</em> de la personne ; il ne donne plus aucun droit en lui-même quand un groupe est attribué.</li>
          <li>Un <strong>groupe d'accès</strong> définit l'ensemble des permissions disponibles. Un Consultant peut très bien être Administrateur via le groupe « Administrateur ».</li>
          <li>Sans groupe assigné, l'utilisateur retombe sur les permissions par défaut de son rôle.</li>
          <li>Pour des cas particuliers, la page <Link href="/access/overrides" className="text-indigoaccent hover:underline">Surcharges fines</Link> permet d'ajouter ou de retirer une permission précise.</li>
        </ul>
      </div>

      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3">Groupes d'accès ({groups.length})</h2>
        <GroupsBlock groups={groups.map(g => ({
          id: g.id, name: g.name, description: g.description, permissionsCount: g.permissions.length,
          isSystem: g.isSystem, usersCount: g._count.users
        }))} permissionsByGroupId={Object.fromEntries(groups.map(g => [g.id, g.permissions]))} />
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-3">Affectation des utilisateurs ({users.length})</h2>
        <UserAssignmentTable
          users={users.map(u => ({
            id: u.id, firstName: u.firstName, lastName: u.lastName,
            email: u.email, role: u.role, photoUrl: u.photoUrl,
            accessGroupId: u.accessGroupId,
            accessGroupName: u.accessGroup?.name ?? null,
            overridesCount: u._count.permissionOverrides
          }))}
          groups={groups.map(g => ({ id: g.id, name: g.name, isSystem: g.isSystem }))}
        />
      </section>
    </div>
  );
}
