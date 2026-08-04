import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, requireSession, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { TodoToggle } from "./todo-toggle";
import { NewTaskButton } from "./new-task-button";
import { Phone, ClipboardList } from "lucide-react";
import { FilterChips } from "@/components/ui/filter-chips";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { parseMulti, inFilter } from "@/lib/filters";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function CommercialTimeline({ searchParams }: { searchParams: { user?: string; assignee?: string; kind?: string; q?: string; from?: string; to?: string; done?: string; page?: string } }) {
  await requirePermission("contacts.read");
  const session = await requireSession();
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canWrite = perms.includes("contacts.write");
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const kinds = parseMulti(searchParams.kind);
  const creatorIds = parseMulti(searchParams.user);
  const assigneeIds = parseMulti(searchParams.assignee);
  // done : "1" = inclure les tâches terminées, sinon on les masque par défaut.
  // "only" = ne voir QUE les tâches terminées.
  const doneFilter = searchParams.done ?? "";
  const where: any = {};
  const creatorFilter = inFilter(creatorIds);
  if (creatorFilter) where.userId = creatorFilter;
  const assigneeFilter = inFilter(assigneeIds);
  if (assigneeFilter) where.assigneeId = assigneeFilter;
  const kindFilter = inFilter(kinds);
  if (kindFilter) where.kind = kindFilter;
  if (searchParams.from) where.occurredAt = { ...(where.occurredAt ?? {}), gte: new Date(searchParams.from) };
  if (searchParams.to)   where.occurredAt = { ...(where.occurredAt ?? {}), lte: new Date(searchParams.to) };
  if (searchParams.q) where.OR = [
    { subject: { contains: searchParams.q, mode: "insensitive" } },
    { body: { contains: searchParams.q, mode: "insensitive" } }
  ];
  // Filtre de complétion :
  //   - "" (défaut)  → masque les tâches terminées (garde les autres kinds)
  //   - "1"          → tout afficher (inclure les tâches faites)
  //   - "only"       → uniquement les tâches faites
  if (doneFilter === "only") {
    where.kind = "todo";
    where.completedAt = { not: null };
  } else if (doneFilter !== "1") {
    // Défaut : masque les tâches terminées.
    // (kind != "todo") OR (kind = "todo" AND completedAt = null)
    const openTodoOrNotTodo = {
      OR: [
        { kind: { not: "todo" } },
        { AND: [{ kind: "todo" }, { completedAt: null }] }
      ]
    };
    if (where.OR) {
      where.AND = [{ OR: where.OR }, openTodoOrNotTodo];
      delete where.OR;
    } else {
      Object.assign(where, openTodoOrNotTodo);
    }
  }

  const [items, total, users] = await Promise.all([
    prisma.contactInteraction.findMany({
      where,
      include: {
        user: true,
        assignee: { select: { id: true, firstName: true, lastName: true } },
        contact: { include: { company: true } }
      },
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE
    }),
    prisma.contactInteraction.count({ where }),
    prisma.user.findMany({ where: { active: true }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Activité"
        subtitle={`${total} entrée(s) — tâches, appels, emails, notes`}
      />
      {canWrite && (
        <NewTaskButton users={users} defaultAssigneeId={session.user.id} />
      )}
      <div className="space-y-3 mb-4">
        <FilterChips
          paramName="kind"
          label="Type"
          options={[
            { value: "todo",    label: "À faire",  tone: "warning" },
            { value: "call",    label: "Appel",    tone: "info" },
            { value: "email",   label: "Email",    tone: "info" },
            { value: "meeting", label: "Réunion",  tone: "info" },
            { value: "note",    label: "Note",     tone: "neutral" }
          ]}
        />
        <FilterChips
          paramName="done"
          label="Tâches"
          multi={false}
          options={[
            { value: "1",    label: "Inclure les faites",       tone: "info" },
            { value: "only", label: "Uniquement les faites",    tone: "success" }
          ]}
        />
        <FilterChips
          paramName="user"
          label="Créateur"
          options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
        />
        <FilterChips
          paramName="assignee"
          label="Assigné à"
          options={users.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))}
        />
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["q", "from", "to", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input name="q" defaultValue={searchParams.q ?? ""} placeholder="Sujet, contenu..." className="input max-w-xs text-sm" />
          <input name="from" type="date" defaultValue={searchParams.from ?? ""} className="input max-w-[160px] text-sm" />
          <input name="to" type="date" defaultValue={searchParams.to ?? ""} className="input max-w-[160px] text-sm" />
          <button className="btn-secondary btn-sm">Rechercher</button>
        </PreservedSearchForm>
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500">Aucune interaction.</div>
      ) : (
        <div className="card divide-y divide-border">
          {items.map(it => {
            const isTodo = it.kind === "todo";
            const done = isTodo && it.completedAt != null;
            const overdue = isTodo && !done && it.dueAt && new Date(it.dueAt) < new Date();
            return (
              <div key={it.id} className={
                "p-4 flex gap-4 " +
                (isTodo && !done ? (overdue ? "bg-red-50/40" : "bg-amber-50/40") : "")
              }>
                <div className="w-32 shrink-0 text-xs text-midnight-500">
                  {formatDate(it.occurredAt, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {isTodo && it.dueAt && (
                    <div className={"text-[10px] mt-1 " + (overdue ? "text-red-600 font-medium" : "text-amber-700")}>
                      Échéance : {formatDate(it.dueAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {overdue && " (en retard)"}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    {isTodo ? (
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold">
                        <Phone className="w-3 h-3" /> Todo
                      </span>
                    ) : (
                      <span className="badge-info uppercase">{it.kind}</span>
                    )}
                    <span className="text-midnight-500">par</span>
                    <span className="font-medium">{it.user ? `${it.user.firstName} ${it.user.lastName}` : "—"}</span>
                    {isTodo && it.assignee && (
                      <>
                        <span className="text-midnight-500">→</span>
                        <span className="font-medium text-indigoaccent">{it.assignee.firstName} {it.assignee.lastName}</span>
                      </>
                    )}
                    {it.contact ? (
                      <>
                        <span className="text-midnight-500">·</span>
                        <Link href={`/contacts/${it.contact.id}`} className="hover:underline">{it.contact.firstName} {it.contact.lastName}</Link>
                        {it.contact.company && (<><span className="text-midnight-500">·</span><Link href={`/companies/${it.contact.company.id}`} className="text-midnight-700 hover:underline">{it.contact.company.name}</Link></>)}
                      </>
                    ) : (
                      <>
                        <span className="text-midnight-500">·</span>
                        <span className="inline-flex items-center gap-1 text-xs text-midnight-500">
                          <ClipboardList className="w-3 h-3" /> Tâche interne
                        </span>
                      </>
                    )}
                    {isTodo && (
                      <span className="ml-auto"><TodoToggle id={it.id} done={done} /></span>
                    )}
                  </div>
                  <div className={"font-medium text-midnight-900 mt-1 " + (done ? "line-through opacity-60" : "")}>
                    {it.subject}
                  </div>
                  {it.body && <div className="text-sm text-midnight-700 mt-1 whitespace-pre-wrap">{it.body}</div>}
                </div>
              </div>
            );
          })}
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
