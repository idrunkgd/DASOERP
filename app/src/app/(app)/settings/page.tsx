import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration globale Dasolabs ERP" />
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Entreprise Dasolabs</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-midnight-500">Nom légal</dt><dd>Dasolabs SRL</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Email</dt><dd>contact@dasolabs.com</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Outil de facturation</dt><dd>Peppol (externe)</dd></div>
          </dl>
          <p className="text-xs text-midnight-500 mt-3">Ces valeurs sont configurables via la table <code>Setting</code> (Prisma).</p>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Numérotation</h2>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-midnight-500">Offres</dt><dd className="font-mono">OFF-AAAA-NNNN</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Projets</dt><dd className="font-mono">PRJ-AAAA-NNNN</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Demandes de mission</dt><dd className="font-mono">DEM-AAAA-NNNN</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Missions T&amp;M</dt><dd className="font-mono">MIS-AAAA-NNNN</dd></div>
          </dl>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Catégories d'activité</h2>
          <p className="text-sm text-midnight-500">Analyse, Développement, Gestion projet, Réunion, Support, Formation, Commercial, Administratif, Autre.</p>
          <p className="text-xs text-midnight-500 mt-2">Modifiables via l'enum <code>ActivityType</code> dans le schéma Prisma.</p>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Statuts</h2>
          <p className="text-sm text-midnight-500">Offre, Projet, Mission, Tranche, Achat, Timesheet — tous gérés via enums Prisma. Pour des statuts dynamiques personnalisés, ajouter une table <code>StatusOption</code>.</p>
        </section>
      </div>
    </div>
  );
}
