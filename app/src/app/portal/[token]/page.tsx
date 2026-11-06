import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PortalClientView } from "./view";
import { PortalClientViewV2 } from "./view-v2";
import { trackPortalView, resolvePortalByToken } from "@/server/actions/client-portal-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicPortalPage({ params }: { params: { token: string } }) {
  // Résout le token : lien général OU lien personnel.
  const resolved = await resolvePortalByToken(params.token);
  if (!resolved) notFound();

  const portal = await (prisma as any).clientPortal.findUnique({
    where: { id: resolved.portalId },
    include: {
      proposals: {
        where: { isVisible: true },
        orderBy: [{ createdAt: "desc" }],
        include: {
          candidate: {
            select: {
              id: true, firstName: true, lastName: true,
              yearsExperience: true, seniority: true,
              jobTitle: true,
              photoUrl: true, city: true,
              skills: true,
              experiences: {
                orderBy: { startDate: "desc" },
                take: 6,
                select: {
                  id: true, companyName: true, jobTitle: true,
                  startDate: true, endDate: true, description: true
                }
              }
            }
          },
          comments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, authorKind: true, authorName: true,
              content: true, createdAt: true
            }
          }
        }
      }
    }
  });
  if (!portal) notFound();

  trackPortalView(params.token).catch(() => {});

  const payload = JSON.parse(JSON.stringify({
    name: portal.name,
    logoUrl: portal.logoUrl,
    workflowVersion: portal.workflowVersion ?? "LEGACY",
    greetingName: resolved.contact?.name ?? null,
    // true si le token utilisé est celui du portail général (= vue interne Dasolabs)
    isDasolabsPreview: resolved.contact === null,
    proposals: portal.proposals.map((p: any) => ({
      id: p.id,
      status: p.status,
      clientMessage: p.clientMessage,
      actedByContactName: p.actedByContactName ?? null,
      proposedDailyRate: Number(p.proposedDailyRate),
      interview1Slots:       p.interview1Slots ?? null,
      interview1ConfirmedAt: p.interview1ConfirmedAt ?? null,
      interview1DoneAt:      p.interview1DoneAt ?? null,
      interview1Notes:       p.interview1Notes ?? null,
      interview2Slots:       p.interview2Slots ?? null,
      interview2ConfirmedAt: p.interview2ConfirmedAt ?? null,
      interview2DoneAt:      p.interview2DoneAt ?? null,
      interview2Notes:       p.interview2Notes ?? null,
      shortlistedAt:         p.shortlistedAt ?? null,
      comments: (p.comments ?? []).map((c: any) => ({
        id: c.id, authorKind: c.authorKind, authorName: c.authorName,
        content: c.content, createdAt: c.createdAt
      })),
      candidate: {
        ...p.candidate,
        skills: Array.isArray(p.candidate.skills) ? p.candidate.skills : []
      }
    }))
  }));

  if ((portal.workflowVersion ?? "LEGACY") === "V2") {
    return <PortalClientViewV2 token={params.token} data={payload} />;
  }
  return <PortalClientView token={params.token} data={payload} />;
}
