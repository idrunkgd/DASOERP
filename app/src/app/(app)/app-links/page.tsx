// Page "Outils & apps" : grille de dalles cliquables vers les applications
// externes utilisées par Dasolabs. Les admins peuvent ajouter/modifier/supprimer
// les entrées via un modal. Les autres users consultent uniquement.
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ExternalLink, AppWindow } from "lucide-react";
import { AppLinksManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AppLinksPage() {
  const session = await requireSession();

  // On relit le rôle depuis la DB plutôt que de faire confiance au JWT
  // (qui peut être en cache si l'utilisateur n'a pas reconnecté). En plus
  // on autorise MANAGER en plus d'ADMIN pour pouvoir éditer la liste.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  });
  const isAdmin = !!dbUser && ["ADMIN", "MANAGER"].includes(dbUser.role);

  const links = await prisma.appLink.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }]
  });

  return (
    <div>
      <PageHeader
        title="Outils & apps"
        subtitle="Raccourcis vers les applications externes utilisées pour Dasolabs."
        actions={
          isAdmin ? (
            <AppLinksManager mode="create" />
          ) : null
        }
      />

      {links.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={AppWindow}
            title="Aucun lien pour l'instant"
            description={
              isAdmin
                ? "Cliquez sur « Ajouter une app » pour créer la première dalle."
                : "Aucune app n'a encore été référencée. Demandez à un admin d'en ajouter."
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {links.map((link) => (
            <Tile
              key={link.id}
              link={link}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  link,
  isAdmin
}: {
  link: { id: string; name: string; url: string; description: string | null };
  isAdmin: boolean;
}) {
  // Domaine extrait de l'URL pour afficher proprement sous le titre.
  let host = "";
  try {
    host = new URL(link.url).host.replace(/^www\./, "");
  } catch {
    host = link.url;
  }

  return (
    <div className="card p-0 group relative overflow-hidden hover:shadow-md transition-shadow">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 h-full"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="w-9 h-9 rounded-lg bg-indigoaccent/10 grid place-items-center text-indigoaccent shrink-0">
            <AppWindow className="w-4 h-4" />
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-midnight-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="text-sm font-semibold text-midnight-900 group-hover:text-indigoaccent transition-colors">
          {link.name}
        </div>
        <div className="text-[11px] text-midnight-400 truncate mt-0.5">{host}</div>
        {link.description && (
          <p className="text-xs text-midnight-600 mt-2 line-clamp-3">
            {link.description}
          </p>
        )}
      </a>
      {isAdmin && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <AppLinksManager mode="edit" link={link} />
        </div>
      )}
    </div>
  );
}
