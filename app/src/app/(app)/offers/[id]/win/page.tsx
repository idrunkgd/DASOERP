// Wizard "Marquer l'offre gagnée" : configure le projet à créer et confirme
// les dates d'émission de facture des milestones. Affiche la preview du
// cashflow (date d'encaissement = facture + 30j fin de mois TVAC).
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { WinWizardForm } from "./win-wizard-form";
import { getCompanyInfo } from "@/lib/company-info";

export const dynamic = "force-dynamic";

export default async function WinOfferPage({ params }: { params: { id: string } }) {
  await requirePermission("offers.write");

  const [offer, users, companyInfo] = await Promise.all([
    prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        company: { select: { name: true } },
        milestones: { orderBy: { createdAt: "asc" } },
        project: { select: { id: true } },
        parentOffer: { include: { project: { select: { id: true } } } }
      }
    }),
    prisma.user.findMany({
      where: { active: true, candidateProfile: { is: null } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true }
    }),
    getCompanyInfo()
  ]);

  if (!offer) notFound();

  // Si l'offre est déjà WON ou a un projet, on ne propose plus le wizard
  if (offer.status === "WON" || offer.project) {
    redirect(`/offers/${params.id}`);
  }
  // Si c'est un complément avec un parent ayant un projet, on redirige vers la
  // fiche de l'offre (l'admin peut utiliser le bouton standard pour fusionner).
  if (offer.parentOfferId && offer.parentOffer?.project) {
    redirect(`/offers/${params.id}`);
  }

  const paymentTermsDays = companyInfo.paymentTermsDays ?? 30;

  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Offres", href: "/offers" },
          { label: offer.reference, href: `/offers/${params.id}` },
          { label: "Passage en gagnée" }
        ]}
        title="Marquer l'offre gagnée"
        subtitle={`${offer.reference} — ${offer.company.name} · vous allez créer le projet et planifier les jalons de facturation.`}
      />

      <WinWizardForm
        offer={{
          id: offer.id,
          reference: offer.reference,
          title: offer.title,
          mode: offer.mode,
          ownerId: offer.ownerId,
          totalSell: Number(offer.totalSell),
          vatRate: Number(offer.vatRate),
          milestones: offer.milestones.map((m) => ({
            id: m.id,
            label: m.label,
            amount: Number(m.amount),
            percentage: m.percentage ? Number(m.percentage) : null,
            expectedAt: m.expectedAt ? m.expectedAt.toISOString().slice(0, 10) : null
          }))
        }}
        users={users}
        paymentTermsDays={paymentTermsDays}
      />
    </div>
  );
}
