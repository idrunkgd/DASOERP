import Link from "next/link";
import { BookOpen, ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/rbac";

/**
 * Layout du wiki formation — délibérément différent de l'ERP :
 * pas de sidebar, header épuré centré sur la lecture.
 *
 * Accessible sur wiki.hub.dasolabs.be (via middleware) et
 * hub.dasolabs.be/formation (direct).
 */
export default async function FormationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen bg-midnight-50/30">
      <header className="border-b border-border bg-white sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/formation" className="flex items-center gap-2 font-semibold text-midnight-900">
            <BookOpen className="w-5 h-5 text-indigoaccent" />
            <span>Dasolabs Formation</span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/dashboard" className="text-midnight-500 hover:text-midnight-800 flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Retour à l'ERP
            </Link>
            <span className="text-midnight-400">•</span>
            <span className="text-midnight-600">{session.user.name ?? session.user.email}</span>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
      <footer className="border-t border-border mt-16 py-6">
        <div className="max-w-5xl mx-auto px-6 text-xs text-midnight-400 flex items-center justify-between">
          <span>Wiki formation — accessible aux modules autorisés par tes permissions ERP.</span>
          <span>© Dasolabs</span>
        </div>
      </footer>
    </div>
  );
}
