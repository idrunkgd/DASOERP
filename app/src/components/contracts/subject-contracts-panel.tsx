import Link from "next/link";
import { FileText } from "lucide-react";
import { GenerateContractButton } from "./generate-contract-button";

type C = {
  id: string;
  reference: string;
  title: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
};

const STATUS_TONE: Record<string, string> = {
  DRAFT:      "bg-midnight-100 text-midnight-700",
  ACTIVE:     "bg-emerald-100 text-emerald-700",
  TERMINATED: "bg-amber-100 text-amber-700",
  CANCELLED:  "bg-red-100 text-red-700"
};

/**
 * Panneau "Contrats" à afficher sur la fiche user ou candidate.
 * Liste les contrats existants + bouton de génération si l'utilisateur a
 * la permission `contracts.manage`.
 */
export function SubjectContractsPanel({
  contracts,
  templates,
  subject,
  canManage
}: {
  contracts: C[];
  templates: Array<{ id: string; name: string }>;
  subject: { kind: "user" | "candidate"; id: string; label: string };
  canManage: boolean;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-midnight-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigoaccent" /> Contrats ({contracts.length})
        </h2>
      </div>
      {contracts.length === 0 ? (
        <p className="text-sm text-midnight-500 italic mb-3">
          Aucun contrat lié.
        </p>
      ) : (
        <ul className="space-y-2 mb-3 text-sm">
          {contracts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-b-0">
              <div className="min-w-0">
                <Link href={`/contracts/${c.id}`} className="font-medium text-midnight-900 hover:text-indigoaccent">
                  {c.reference}
                </Link>
                <div className="text-xs text-midnight-500 truncate">{c.title}</div>
                {(c.startDate || c.endDate) && (
                  <div className="text-[10px] text-midnight-400">
                    {c.startDate && c.startDate.toLocaleDateString("fr-BE")}
                    {c.startDate && c.endDate && " → "}
                    {c.endDate && c.endDate.toLocaleDateString("fr-BE")}
                  </div>
                )}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_TONE[c.status] ?? ""}`}>
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManage && (
        <GenerateContractButton subject={subject} templates={templates} />
      )}
    </section>
  );
}
