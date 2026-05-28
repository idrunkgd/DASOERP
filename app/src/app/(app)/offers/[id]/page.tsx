import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { OfferHeaderForm } from "../offer-header-form";
import { OfferLinesEditor } from "./lines-editor";
import { MilestonesEditor } from "./milestones-editor";
import { OptionsEditor } from "./options-editor";
import { OfferActions } from "./offer-actions";
import { formatCurrency, formatPercent, formatDate } from "@/lib/utils";
import { isOfferEditable, canCreateNewVersion, isOfferFinal, offerLockMessage } from "@/lib/offer-rules";
import { Lock } from "lucide-react";

export default async function OfferDetail({ params }: { params: { id: string } }) {
  await requirePermission("offers.read");
  const offer = await prisma.offer.findUnique({
    where: { id: params.id },
    include: {
      company: true, owner: true,
      lines: { orderBy: { position: "asc" } },
      options: {
        include: { lines: { orderBy: { position: "asc" } } },
        orderBy: { position: "asc" }
      },
      milestones: { orderBy: { expectedAt: "asc" } },
      project: true,
      parentOffer: { select: { id: true, reference: true, title: true } },
      complements: { select: { id: true, reference: true, title: true, status: true, totalSell: true }, orderBy: { reference: "asc" } },
      previousVersion: { select: { id: true, reference: true, version: true, status: true } },
      nextVersion: { select: { id: true, reference: true, version: true, status: true } },
      missionRequest: { select: { id: true, reference: true, title: true } },
      application: { include: { candidate: true } }
    }
  });
  if (!offer) notFound();
  const [companies, users, profiles] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } }),
    prisma.serviceProfile.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <div>
      <PageHeader
        title={offer.title}
        breadcrumb={[{ label: "Offres", href: "/offers" }, { label: offer.reference }]}
        subtitle={
          <span>
            {offer.reference} · {offer.company.name} ·{" "}
            <span className={"badge-" + (offer.mode === "CONSULTING" ? "warning" : "info")}>
              {offer.mode === "CONSULTING" ? "Consultance T&M" : "Projet forfait"}
            </span>
            {offer.parentOffer && <> · Complément de <a href={`/offers/${offer.parentOffer.id}`} className="text-indigoaccent hover:underline">{offer.parentOffer.reference}</a></>}
          </span> as any
        }
        actions={
          <>
            <StatusBadge status={offer.status} className="mr-2" />
            <OfferActions offer={{
              id: offer.id, status: offer.status,
              projectId: offer.project?.id ?? null,
              isComplement: !!offer.parentOfferId,
              hasNextVersion: !!offer.nextVersion
            }} />
          </>
        }
      />

      {!isOfferEditable(offer.status) && (
        <div className={"card p-4 mb-5 flex items-start gap-3 " + (isOfferFinal(offer.status) ? "border-red-200 bg-red-50/40" : "border-amber-200 bg-amber-50/40")}>
          <Lock className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium text-midnight-900">Offre verrouillée</div>
            <div className="text-midnight-700">{offerLockMessage(offer.status)}</div>
            {offer.nextVersion && (
              <div className="text-xs text-midnight-500 mt-1">
                Une version plus récente existe : <a href={`/offers/${offer.nextVersion.id}`} className="text-indigoaccent hover:underline">{offer.nextVersion.reference}</a> (V{offer.nextVersion.version}, statut {offer.nextVersion.status}).
              </div>
            )}
          </div>
        </div>
      )}

      {(offer.previousVersion || offer.version > 1) && (
        <div className="text-xs text-midnight-500 mb-4">
          Version <span className="font-mono font-medium">V{offer.version}</span>
          {offer.previousVersion && <> — précédente : <a href={`/offers/${offer.previousVersion.id}`} className="text-indigoaccent hover:underline">{offer.previousVersion.reference}</a></>}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <OfferHeaderForm initial={offer as any} companies={companies} users={users} readOnly={!isOfferEditable(offer.status)} />
          <OfferLinesEditor offerId={offer.id} lines={offer.lines.filter((l: any) => !l.optionId) as any} profiles={profiles as any} readOnly={!isOfferEditable(offer.status)} />
          <OptionsEditor offerId={offer.id} options={offer.options as any} profiles={profiles as any} readOnly={!isOfferEditable(offer.status)} />
          <MilestonesEditor offerId={offer.id} milestones={offer.milestones as any} totalSell={Number(offer.totalSell)} readOnly={!isOfferEditable(offer.status)} />
          {offer.complements.length > 0 && (
            <section className="card p-5">
              <h2 className="font-semibold mb-3">Compléments d'offre ({offer.complements.length})</h2>
              <table className="table-base">
                <thead><tr><th>Réf</th><th>Titre</th><th>Statut</th><th className="text-right">Montant HT</th></tr></thead>
                <tbody>
                  {offer.complements.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono text-xs">{c.reference}</td>
                      <td><a href={`/offers/${c.id}`} className="hover:underline">{c.title}</a></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td className="text-right tabular-nums">{formatCurrency(c.totalSell)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5 space-y-2">
            <h3 className="font-semibold mb-2">Synthèse financière</h3>
            <Row k="Total vente HT" v={formatCurrency(offer.totalSell)} />
            <Row k="Total coût" v={formatCurrency(offer.totalCost)} />
            <Row k="Marge €" v={formatCurrency(offer.marginAmount)} />
            <Row k="Marge %" v={formatPercent(offer.marginPct)} />
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Suivi</h3>
            <Row k="Probabilité" v={`${offer.probability}%`} />
            <Row k="Envoyée le" v={offer.sentAt ? formatDate(offer.sentAt) : "—"} />
            <Row k="Décision prévue" v={offer.expectedDecisionAt ? formatDate(offer.expectedDecisionAt) : "—"} />
            <Row k="Clôturée le" v={offer.closedAt ? formatDate(offer.closedAt) : "—"} />
            <Row k="Responsable" v={offer.owner ? `${offer.owner.firstName} ${offer.owner.lastName}` : "—"} />
            {offer.project && <Row k="Projet" v={<Link href={`/projects/${offer.project.id}`} className="text-indigoaccent hover:underline">{offer.project.reference}</Link>} />}
          </div>
          <div className="card p-5 space-y-2 text-sm">
            <h3 className="font-semibold mb-2">Documents</h3>
            <a
              href={`/api/exports/offer-pdf?id=${offer.id}`}
              download={`${offer.reference}.pdf`}
              className="btn-primary w-full justify-center"
            >
              Télécharger le devis PDF
            </a>
            <a
              href={`/api/exports/offer-pdf?id=${offer.id}&inline=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost w-full justify-center text-xs"
            >
              Aperçu PDF (nouvel onglet)
            </a>
            <a href={`/api/exports/offer-csv?id=${offer.id}`} className="btn-ghost w-full justify-center text-xs">Export CSV lignes</a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between text-sm"><span className="text-midnight-500">{k}</span><span className="text-midnight-900 font-medium">{v}</span></div>;
}
