import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getCompanyInfo } from "@/lib/company-info";
import { ChevronRight, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const company = await getCompanyInfo();
  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration globale Dasohub" />
      <div className="grid lg:grid-cols-2 gap-6">
        <Link href="/settings/company" className="card p-5 hover:border-indigoaccent transition-colors group">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigoaccent" />
              <h2 className="font-semibold">Informations légales</h2>
            </div>
            <ChevronRight className="w-4 h-4 text-midnight-400 group-hover:text-indigoaccent" />
          </div>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-midnight-500">Raison sociale</dt><dd>{company.legalName}</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">TVA</dt><dd className="font-mono">{company.vatNumber}</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Adresse</dt><dd>{company.postalCode} {company.city}</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">Email</dt><dd>{company.email}</dd></div>
            <div className="flex justify-between"><dt className="text-midnight-500">IBAN</dt><dd className="font-mono text-xs">{company.iban}</dd></div>
          </dl>
          <p className="text-xs text-indigoaccent mt-3 group-hover:underline">Modifier →</p>
        </Link>
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
