import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PortalClientView } from "./view";
import { trackPortalView } from "@/server/actions/client-portal-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublicPortalPage({ params }: { params: { token: string } }) {
  const portal = await (prisma as any).clientPortal.findUnique({
    where: { token: params.token },
    include: {
      proposals: {
        where: { isVisible: true },
        orderBy: [{ createdAt: "desc" }],
        include: {
          candidate: {
            select: {
              id: true, firstName: true, lastName: true,
              headline: true, yearsExperience: true, seniority: true,
              photoUrl: true, city: true,
              skills: true,
              experiences: {
                orderBy: { startDate: "desc" },
                take: 6,
                select: {
                  id: true, companyName: true, title: true,
                  startDate: true, endDate: true, description: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!portal || !portal.isActive) notFound();

  // Track view (best effort, non bloquant)
  trackPortalView(params.token).catch(() => {});

  // On ne passe JAMAIS la Decimal brute — Next refuse de sérialiser.
  const payload = JSON.parse(JSON.stringify({
    name: portal.name,
    logoUrl: portal.logoUrl,
    proposals: portal.proposals.map((p: any) => ({
      id: p.id,
      status: p.status,
      clientMessage: p.clientMessage,
      proposedDailyRate: Number(p.proposedDailyRate),
      candidate: {
        ...p.candidate,
        skills: Array.isArray(p.candidate.skills) ? p.candidate.skills : []
      }
    }))
  }));

  return <PortalClientView token={params.token} data={payload} />;
}
