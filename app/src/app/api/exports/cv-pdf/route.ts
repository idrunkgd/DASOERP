/**
 * Export PDF du CV d'un candidat OU d'un consultant interne (User).
 *
 *   GET /api/exports/cv-pdf?candidateId=<id>
 *   GET /api/exports/cv-pdf?userId=<id>
 *
 * Le PDF est indépendant d'une offre : c'est un vrai CV standalone
 * (bandeau nom/photo, compétences, langues, expériences pro).
 *
 * Contrôle d'accès :
 *   - candidate : nécessite consulting.read (mêmes permissions que la
 *     fiche candidat)
 *   - user     : accepté si (a) l'utilisateur exporte son propre CV,
 *     (b) users.manage, (c) consulting.write (recrutement/commercial).
 */
import { NextRequest } from "next/server";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import {
  requirePermission, requireSession, getUserEffectivePermissions
} from "@/lib/rbac";
import { getCompanyInfo } from "@/lib/company-info";
import { CvPdf, type CvProfile } from "@/lib/cv-pdf-template";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const candidateId = req.nextUrl.searchParams.get("candidateId");
  const userId = req.nextUrl.searchParams.get("userId");
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  if (!candidateId && !userId) return new Response("Missing candidateId or userId", { status: 400 });
  if (candidateId && userId) return new Response("Provide only one of candidateId or userId", { status: 400 });

  let profile: CvProfile;
  let filename: string;

  if (candidateId) {
    // Accès candidat = même permission que voir sa fiche
    await requirePermission("consulting.read");
    const c = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    });
    if (!c) return new Response("Not found", { status: 404 });
    profile = {
      kind: "candidate",
      firstName: c.firstName, lastName: c.lastName,
      photoUrl: c.photoUrl, seniority: c.seniority,
      yearsExperience: c.yearsExperience, city: c.city,
      email: c.email, phone: c.phone, linkedinUrl: c.linkedinUrl,
      skills: c.skills, spokenLanguages: c.spokenLanguages,
      experiences: c.experiences.map((e) => ({
        companyName: e.companyName, jobTitle: e.jobTitle,
        startDate: e.startDate, endDate: e.endDate, description: e.description
      }))
    };
    filename = `CV-${c.firstName}-${c.lastName}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  } else {
    // Accès User (consultant interne) : perm plus stricte
    const session = await requireSession();
    if (userId !== session.user.id) {
      const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
      if (!perms.includes("users.manage") && !perms.includes("consulting.write")) {
        return new Response("Forbidden", { status: 403 });
      }
    }
    const u = await prisma.user.findUnique({
      where: { id: userId! },
      include: { experiences: { orderBy: { startDate: "desc" } } }
    });
    if (!u) return new Response("Not found", { status: 404 });
    profile = {
      kind: "user",
      firstName: u.firstName, lastName: u.lastName,
      photoUrl: u.photoUrl, seniority: u.seniority,
      yearsExperience: u.yearsExperience, city: u.city,
      email: u.email, phone: u.phone, linkedinUrl: u.linkedinUrl,
      skills: u.skills, spokenLanguages: u.spokenLanguages,
      experiences: u.experiences.map((e) => ({
        companyName: e.companyName, jobTitle: e.jobTitle,
        startDate: e.startDate, endDate: e.endDate, description: e.description
      }))
    };
    filename = `CV-${u.firstName}-${u.lastName}.pdf`.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }

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
    console.error("CV PDF failed", e);
    return new Response(`PDF generation failed: ${String(e?.message ?? e)}`, {
      status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
}
