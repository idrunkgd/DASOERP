import { prisma } from "@/lib/db";
import { requireSession, can } from "@/lib/rbac";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  const role = session.user.role;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return Response.json({ results: [] });

  const limitEach = 5;
  const ic = { contains: q, mode: "insensitive" as const };

  const results: any[] = [];

  if (can(role, "companies.read")) {
    const cs = await prisma.company.findMany({
      where: { OR: [{ name: ic }, { vatNumber: ic }, { city: ic }] },
      take: limitEach
    });
    cs.forEach(c => results.push({ type: "company", id: c.id, title: c.name, subtitle: c.vatNumber ?? c.city ?? "", href: `/companies/${c.id}` }));
  }
  if (can(role, "contacts.read")) {
    const ct = await prisma.contact.findMany({
      where: { OR: [{ firstName: ic }, { lastName: ic }, { email: ic }] },
      include: { company: true }, take: limitEach
    });
    ct.forEach(c => results.push({ type: "contact", id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.company?.name ?? c.email ?? "", href: `/contacts/${c.id}` }));
  }
  if (can(role, "offers.read")) {
    const os = await prisma.offer.findMany({
      where: { OR: [{ title: ic }, { reference: ic }] }, include: { company: true }, take: limitEach
    });
    os.forEach(o => results.push({ type: "offer", id: o.id, title: `${o.reference} — ${o.title}`, subtitle: o.company.name, href: `/offers/${o.id}` }));
  }
  if (can(role, "projects.read")) {
    const ps = await prisma.project.findMany({
      where: { OR: [{ name: ic }, { reference: ic }] }, include: { company: true }, take: limitEach
    });
    ps.forEach(p => results.push({ type: "project", id: p.id, title: `${p.reference} — ${p.name}`, subtitle: p.company.name, href: `/projects/${p.id}` }));
  }
  if (can(role, "purchases.read")) {
    const pu = await prisma.purchase.findMany({
      where: { description: ic }, include: { project: true }, take: limitEach
    });
    pu.forEach(p => results.push({ type: "purchase", id: p.id, title: p.description, subtitle: p.project.reference, href: `/purchases/${p.id}` }));
  }
  if (can(role, "users.manage")) {
    const us = await prisma.user.findMany({
      where: { OR: [{ firstName: ic }, { lastName: ic }, { email: ic }] }, take: limitEach
    });
    us.forEach(u => results.push({ type: "user", id: u.id, title: `${u.firstName} ${u.lastName}`, subtitle: u.email, href: `/users/${u.id}` }));
  }
  if (can(role, "consulting.read")) {
    const ms = await prisma.missionRequest.findMany({
      where: { OR: [{ title: ic }, { reference: ic }] }, include: { company: true }, take: limitEach
    });
    ms.forEach(m => results.push({ type: "demande", id: m.id, title: `${m.reference} — ${m.title}`, subtitle: m.company.name, href: `/mission-requests/${m.id}` }));
    const exec = await prisma.mission.findMany({
      where: { OR: [{ title: ic }, { reference: ic }] }, include: { company: true, consultant: true }, take: limitEach
    });
    exec.forEach(e => results.push({
      type: "mission", id: e.id, title: `${e.reference} — ${e.title}`,
      subtitle: `${e.company.name}${e.consultant ? ` · ${e.consultant.firstName} ${e.consultant.lastName}` : ""}`,
      href: `/missions/${e.id}`
    }));
    const cs = await prisma.candidate.findMany({
      where: { OR: [{ firstName: ic }, { lastName: ic }, { email: ic }, { skills: { has: q } }] }, take: limitEach
    });
    cs.forEach(c => results.push({ type: "candidate", id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: c.seniority ?? c.email ?? "", href: `/candidates/${c.id}` }));
    const us = await prisma.user.findMany({
      where: {
        OR: [{ firstName: ic }, { lastName: ic }, { email: ic }, { skills: { has: q } }],
        role: { in: ["CONSULTANT","MANAGER","COMMERCIAL","FINANCE"] },
        candidateProfile: { is: null }   // exclut les comptes portail candidat
      }, take: limitEach
    });
    us.forEach(u => results.push({ type: "consultant", id: u.id, title: `${u.firstName} ${u.lastName}`, subtitle: u.seniority ?? u.email, href: `/consultants/${u.id}` }));
  }

  return Response.json({ results });
}
