import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ContactForm } from "../contact-form";
import { ContactCompaniesSection } from "./contact-companies-section";
import { addInteraction, deleteContact } from "@/server/actions/contacts";
import { ConfirmButton } from "@/components/ui/confirm";
import { formatDate } from "@/lib/utils";

export default async function ContactDetail({ params }: { params: { id: string } }) {
  await requirePermission("contacts.read");
  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      company: true,
      interactions: { orderBy: { occurredAt: "desc" }, include: { user: true } },
      // Toutes les sociétés rattachées (relation N:N). Le lien isPrimary
      // correspond à contact.companyId (rétro-compat), on trie principale
      // en premier puis par ancienneté.
      companyLinks: {
        include: { company: { select: { id: true, name: true, city: true } } },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }]
      }
    }
  });
  if (!contact) notFound();
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title={`${contact.firstName} ${contact.lastName}`}
        breadcrumb={[{ label: "Contacts", href: "/contacts" }, { label: `${contact.firstName} ${contact.lastName}` }]}
        subtitle={contact.jobTitle ?? undefined}
        actions={
          <>
            <StatusBadge status={contact.status} className="mr-2" />
            <ConfirmButton onConfirm={async () => { "use server"; await deleteContact(contact.id); }} message="Supprimer ce contact ?">
              Supprimer
            </ConfirmButton>
          </>
        }
      />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ContactForm initial={contact as any} companies={companies} />

          <ContactCompaniesSection
            contactId={contact.id}
            links={contact.companyLinks.map((l) => ({
              companyId: l.companyId,
              companyName: l.company.name,
              companyCity: l.company.city,
              jobTitle: l.jobTitle,
              notes: l.notes,
              isPrimary: l.isPrimary
            }))}
            availableCompanies={companies}
          />

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Timeline d'interactions</h2>
            <form action={addInteraction.bind(null, contact.id)} className="grid grid-cols-12 gap-2 mb-4">
              <select name="kind" className="input col-span-2">
                <option value="note">Note</option>
                <option value="call">Appel</option>
                <option value="email">Email</option>
                <option value="meeting">Réunion</option>
              </select>
              <input name="subject" placeholder="Sujet" required className="input col-span-4" />
              <input name="body" placeholder="Détail (optionnel)" className="input col-span-5" />
              <button className="btn-primary col-span-1">+</button>
            </form>
            {contact.interactions.length === 0 ? (
              <p className="text-sm text-midnight-500">Aucune interaction enregistrée.</p>
            ) : (
              <ul className="space-y-3">
                {contact.interactions.map(i => (
                  <li key={i.id} className="flex gap-3 border-l-2 border-indigoaccent/40 pl-3">
                    <div className="flex-1">
                      <div className="text-xs text-midnight-500">{formatDate(i.occurredAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · <span className="badge-info">{i.kind}</span> · {i.user ? `${i.user.firstName} ${i.user.lastName}` : "—"}</div>
                      <div className="font-medium text-midnight-900 text-sm">{i.subject}</div>
                      {i.body && <div className="text-sm text-midnight-700 mt-0.5">{i.body}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Coordonnées</h3>
            <div>
              <span className="text-midnight-500">Société principale : </span>
              {contact.company ? (
                <Link href={`/companies/${contact.company.id}`} className="text-indigoaccent hover:underline">
                  {contact.company.name}
                </Link>
              ) : "—"}
              {contact.companyLinks.length > 1 && (
                <span className="text-midnight-500 text-xs ml-1">
                  (+{contact.companyLinks.length - 1} autre{contact.companyLinks.length > 2 ? "s" : ""})
                </span>
              )}
            </div>
            <div><span className="text-midnight-500">Email : </span>{contact.email ?? "—"}</div>
            <div><span className="text-midnight-500">Téléphone : </span>{contact.phone ?? "—"}</div>
            <div><span className="text-midnight-500">Tags : </span>{contact.tags.length ? contact.tags.map(t => <span key={t} className="badge-neutral mr-1">{t}</span>) : "—"}</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
