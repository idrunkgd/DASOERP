import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChatWidget } from "@/components/layout/chat-widget";
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
      <div className="flex min-h-screen">
        <Sidebar role={session.user.role} permissions={permissions} restricted={isRestricted} />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar accessGroupName={groupName} />
          <main className="flex-1 p-6">{children}</main>
        </div>
        {!isRestricted && <ChatWidget />}
      </div>
    </Providers>
  );
}
