import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, rolePermissions, PERMISSION_GROUPS, type Permission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { AccessMatrix } from "./matrix";

export const dynamic = "force-dynamic";

export default async function OverridesPage({ searchParams }: { searchParams: { user?: string } }) {
  await requirePermission("users.manage");

  const where: any = { active: true };
  if (searchParams.user) where.id = searchParams.user;

  const [users, overrides] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }],
      include: { accessGroup: true }
    }),
    prisma.userPermissionOverride.findMany()
  ]);

  // Map userId → Map permission → granted (boolean)
  const overridesByUser = new Map<string, Map<string, boolean>>();
  for (const o of overrides) {
    if (!overridesByUser.has(o.userId)) overridesByUser.set(o.userId, new Map());
    overridesByUser.get(o.userId)!.set(o.permission, o.granted);
  }

  // Pour chaque user, calcule la base (groupe ou rôle) puis l'effectif avec override
  const matrix = users.map(u => {
    const baseList = u.accessGroup?.permissions ?? rolePermissions(u.role);
    const baseSet = new Set<string>(baseList);
    const userOverrides = overridesByUser.get(u.id) ?? new Map();
    const cells: Record<string, { effective: boolean; default: boolean; override: "GRANT"|"REVOKE"|null }> = {};
    for (const grp of PERMISSION_GROUPS) {
      for (const p of grp.permissions) {
        const def = baseSet.has(p.value);
        const ov = userOverrides.has(p.value)
          ? (userOverrides.get(p.value) ? "GRANT" : "REVOKE") as ("GRANT"|"REVOKE")
          : null;
        const effective = ov === "GRANT" ? true : ov === "REVOKE" ? false : def;
        cells[p.value] = { effective, default: def, override: ov };
      }
    }
    return {
      id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email,
      role: u.role, photoUrl: u.photoUrl,
      groupName: u.accessGroup?.name ?? null,
      cells, hasOverrides: (overridesByUser.get(u.id)?.size ?? 0) > 0
    };
  });

  return (
    <div>
      <PageHeader
        title="Surcharges fines de permissions"
        breadcrumb={[{ label: "Accès", href: "/access" }, { label: "Surcharges" }]}
        subtitle={`${matrix.length} utilisateur(s) — ajoute ou retire des permissions au-dessus du groupe / rôle`}
      />
      <div className="card p-3 mb-4 text-sm text-midnight-700 border-indigoaccent/30 bg-indigoaccent/5">
        Pour <strong>changer en masse</strong> les droits d'un utilisateur, préférez lui attribuer un <Link href="/access" className="text-indigoaccent hover:underline">groupe d'accès</Link>. Cette page sert aux <em>exceptions</em> : un grant ou revoke ponctuel sur une permission précise, sans toucher au groupe.
      </div>
      <AccessMatrix matrix={matrix as any} groups={PERMISSION_GROUPS as any} />
    </div>
  );
}
