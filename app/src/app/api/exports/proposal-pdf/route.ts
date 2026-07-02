/**
 * Export PDF d'une MissionProposal (proposition consultant).
 * GET /api/exports/proposal-pdf?id=<proposalId>[&inline=1]
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { getCompanyInfo } from "@/lib/company-info";
import { ProposalPdf, type ProposalPdfData } from "@/lib/proposal-pdf-template";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requirePermission("consulting.read");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const proposal = await prisma.missionProposal.findUnique({
    where: { id },
    include: {
      missionRequest: {
        include: {
          company: true,
          contact: true
        }
      },
      candidate: {
        include: {
          experiences: { orderBy: { startDate: "desc" } }
        }
      },
      owner: true
    }
  });
  if (!proposal) return new Response("Not found", { status: 404 });

  const company = proposal.missionRequest.company;
  const addressLine = [company.street, company.postalCode, company.city, company.country]
    .filter(Boolean).join(", ") || null;

  const data: ProposalPdfData = {
    reference: proposal.reference,
    intro: proposal.intro,
    missionTitle: proposal.missionRequest.title,
    missionDescription: proposal.missionRequest.description,
    clientCompany: { name: company.name, vatNumber: company.vatNumber, addressLine },
    clientContact: proposal.missionRequest.contact
      ? {
          firstName: proposal.missionRequest.contact.firstName,
          lastName: proposal.missionRequest.contact.lastName,
          jobTitle: proposal.missionRequest.contact.jobTitle,
          email: proposal.missionRequest.contact.email,
          phone: proposal.missionRequest.contact.phone
        }
      : null,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    workDaysPerWeek: Number(proposal.workDaysPerWeek),
    includeHolidays: proposal.includeHolidays,
    computedDays: Number(proposal.computedDays),
    dailyRate: Number(proposal.dailyRate),
    computedBudgetHt: Number(proposal.computedBudgetHt),
    candidate: {
      firstName: proposal.candidate.firstName,
      lastName: proposal.candidate.lastName,
      photoUrl: proposal.candidate.photoUrl,
      seniority: proposal.candidate.seniority,
      yearsExperience: proposal.candidate.yearsExperience,
      city: proposal.candidate.city,
      email: proposal.candidate.email,
      phone: proposal.candidate.phone,
      skills: proposal.candidate.skills,
      spokenLanguages: proposal.candidate.spokenLanguages,
      experiences: proposal.candidate.experiences.map((e) => ({
        companyName: e.companyName,
        jobTitle: e.jobTitle,
        startDate: e.startDate,
        endDate: e.endDate,
        description: e.description
      }))
    },
    owner: proposal.owner
      ? {
          firstName: proposal.owner.firstName,
          lastName: proposal.owner.lastName,
          email: proposal.owner.email,
          phone: proposal.owner.phone
        }
      : null
  };

  const companyInfo = await getCompanyInfo();
  try {
    const buffer = await renderToBuffer(
      React.createElement(ProposalPdf, { data, companyInfo })
    );
    const u8 = new Uint8Array(buffer);
    return new Response(u8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${proposal.reference}.pdf"`,
        "Content-Length": String(u8.length),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e: any) {
    console.error("Proposal PDF failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
