import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

/**
 * Charte graphique Dasolabs — DM Sans (principale) + DM Mono (labels, codes).
 *
 * On charge les polices via <link> Google Fonts au RUNTIME plutôt que via
 * next/font/google (qui downloade au BUILD). Raison : le serveur de build
 * Coolify n'a pas toujours accès sortant vers fonts.gstatic.com — un build
 * qui a besoin d'internet est fragile. La solution runtime est plus robuste,
 * avec un tiny coût réseau initial pour le premier visiteur (mise en cache
 * ensuite côté navigateur).
 */
export const metadata: Metadata = {
  title: "Dasohub",
  description: "Dasohub — pilotage commercial, projets, temps et trésorerie"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* PWA — manifest + theme color + icône iOS */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#202037" />
        <link rel="apple-touch-icon" href="/dasolabs-icon.svg" />
      </head>
      <body className="h-full antialiased font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
