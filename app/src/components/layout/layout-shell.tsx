"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import type { Permission } from "@/lib/rbac";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ChatWidget } from "./chat-widget";

/**
 * Shell client qui gère l'état d'ouverture de la sidebar sur mobile.
 * Sur desktop (md+), la sidebar est toujours visible.
 * Sur mobile (< md), elle se cache derrière un drawer ouvrable depuis
 * le hamburger de la topbar.
 */
export function LayoutShell({
  role,
  permissions,
  restricted,
  accessGroupName,
  children
}: {
  role: Role;
  permissions: Permission[];
  restricted: boolean;
  accessGroupName: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Ferme automatiquement la sidebar mobile quand on navigue
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Empêche le scroll body quand le drawer est ouvert sur mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen relative">
      {/* Backdrop mobile */}
      {sidebarOpen && (
        <div
          aria-hidden
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        role={role}
        permissions={permissions}
        restricted={restricted}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          accessGroupName={accessGroupName}
          onToggleMenu={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      {!restricted && <ChatWidget />}
    </div>
  );
}
