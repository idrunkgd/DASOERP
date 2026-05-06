import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function CommercialTimeline({ searchParams }: { searchParams: { user?: string; kind?: string; q?: string; from?: string; to?: string; page?: string } }) {
  await requirePermission("contacts.read");
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const where: any = {};
  if (searchParams.user) where.userId = searchParams.user;
  if (searchParams.kind) where.kind = searchParams.kind;
  if (searchParams.from) where.occurredAt = { ...(where.occurredAt ?? {}), gte: new Date(searchParams.from) };
  if (searchParams.to)   where.occurredAt = { ...(where.occurredAt ?? {}), lte: new Date(searchParams.to) };
  if (searchParams.q) where.OR = [
    { subject: { contains: searchParams.q, mode: "insensitive" } },
    { body: { contains: searchParams.q, mode: "insensitive" } }
  ];

  const [items, total, users] = await Promise.all([
    prisma.contactInteraction.findMany({
      where,
      include: { user: true, contact: { include: { company: true } } },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE
    }),
    prisma.contactInteraction.count({ where }),
    prisma.user.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Activité commerciale" subtitle={`${total} interaction(s) — toutes équipes confondues`} />
      <form className="mb-4 flex gap-2 flex-wrap">
        <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Sujet, contenu..." className="input max-w-xs" />
        <select name="kind" defaultValue={searchParams.kind ?? ""} className="input max-w-[180px]">
          <option value="">Tous types</option>
          <option value="note">Note</option>
          <option value="call">Appel</option>
          <option value="email">Email</option>
          <option value="meeting">Réunion</option>
        </select>
        <select name="user" defaultValue={searchParams.user ?? ""} className="input max-w-[200px]">
          <option value="">Tous les utilisateurs</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <input name="from" type="date" defaultValue={searchParams.from ?? ""} className="input max-w-[160px]" />
        <input name="to" type="date" defaultValue={searchParams.to ?? ""} className="input max-w-[160px]" />
        <button className="btn-secondary">Filtrer</button>
      </form>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500">Aucune interaction.</div>
      ) : (
        <div className="card divide-y divide-border">
          {items.map(it => (
            <div key={it.id} className="p-4 flex gap-4">
              <div className="w-32 shrink-0 text-xs text-midnight-500">{formatDate(it.occurredAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="badge-info uppercase">{it.kind}</span>
                  <span className="text-midnight-500">par</span>
                  <span className="font-medium">{it.user ? `${it.user.firstName} ${it.user.lastName}` : "—"}</span>
                  <span className="text-midnight-500">·</span>
                  <Link href={`/contacts/${it.contact.id}`} className="hover:underline">{it.contact.firstName} {it.contact.lastName}</Link>
                  {it.contact.company && (<><span className="text-midnight-500">·</span><Link href={`/companies/${it.contact.company.id}`} className="text-midnight-700 hover:underline">{it.contact.company.name}</Link></>)}
                </div>
                <div className="font-medium text-midnight-900 mt-1">{it.subject}</div>
                {it.body && <div className="text-sm text-midnight-700 mt-1 whitespace-pre-wrap">{it.body}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 10).map(p => (
            <a key={p} href={`?${new URLSearchParams({ ...searchParams, page: String(p) }).toString()}`} className={p === page ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{p}</a>
          ))}
        </div>
      )}
    </div>
  );
}
