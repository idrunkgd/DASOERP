/**
 * Layout dédié au portail client public.
 *  - AUCUNE navigation Dasolabs (pas de sidebar, pas de topbar).
 *  - Pas de session utilisateur, pas de dépendance à l'auth.
 *  - Favicon et metadata génériques pour ne pas exposer la marque dans l'onglet.
 */
import "../../globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace candidats",
  description: "Consultation des profils proposés",
  robots: { index: false, follow: false }
};

export default function PortalPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {children}
      <footer className="py-8 text-center text-xs text-slate-400">
        Espace privé — merci de ne pas partager ce lien.
      </footer>
    </div>
  );
}
