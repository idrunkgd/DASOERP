import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { NewExpenseForm } from "./new-expense-form";
import { ExpenseActions } from "./actions-buttons";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, string> = {
  TRANSPORT: "Transport",
  MEAL: "Repas",
  ACCOMMODATION: "Hébergement",
  SUPPLIES: "Fournitures",
  SOFTWARE: "Logiciel",
  TRAINING: "Formation",
  OTHER: "Autre"
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Brouillon", cls: "bg-midnight-100 text-midnight-700" },
  SUBMITTED: { label: "Soumise", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Approuvée", cls: "bg-emerald-100 text-emerald-700" },
  REJECTED: { label: "Refusée", cls: "bg-red-100 text-red-700" },
  PAID: { label: "Remboursée", cls: "bg-indigoaccent/20 text-indigoaccent" }
};

export default async function ExpensesPage({
  searchParams
}: {
  searchParams: { mine?: string; status?: string; edit?: string };
}) {
  const session = await requirePermissionOrRedirect("expenses.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const isApprover = perms.includes("expenses.approve");
  const canMarkPaid = isApprover && perms.includes("finance.write");
  const mineOnly = searchParams.mine === "1" || !isApprover;

  const where: any = {};
  if (mineOnly) where.userId = session.user.id;
  if (searchParams.status) where.status = searchParams.status;

  const reports = await prisma.expenseReport.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true } },
      mission: { select: { reference: true, title: true } },
      project: { select: { reference: true, name: true } },
      approvedBy: { select: { firstName: true, lastName: true } }
    },
    orderBy: { date: "desc" },
    take: 200
  });

  const missions = await prisma.mission.findMany({
    where: { status: { in: ["PLANNED", "ACTIVE", "EXTENDED"] } },
    select: { id: true, reference: true, title: true, company: { select: { name: true } } },
    orderBy: { startDate: "desc" }
  });

  // Mode édition : ?edit=<id>. On charge la note à éditer et on la passe
  // au form pour pré-remplir. Sécurité : on n'expose que si l'auteur est
  // bien le user courant ET que le statut est DRAFT (règle serveur).
  let editingReport: null | {
    id: string; date: string; category: string; description: string;
    amountHt: number; vatRate: number; missionId: string | null;
    receiptUrl: string | null;
  } = null;
  if (searchParams.edit) {
    const r = await prisma.expenseReport.findUnique({
      where: { id: searchParams.edit }
    });
    if (r && r.userId === session.user.id && r.status === "DRAFT") {
      editingReport = {
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        category: r.category,
        description: r.description,
        amountHt: Number(r.amountHt),
        vatRate: Number(r.vatRate),
        missionId: r.missionId,
        receiptUrl: r.receiptUrl
      };
    }
  }

  // KPI rapides
  const totalToReimburse = reports
    .filter((r) => ["SUBMITTED", "APPROVED"].includes(r.status))
    .reduce((s, r) => s + Number(r.amountTtc), 0);
  const totalPaid = reports
    .filter((r) => r.status === "PAID")
    .reduce((s, r) => s + Number(r.amountTtc), 0);
  const countToApprove = reports.filter((r) => r.status === "SUBMITTED").length;

  return (
    <div>
      <PageHeader
        title="Notes de frais"
        subtitle="Saisie + workflow d'approbation. Photo de ticket → OCR auto via Claude (si clé API configurée)."
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Kpi label="À rembourser" value={formatCurrency(totalToReimburse)} sub="Soumises + approuvées" />
        <Kpi label="Remboursées" value={formatCurrency(totalPaid)} sub="Statut PAID" />
        <Kpi
          label="À approuver"
          value={String(countToApprove)}
          sub={isApprover ? "Tu es approbateur" : "Soumises par toi"}
          tone={countToApprove > 0 ? "warn" : undefined}
        />
      </div>

      {/* Form de saisie / édition */}
      <div className="card mb-6" id="expense-form">
        <div className="card-header font-semibold">
          {editingReport ? "Modifier la note de frais" : "Nouvelle note de frais"}
        </div>
        <div className="p-4">
          <NewExpenseForm
            missions={missions.map((m) => ({
              id: m.id,
              label: `${m.reference} — ${m.title} (${m.company.name})`
            }))}
            editing={editingReport}
          />
        </div>
      </div>

      {/* Filtres + liste */}
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold">Notes ({reports.length})</div>
          <form className="flex gap-2 text-sm">
            {isApprover && (
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  name="mine"
                  value="1"
                  defaultChecked={mineOnly}
                />{" "}
                Mes notes uniquement
              </label>
            )}
            <select name="status" defaultValue={searchParams.status ?? ""} className="input text-sm">
              <option value="">Tous les statuts</option>
              {Object.keys(STATUS_LABELS).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s].label}
                </option>
              ))}
            </select>
            <button className="btn-secondary text-sm">Filtrer</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Auteur</th>
                <th>Catégorie</th>
                <th>Description</th>
                <th>Rattaché à</th>
                <th className="text-right">HTVA</th>
                <th className="text-right">TVA</th>
                <th className="text-right">TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-midnight-400 py-6">
                    Aucune note pour l'instant.
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(r.date)}</td>
                    <td>
                      {r.user.firstName} {r.user.lastName}
                    </td>
                    <td>
                      <span className="text-xs bg-midnight-100 text-midnight-700 rounded px-1.5 py-0.5">
                        {CATEGORY_LABELS[r.category] ?? r.category}
                      </span>
                    </td>
                    <td className="text-sm">
                      {r.description}
                      {r.receiptUrl && (
                        <a
                          href={r.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 text-[10px] text-indigoaccent hover:underline"
                        >
                          ticket
                        </a>
                      )}
                    </td>
                    <td className="text-xs">
                      {r.mission ? (
                        <span>
                          {r.mission.reference}
                          <div className="text-midnight-400">{r.mission.title}</div>
                        </span>
                      ) : r.project ? (
                        <span>
                          {r.project.reference}
                          <div className="text-midnight-400">{r.project.name}</div>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(r.amountHt))}</td>
                    <td className="text-right tabular-nums">{formatCurrency(Number(r.vatAmount))}</td>
                    <td className="text-right tabular-nums font-medium">
                      {formatCurrency(Number(r.amountTtc))}
                    </td>
                    <td>
                      <span
                        className={`text-[10px] rounded px-1.5 py-0.5 ${
                          STATUS_LABELS[r.status]?.cls ?? ""
                        }`}
                      >
                        {STATUS_LABELS[r.status]?.label ?? r.status}
                      </span>
                      {r.approvedBy && (
                        <div className="text-[10px] text-midnight-400 mt-0.5">
                          par {r.approvedBy.firstName} {r.approvedBy.lastName}
                        </div>
                      )}
                      {r.rejectionReason && (
                        <div className="text-[10px] text-red-600 mt-0.5">
                          {r.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td>
                      <ExpenseActions
                        id={r.id}
                        status={r.status}
                        canApprove={isApprover}
                        canMarkPaid={canMarkPaid}
                        isOwner={r.userId === session.user.id}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "warn";
}) {
  const color = tone === "warn" ? "text-amber-700" : "text-midnight-900";
  return (
    <div className="card p-4">
      <div className="text-xs text-midnight-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-midnight-400 mt-0.5">{sub}</div>}
    </div>
  );
}
