import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PortalClientView } from "./view";
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
    // Si le token est nominatif, on affiche "Bonjour <prénom>" au client
    greetingName: resolved.contact?.name ?? null,
    proposals: portal.proposals.map((p: any) => ({
      id: p.id,
      status: p.status,
      clientMessage: p.clientMessage,
      actedByContactName: p.actedByContactName ?? null,
      proposedDailyRate: Number(p.proposedDailyRate),
      candidate: {
        ...p.candidate,
        skills: Array.isArray(p.candidate.skills) ? p.candidate.skills : []
      }
    }))
  }));

  return <PortalClientView token={params.token} data={payload} />;
}
