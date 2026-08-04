import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ContractView } from "./contract-view";
import { ArrowLeft } from "lucide-react";
import type { ContractChapterSnapshot } from "@/lib/contracts";

export const dynamic = "force-dynamic";

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  await requirePermissionOrRedirect("contracts.read");

  const contract = await prisma.contract.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, email: true } },
      generatedBy: { select: { firstName: true, lastName: true } }
    }
  });
  if (!contract) notFound();

  const subject = contract.user ?? contract.candidate;
  const subjectHref = contract.user
    ? `/users/${contract.user.id}`
    : contract.candidate ? `/candidates/${contract.candidate.id}` : null;

  // Chapters is a JSON field
  const chapters = (contract.chapters as unknown as ContractChapterSnapshot[]) ?? [];

  return (
    <div>
      <PageHeader
        title={contract.title}
        subtitle={`${contract.reference} · ${contract.status}${contract.templateName ? ` · issu de « ${contract.templateName} »` : ""}`}
        breadcrumb={[
          { label: "Contrats", href: "/contracts" },
          { label: contract.reference }
        ]}
        actions={
          <Link href="/contracts" className="btn-ghost btn-sm">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Link>
        }
      />
      <ContractView
        contract={{
          id: contract.id,
          reference: contract.reference,
          title: contract.title,
          status: contract.status,
          startDate: contract.startDate ? contract.startDate.toISOString().slice(0, 10) : "",
          endDate: contract.endDate ? contract.endDate.toISOString().slice(0, 10) : "",
          signedAt: contract.signedAt ? contract.signedAt.toISOString().slice(0, 16) : "",
          terminatedAt: contract.terminatedAt ? contract.terminatedAt.toISOString().slice(0, 16) : "",
          notes: contract.notes ?? "",
          chapters
        }}
        subject={
          subject && subjectHref
            ? { name: `${subject.firstName} ${subject.lastName}`, href: subjectHref }
            : null
        }
      />
    </div>
  );
}
