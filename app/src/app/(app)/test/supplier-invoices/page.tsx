import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { UploadAndCreate } from "./upload-and-create";
import { RowActions } from "./row-actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Brouillon", cls: "bg-midnight-100 text-midnight-700" },
  PENDING: { label: "À payer", cls: "bg-amber-100 text-amber-700" },
  PAID: { label: "Payée", cls: "bg-emerald-100 text-emerald-700" },
  DISPUTED: { label: "Litige", cls: "bg-orange-100 text-orange-700" },
  CANCELLED: { label: "Annulée", cls: "bg-red-100 text-red-700" }
};

export default async function SupplierInvoicesPage({
  searchParams
}: {
  searchParams: { status?: string };
}) {
  const session = await requireSession();
  if (!["ADMIN", "FINANCE", "MANAGER"].includes(session.user.role)) {
    return <div className="text-sm text-midnight-500">Accès refusé.</div>;
  }

  const where: any = {};
  if (searchParams.status) where.status = searchParams.status;

  const [invoices, companies] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: {
        supplierCompany: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } }
      },
      orderBy: { invoiceDate: "desc" },
      take: 200
    }),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    })
  ]);

  // KPIs
  const totalToPay = invoices
    .filter((i) => i.status === "PENDING")
    .reduce((s, i) => s + Number(i.amountTtc), 0);
  const totalPaidYtd = invoices
    .filter(
      (i) =>
        i.status === "PAID" &&
        i.invoiceDate.getUTCFullYear() === new Date().getUTCFullYear()
    )
    .reduce((s, i) => s + Number(i.amountTtc), 0);
  const totalVatDeductibleYtd = invoices
    .filter(
      (i) =>
        i.status !== "CANCELLED" &&
        i.invoiceDate.getUTCFullYear() === new Date().getUTCFullYear()
    )
    .reduce((s, i) => s + Number(i.vatAmount), 0);

  return (
    <div>
      <PageHeader
        title="Factures fournisseurs"
        subtitle="Mirror de Skwarel — drop les PDFs reçus par Peppol, l'OCR remplit automatiquement"
      />

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Kpi
          label="À payer"
          value={formatCurrency(totalToPay)}
          sub={`${invoices.filter((i) => i.status === "PENDING").length} factures en attente`}
          tone={totalToPay > 0 ? "warn" : undefined}
        />
        <Kpi
          label="Payé YTD"
          value={formatCurrency(totalPaidYtd)}
          sub="Cumul de l'année courante"
        />
        <Kpi
          label="TVA déductible YTD"
          value={formatCurrency(totalVatDeductibleYtd)}
          sub="Alimente la déclaration TVA (case 59)"
          tone="ok"
        />
      </div>

      {/* Zone d'upload */}
      <div className="card mb-6">
        <div className="card-header font-semibold">Ajouter une facture</div>
        <div className="p-4">
          <UploadAndCreate companies={companies} />
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        <div className="card-header flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold">Factures ({invoices.length})</div>
          <form className="flex gap-2 text-sm">
            <select
              name="status"
              defaultValue={searchParams.status ?? ""}
              className="input text-sm"
            >
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
                <th>Échéance</th>
                <th>Fournisseur</th>
                <th>N°</th>
                <th className="text-right">HTVA</th>
                <th className="text-right">TVA</th>
                <th className="text-right">TTC</th>
                <th>Statut</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-midnight-400 py-6">
                    Aucune facture pour l'instant. Drop un PDF ci-dessus pour commencer.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const overdue =
                    inv.status === "PENDING" &&
                    inv.dueDate &&
                    inv.dueDate.getTime() < Date.now();
                  return (
                    <tr key={inv.id}>
                      <td className="text-xs whitespace-nowrap">
                        {formatDate(inv.invoiceDate)}
                      </td>
                      <td className="text-xs whitespace-nowrap">
                        {inv.dueDate ? (
                          <span className={overdue ? "text-red-700 font-semibold" : ""}>
                            {formatDate(inv.dueDate)}
                            {overdue && " ⚠"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {inv.supplierCompany ? (
                          <span className="font-medium">{inv.supplierCompany.name}</span>
                        ) : (
                          <span className="text-midnight-700">{inv.supplierName}</span>
                        )}
                      </td>
                      <td className="text-xs font-mono">{inv.invoiceNumber ?? "—"}</td>
                      <td className="text-right tabular-nums">
                        {formatCurrency(Number(inv.amountHt))}
                      </td>
                      <td className="text-right tabular-nums text-xs">
                        {formatCurrency(Number(inv.vatAmount))}
                        <div className="text-[10px] text-midnight-400">{Number(inv.vatRate)}%</div>
                      </td>
                      <td className="text-right tabular-nums font-medium">
                        {formatCurrency(Number(inv.amountTtc))}
                      </td>
                      <td>
                        <span
                          className={`text-[10px] rounded px-1.5 py-0.5 ${
                            STATUS_LABELS[inv.status]?.cls ?? ""
                          }`}
                        >
                          {STATUS_LABELS[inv.status]?.label ?? inv.status}
                        </span>
                      </td>
                      <td>
                        <span className="text-[10px] text-midnight-500">
                          {inv.source === "manual" ? "Manuel" : inv.source === "email" ? "Email" : inv.source}
                        </span>
                      </td>
                      <td>
                        <RowActions
                          id={inv.id}
                          status={inv.status}
                          pdfUrl={inv.pdfUrl}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 text-[11px] text-midnight-400">
        💡 Pour automatiser : Phase 2 — un webhook email (Mailgun) recevra direct les
        notifications Skwarel et créera les factures sans intervention. Pour l'instant,
        télécharge les PDFs depuis Skwarel et drop-les ici.
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
  tone?: "warn" | "ok";
}) {
  const color =
    tone === "warn" ? "text-amber-700" : tone === "ok" ? "text-emerald-700" : "text-midnight-900";
  return (
    <div className="card p-4">
      <div className="text-xs text-midnight-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-midnight-400 mt-0.5">{sub}</div>}
    </div>
  );
}
