import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Plus, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ContactsPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePermission("contacts.read");
  const where: any = {};
  if (searchParams.q) {
    where.OR = [
      { firstName: { contains: searchParams.q, mode: "insensitive" } },
      { lastName:  { contains: searchParams.q, mode: "insensitive" } },
      { email:     { contains: searchParams.q, mode: "insensitive" } }
    ];
  }
  const contacts = await prisma.contact.findMany({
    where, include: { company: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
  });
  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact(s)`}
        actions={
          <>
            <Link href="/contacts/import" className="btn-secondary"><Upload className="w-4 h-4" /> Import CSV</Link>
            <Link href="/api/exports/contacts" className="btn-secondary">Export CSV</Link>
            <Link href="/contacts/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau contact</Link>
          </>
        }
      />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Nom, email..." className="input max-w-xs" />
        <button className="btn-secondary">Filtrer</button>
      </form>
      <div className="card overflow-hidden">
        {contacts.length === 0 ? (
          <EmptyState icon={Users} title="Aucun contact" action={<Link href="/contacts/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
        ) : (
          <table className="table-base">
            <thead><tr><th>Nom</th><th>Entreprise</th><th>Fonction</th><th>Email</th><th>Tél</th><th>Statut</th></tr></thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id}>
                  <td><Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.firstName} {c.lastName}</Link></td>
                  <td>{c.company ? <Link href={`/companies/${c.company.id}`} className="hover:underline text-midnight-700">{c.company.name}</Link> : "—"}</td>
                  <td className="text-midnight-700">{c.jobTitle ?? "—"}</td>
                  <td className="text-midnight-700">{c.email ?? "—"}</td>
                  <td className="text-midnight-700">{c.phone ?? "—"}</td>
                  <td><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
