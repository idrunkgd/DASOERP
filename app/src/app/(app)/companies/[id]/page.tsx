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
      // On lit les contacts via la relation N:N ContactCompany : ça inclut
      // à la fois les contacts dont c'est la société principale ET ceux
      // qui y sont rattachés à titre secondaire (ex. Jean travaille chez
      // deux boîtes). Chaque lien porte son propre rôle (jobTitle).
      contactLinks: {
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true, jobTitle: true }
          }
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      },
      offers: { orderBy: { createdAt: "desc" } },
      projects: { orderBy: { createdAt: "desc" } },
      owner: true,
      sites: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] }
    } as any
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

          {/* Sites de production / implantations */}
          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">
                Sites ({(company as any).sites?.length ?? 0})
              </h2>
              <Link href={`/companies/${company.id}/sites/new`} className="btn-secondary btn-sm">
                + Site
              </Link>
            </div>
            {!((company as any).sites?.length) ? (
              <p className="text-sm text-midnight-500">
                Aucun site enregistré. Un site = une usine, un dépôt, un siège, un bureau.
              </p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Type</th>
                    <th>Adresse</th>
                    <th>Téléphone</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(company as any).sites.map((s: any) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/companies/${company.id}/sites/${s.id}`}
                              className="hover:underline font-medium">
                          {s.name}
                        </Link>
                        {s.isPrimary && (
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider
                                           bg-indigoaccent/10 text-indigoaccent px-1.5 py-0.5 rounded">
                            Principal
                          </span>
                        )}
                      </td>
                      <td className="text-midnight-600 text-sm">{s.siteType ?? "—"}</td>
                      <td className="text-midnight-700 text-sm">
                        {[s.street, s.postalCode, s.city].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="text-midnight-700 text-sm">{s.phone ?? "—"}</td>
                      <td>
                        {s.verificationStatus ? (
                          <span className={
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded " +
                            (s.verificationStatus === "Documenté"
                              ? "bg-emerald-100 text-emerald-700"
                              : s.verificationStatus === "Partiel"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-midnight-100 text-midnight-500")
                          }>
                            {s.verificationStatus}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Contacts ({company.contactLinks.length})</h2>
              <Link href={`/contacts/new?companyId=${company.id}`} className="btn-secondary btn-sm">+ Contact</Link>
            </div>
            {company.contactLinks.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucun contact lié.</p>
            ) : (
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Rôle chez {company.name}</th>
                    <th>Email</th>
                    <th>Tél</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {company.contactLinks.map((l) => {
                    // Priorité au jobTitle spécifique au lien (rôle chez CETTE
                    // société) ; à défaut on retombe sur Contact.jobTitle
                    // (rôle « principal » du contact).
                    const role = l.jobTitle ?? l.contact.jobTitle;
                    return (
                      <tr key={l.contact.id}>
                        <td>
                          <Link href={`/contacts/${l.contact.id}`} className="hover:underline font-medium">
                            {l.contact.firstName} {l.contact.lastName}
                          </Link>
                        </td>
                        <td className="text-midnight-700">{role ?? "—"}</td>
                        <td className="text-midnight-700">{l.contact.email ?? "—"}</td>
                        <td className="text-midnight-700">{l.contact.phone ?? "—"}</td>
                        <td>
                          {l.isPrimary ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigoaccent text-white rounded">
                              Principal
                            </span>
                          ) : (
                            <span className="text-[10px] text-midnight-500">Secondaire</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
