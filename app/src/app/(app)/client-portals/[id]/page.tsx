import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PortalDetailPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function ClientPortalDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("consulting.write");

  const portal = await (prisma as any).clientPortal.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      proposals: {
        orderBy: [{ createdAt: "desc" }],
        include: {
          candidate: {
            select: {
              id: true, firstName: true, lastName: true, headline: true,
              yearsExperience: true, seniority: true, status: true, photoUrl: true,
              skills: { select: { skill: { select: { name: true } } }, take: 10 }
            }
          }
        }
      }
    }
  });

  if (!portal) notFound();

  return (
    <div>
      <PageHeader
        title={portal.name}
        subtitle={`${portal.company?.name || ""} · ${portal.proposals.length} proposition${portal.proposals.length > 1 ? "s" : ""} · ${portal.viewCount} vue${portal.viewCount > 1 ? "s" : ""}`}
        breadcrumb={[
          { label: "Portails clients", href: "/client-portals" },
          { label: portal.name }
        ]}
      />
      <PortalDetailPanel portal={JSON.parse(JSON.stringify(portal))} />
      <div className="mt-6 text-xs text-midnight-500 flex gap-2">
        <Link href={`/candidates?proposeTo=${portal.id}`} className="btn-ghost">
          + Proposer un candidat depuis la liste
        </Link>
      </div>
    </div>
  );
}
