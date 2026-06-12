import { cn } from "@/lib/utils";

const VARIANTS: Record<string, string> = {
  // OfferStatus
  DRAFT:        "badge-neutral",
  SENT:         "badge-info",
  NEGOTIATION:  "badge-warning",
  WON:          "badge-success",
  LOST:         "badge-danger",
  CANCELLED:    "badge-neutral",
  // ProjectStatus
  TO_START:     "badge-info",
  ACTIVE:       "badge-success",
  ON_HOLD:      "badge-warning",
  COMPLETED:    "badge-neutral",
  // Timesheet
  SUBMITTED:    "badge-info",
  APPROVED:     "badge-success",
  REJECTED:     "badge-danger",
  // Milestone
  PLANNED:      "badge-neutral",
  READY:        "badge-warning",
  INVOICED:     "badge-info",
  TRANSMITTED:  "badge-info",
  PAID:         "badge-success",
  // Purchase
  ORDERED:      "badge-info",
  RECEIVED:     "badge-warning",
  // Company
  PROSPECT:     "badge-info",
  CLIENT:       "badge-success",
  PARTNER:      "badge-warning",
  SUPPLIER:     "badge-neutral",
  ACTIVE_CT:    "badge-success",
  INACTIVE:     "badge-neutral",
  ARCHIVED:     "badge-neutral"
};

const LABELS: Record<string, string> = {
  DRAFT: "Brouillon", SENT: "Envoyée", NEGOTIATION: "En négociation",
  WON: "Gagnée", LOST: "Perdue", CANCELLED: "Annulée",
  TO_START: "À démarrer", ACTIVE: "Actif", ON_HOLD: "En pause",
  COMPLETED: "Terminé",
  SUBMITTED: "Soumis", APPROVED: "Validé", REJECTED: "Refusé",
  PLANNED: "Prévue", READY: "Prête à facturer", INVOICED: "Facturée",
  TRANSMITTED: "Transmise Peppol",
  PAID: "Payée",
  ORDERED: "Commandé", RECEIVED: "Reçu",
  PROSPECT: "Prospect", CLIENT: "Client", PARTNER: "Partenaire", SUPPLIER: "Fournisseur",
  INACTIVE: "Inactif", ARCHIVED: "Archivé",
  ACTIVE_CT: "Actif"
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return <span className={cn(VARIANTS[status] ?? "badge-neutral", className)}>{LABELS[status] ?? status}</span>;
}
