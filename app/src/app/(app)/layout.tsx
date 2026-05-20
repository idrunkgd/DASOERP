import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LayoutShell } from "@/components/layout/layout-shell";
import { Providers } from "@/components/providers";
import { getUserEffectivePermissions, getUserAccessGroupName, DEFAULT_GROUP_NAME } from "@/lib/rbac";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const [permissions, groupName] = await Promise.all([
    getUserEffectivePermissions(session.user.id, session.user.role),
    getUserAccessGroupName(session.user.id)
  ]);
  // Mode restreint = aucune permission effective. Si un user "Visiteur" a reçu
  // des overrides de permission (grants individuels), il sort du mode restreint
  // et accède aux modules correspondants. Avant on excluait aussi sur le nom
  // de groupe, ce qui ignorait les overrides → la sidebar restait vide alors
  // que les droits étaient bien là.
  const isRestricted = permissions.length === 0;

  return (
    <Providers>
      <LayoutShell
        role={session.user.role}
        permissions={permissions}
        restricted={isRestricted}
        accessGroupName={groupName}
      >
        {children}
      </LayoutShell>
    </Providers>
  );
}
