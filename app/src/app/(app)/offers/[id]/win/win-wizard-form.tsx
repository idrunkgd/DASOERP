"use client";
// Wizard de passage en "Gagnée" d'une offre :
//  - Bloc projet : nom, manager, dates planifiées, notes
//  - Liste des milestones : date d'émission de facture éditable
//  - Preview cashflow : pour chaque milestone, on calcule la date d'encaissement
//    (= date facture + paymentTermsDays, snap fin de mois) et le montant TVAC (×1.21)
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { winOfferAndCreateProject } from "@/server/actions/offer-win";
import { formatCurrency } from "@/lib/utils";

type Offer = {
  id: string;
  reference: string;
  title: string;
  mode: string;
  ownerId: string | null;
  totalSell: number;
  milestones: {
    id: string;
    label: string;
    amount: number;
    percentage: number | null;
    expectedAt: string | null;
  }[];
};

type User = { id: string; firstName: string; lastName: string };

const VAT_RATE = 0.21;

export function WinWizardForm({
  offer,
  users,
  paymentTermsDays
}: {
  offer: Offer;
  users: User[];
  paymentTermsDays: number;
}) {
  const [name, setName] = useState(offer.title);
  const [managerId, setManagerId] = useState(offer.ownerId ?? "");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [notes, setNotes] = useState("");

  // Map des dates milestones (id → ISO date string)
  const [milestoneDates, setMilestoneDates] = useState<Record<string, string>>(
    () => {
      const init: Record<string, string> = {};
      const today = new Date().toISOString().slice(0, 10);
      for (const m of offer.milestones) {
        init[m.id] = m.expectedAt ?? today;
      }
      return init;
    }
  );

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function expectedPaymentISO(invoiceISO: string): string {
    if (!invoiceISO) return "";
    const d = new Date(invoiceISO + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + paymentTermsDays);
    // Snap fin de mois
    const eom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return eom.toISOString().slice(0, 10);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Le nom du projet est requis");
      return;
    }
    start(async () => {
      try {
        await winOfferAndCreateProject(
          offer.id,
          {
            name,
            managerId: managerId || null,
            plannedStart: plannedStart || null,
            plannedEnd: plannedEnd || null,
            notes: notes || null
          },
          offer.milestones.map((m) => ({
            id: m.id,
            expectedAt: milestoneDates[m.id]
          }))
        );
        // redirect géré côté serveur
      } catch (e: any) {
        setError(e?.message || "Erreur lors de la création");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="card p-5">
        <h2 className="font-semibold mb-3">Configuration du projet</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Nom du projet <span className="text-red-600">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Manager
            </label>
            <select
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
              className="input mt-1"
            >
              <option value="">— Sans manager —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Démarrage prévu
            </label>
            <input
              type="date"
              value={plannedStart}
              onChange={(e) => setPlannedStart(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Fin prévue
            </label>
            <input
              type="date"
              value={plannedEnd}
              onChange={(e) => setPlannedEnd(e.target.value)}
              className="input mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-midnight-700">
              Notes / rappels
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input mt-1 resize-y"
            />
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-semibold">
            Échéances de facturation ({offer.milestones.length})
          </h2>
          <p className="text-xs text-midnight-500">
            Délai de paiement client : {paymentTermsDays} jours fin de mois
          </p>
        </div>
        {offer.milestones.length === 0 ? (
          <p className="text-xs text-midnight-500">
            L'offre n'a pas de tranche de facturation définie. Le projet sera
            créé sans planning d'encaissement.
          </p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Tranche</th>
                <th className="text-right">Montant HT</th>
                <th>Date émission facture</th>
                <th>Encaissement attendu</th>
                <th className="text-right">Montant TVAC</th>
              </tr>
            </thead>
            <tbody>
              {offer.milestones.map((m) => {
                const invoiceDate = milestoneDates[m.id] || "";
                const cashDate = expectedPaymentISO(invoiceDate);
                const tvac = Math.round(m.amount * (1 + VAT_RATE) * 100) / 100;
                return (
                  <tr key={m.id}>
                    <td>
                      <div className="font-medium text-midnight-900">
                        {m.label}
                      </div>
                      {m.percentage !== null && (
                        <div className="text-[10px] text-midnight-500">
                          {m.percentage}% de l'offre
                        </div>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(m.amount)}
                    </td>
                    <td>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) =>
                          setMilestoneDates((d) => ({
                            ...d,
                            [m.id]: e.target.value
                          }))
                        }
                        required
                        className="input h-8 text-xs"
                      />
                    </td>
                    <td className="text-xs text-midnight-700">
                      {cashDate ? new Date(cashDate + "T00:00:00").toLocaleDateString("fr-BE") : "—"}
                    </td>
                    <td className="text-right tabular-nums font-medium text-emerald-700">
                      {formatCurrency(tvac)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-4 bg-indigoaccent/5 border-indigoaccent/30 text-sm">
        <p className="text-midnight-800">
          <strong>Récapitulatif</strong> : ce wizard va créer le projet{" "}
          <strong>« {name || "(sans nom)"} »</strong>, y rattacher l'offre{" "}
          <strong>{offer.reference}</strong> et planifier{" "}
          <strong>{offer.milestones.length}</strong> tranche
          {offer.milestones.length > 1 ? "s" : ""} de facturation. Les
          encaissements TVAC apparaîtront automatiquement dans le cashflow à
          leur date d'arrivée bancaire (facture + {paymentTermsDays}j fin de mois).
        </p>
      </section>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/offers/${offer.id}`)}
          className="btn-secondary"
          disabled={pending}
        >
          Annuler
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Création..." : "Créer le projet et marquer gagnée"}
        </button>
      </div>
    </form>
  );
}
