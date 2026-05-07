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
  // Visiteur ou compte portail = aucune permission OU groupe Visiteur
  // Le middleware redirige déjà vers /me, ici on adapte juste la sidebar
  const isRestricted = permissions.length === 0 || groupName === DEFAULT_GROUP_NAME;

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
