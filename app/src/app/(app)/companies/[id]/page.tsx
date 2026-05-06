import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { CompanyForm } from "../company-form";
import { deleteCompany } from "@/server/actions/companies";
import { ConfirmButton } from "@/components/ui/confirm";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function CompanyDetail({ params }: { params: { id: string } }) {
  await requirePermission("companies.read");
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      contacts: true,
      offers: { orderBy: { createdAt: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      owner: true
    }
  });
  if (!company) notFound();

  return (
    <div>
      <PageHeader
        title={company.name}
        breadcrumb={[{ label: "Entreprises", href: "/companies" }, { label: company.name }]}
        subtitle={company.vatNumber ?? undefined}
        actions={
          <>
            <StatusBadge status={company.status} className="mr-2" />
            <ConfirmButton
              onConfirm={async () => { "use server"; await deleteCompany(company.id); }}
              message="Supprimer cette entreprise ? Les contacts seront détachés."
            >
              Supprimer
            </ConfirmButton>
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CompanyForm initial={company as any} />

          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Contacts ({company.contacts.length})</h2>
              <Link href={`/contacts/new?companyId=${company.id}`} className="btn-secondary btn-sm">+ Contact</Link>
            </div>
            {company.contacts.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucun contact lié.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Nom</th><th>Fonction</th><th>Email</th><th>Tél</th></tr></thead>
                <tbody>
                  {company.contacts.map(c => (
                    <tr key={c.id}>
                      <td><Link href={`/contacts/${c.id}`} className="hover:underline font-medium">{c.firstName} {c.lastName}</Link></td>
                      <td className="text-midnight-700">{c.jobTitle ?? "—"}</td>
                      <td className="text-midnight-700">{c.email ?? "—"}</td>
                      <td className="text-midnight-700">{c.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Offres ({company.offers.length})</h2>
            {company.offers.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucune offre.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Réf</th><th>Titre</th><th>Statut</th><th className="text-right">Montant</th><th>Créée</th></tr></thead>
                <tbody>
                  {company.offers.map(o => (
                    <tr key={o.id}>
                      <td className="font-mono text-xs">{o.reference}</td>
                      <td><Link href={`/offers/${o.id}`} className="hover:underline">{o.title}</Link></td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-right tabular-nums">{formatCurrency(o.totalSell)}</td>
                      <td className="text-midnight-500 text-xs">{formatDate(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Projets ({company.projects.length})</h2>
            {company.projects.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucun projet.</p>
            ) : (
              <table className="table-base">
                <thead><tr><th>Réf</th><th>Nom</th><th>Statut</th><th className="text-right">Marge réelle</th></tr></thead>
                <tbody>
                  {company.projects.map(p => (
                    <tr key={p.id}>
                      <td className="font-mono text-xs">{p.reference}</td>
                      <td><Link href={`/projects/${p.id}`} className="hover:underline">{p.name}</Link></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="text-right tabular-nums">{formatCurrency(p.marginActual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Informations</h3>
            <Row k="Site web" v={company.website ? <a href={company.website} target="_blank" className="text-indigoaccent hover:underline">{company.website}</a> : "—"} />
            <Row k="Adresse" v={[company.street, company.postalCode, company.city, company.country].filter(Boolean).join(", ") || "—"} />
            <Row k="Source" v={company.source ?? "—"} />
            <Row k="Responsable" v={company.owner ? `${company.owner.firstName} ${company.owner.lastName}` : "—"} />
            <Row k="Créée le" v={formatDate(company.createdAt)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-midnight-500">{k}</span>
      <span className="text-midnight-900 text-right">{v}</span>
    </div>
  );
}
