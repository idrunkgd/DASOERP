/**
 * Export PDF du CV d'un candidat PROPOSÉ via un portail client.
 *
 *   GET /api/portal/[token]/cv/[proposalId]
 *
 * Authentification : UNIQUEMENT par couple (token portail actif, proposalId
 * valide + visible). Aucun login requis — c'est l'endpoint public utilisé
 * par le portail client. Pas de données internes exposées :
 *   - le TJM affiché sur le CV est celui proposé AU CLIENT (proposedDailyRate),
 *     pas le TJM interne.
 *   - les coordonnées internes du candidat sont déjà filtrées côté template
 *     par le cvContact si configuré (comportement standard du CV Dasolabs).
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { getCompanyInfo } from "@/lib/company-info";
import { CvPdf, type CvProfile } from "@/lib/cv-pdf-template";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; proposalId: string } }
) {
  const { token, proposalId } = params;
  if (!token || !proposalId) return new Response("Lien invalide.", { status: 400 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";

  const portal = await (prisma as any).clientPortal.findUnique({
    where: { token },
    select: { id: true, isActive: true }
  });
  if (!portal || !portal.isActive) return new Response("Lien expiré.", { status: 404 });

  const proposal = await (prisma as any).candidateProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true, portalId: true, isVisible: true,
      proposedDailyRate: true, candidateId: true
    }
  });
  if (!proposal || proposal.portalId !== portal.id || !proposal.isVisible) {
    return new Response("Proposition introuvable.", { status: 404 });
  }

  const c = await (prisma as any).candidate.findUnique({
    where: { id: proposal.candidateId },
    include: { experiences: { orderBy: { startDate: "desc" } } }
  });
  if (!c) return new Response("Candidat introuvable.", { status: 404 });

  let candidateTrainings: any[] = [];
  try {
    candidateTrainings = await (prisma as any).candidateTraining.findMany({
      where: { candidateId: c.id },
      orderBy: { createdAt: "desc" }
    });
  } catch { /* ignore */ }

  let cvContact: { name: string; role: string | null; email: string | null; phone: string | null } | null = null;
  if (c.cvContactUserId) {
    try {
      const contact = await (prisma as any).user.findUnique({
        where: { id: c.cvContactUserId },
        select: { firstName: true, lastName: true, email: true, phone: true, seniority: true }
      });
      if (contact) {
        cvContact = {
          name:  `${contact.firstName} ${contact.lastName}`,
          role:  c.cvContactRole ?? contact.seniority ?? null,
          email: contact.email ?? null,
          phone: contact.phone ?? null
        };
      }
    } catch { /* ignore */ }
  }

  const profile: CvProfile = {
    kind: "candidate",
    firstName: c.firstName, lastName: c.lastName,
    photoUrl: c.photoUrl, seniority: c.seniority,
    yearsExperience: c.yearsExperience, city: c.city,
    email: c.email, phone: c.phone, linkedinUrl: c.linkedinUrl,
    // TJM affiché = celui proposé au client, pas le tarif interne.
    dailyRate: Number(proposal.proposedDailyRate),
    skills: c.skills, spokenLanguages: c.spokenLanguages,
    interests: c.interests ?? [],
    experiences: c.experiences.map((e: any) => ({
      companyName: e.companyName, jobTitle: e.jobTitle,
      startDate: e.startDate, endDate: e.endDate, description: e.description
    })),
    trainings: candidateTrainings.map((t: any) => ({
      institution: t.institution, title: t.title,
      period: t.period ?? null, description: t.description ?? null
    })),
    cvContact
  };

  const filename = `CV-${c.firstName}-${c.lastName}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const companyInfo = await getCompanyInfo();
  try {
    const buffer = await renderToBuffer(
      React.createElement(CvPdf, { profile, companyInfo })
    );
    const u8 = new Uint8Array(buffer);
    return new Response(u8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
        "Content-Length": String(u8.length),
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e: any) {
    console.error("[portal/cv]", e);
    return new Response("Erreur génération PDF.", { status: 500 });
  }
}
