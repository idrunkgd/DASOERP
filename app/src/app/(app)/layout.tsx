import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LayoutShell } from "@/components/layout/layout-shell";
import { Providers } from "@/components/providers";
import { getUserEffectivePermissions, getUserAccessGroupName, DEFAULT_GROUP_NAME } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const [permissions, groupName, favorites] = await Promise.all([
    getUserEffectivePermissions(session.user.id, session.user.role),
    getUserAccessGroupName(session.user.id),
    prisma.userFavorite.findMany({
      where: { userId: session.user.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, label: true, href: true, icon: true }
    })
  ]);
  const isRestricted = permissions.length === 0;

  // ─── Mode démo ───
  // Bouton visible pour les admin/manager. Cookie posé par enableDemoMode()
  // dans /server/actions/demo-mode.ts. Comparaison case-insensitive au cas
  // où la casse serait différente dans le token.
  const roleUpper = String(session.user.role ?? "").toUpperCase();
  const demoAllowed = roleUpper === "ADMIN" || roleUpper === "MANAGER";
  const demoModeActive = cookies().get("demo-mode")?.value === "1";

  return (
    <Providers>
      <LayoutShell
        role={session.user.role}
        permissions={permissions}
        restricted={isRestricted}
        accessGroupName={groupName}
        favorites={favorites}
        demoAllowed={demoAllowed}
        demoModeActive={demoModeActive}
      >
        {demoModeActive && (
          <div className="bg-amber-500 text-white text-center text-xs py-1.5 px-4 sticky top-0 z-40">
            <strong>Mode démo actif</strong> — vous voyez le HUB comme <strong>Jean Démo</strong>.
            Utilisez le bouton du menu de gauche pour sortir.
          </div>
        )}
        {children}
      </LayoutShell>
    </Providers>
  );
}
