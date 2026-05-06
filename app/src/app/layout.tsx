import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Dasolabs ERP",
  description: "Outil interne Dasolabs - gestion commerciale, projets, temps et charge"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full antialiased font-sans">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
