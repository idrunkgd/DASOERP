"use server";
/**
 * Actions côté PUBLIC du portail client (pas de login, uniquement par token).
 * À utiliser uniquement depuis /portal/[token].
 *
 * Résolution du token : d'abord ClientPortal.token (lien général), sinon
 * ClientPortalContact.token (lien personnel nominatif). Dans les deux cas,
 * la vue est identique côté client ; côté admin on sait qui a agi.
 */
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sendMail } from "@/lib/email";
import { revalidatePath } from "next/cache";

type Action = "ACCEPT" | "REJECT" | "REQUEST_INTERVIEW";

/**
 * Résout un token en un portail actif + éventuellement un contact nominatif.
 * Renvoie null si le token n'existe pas ou si tout est désactivé.
 */
export async function resolvePortalByToken(token: string): Promise<{
  portalId: string;
  isActive: boolean;
  name: string;
  companyName?: string | null;
  contact: { id: string; name: string; email: string | null } | null;
} | null> {
  if (!token) return null;
  // 1) Lien général
  const portal = await (prisma as any).clientPortal.findUnique({
    where: { token },
    select: {
      id: true, isActive: true, name: true,
      company: { select: { name: true } }
    }
  });
  if (portal) {
    if (!portal.isActive) return null;
    return {
      portalId: portal.id, isActive: true, name: portal.name,
      companyName: portal.company?.name ?? null, contact: null
    };
  }
  // 2) Lien personnel
  const contact = await (prisma as any).clientPortalContact.findUnique({
    where: { token },
    select: {
      id: true, name: true, email: true, isActive: true,
      portal: { select: {
        id: true, isActive: true, name: true,
        company: { select: { name: true } }
      } }
    }
  });
  if (!contact || !contact.isActive || !contact.portal?.isActive) return null;
  return {
    portalId: contact.portal.id,
    isActive: true,
    name: contact.portal.name,
    companyName: contact.portal.company?.name ?? null,
    contact: { id: contact.id, name: contact.name, email: contact.email }
  };
}

export async function respondToProposalPublic(input: {
  token: string;
  proposalId: string;
  action: Action;
  clientMessage?: string;
}) {
  if (!input.token || !input.proposalId) throw new Error("Lien invalide.");
  if (!["ACCEPT", "REJECT", "REQUEST_INTERVIEW"].includes(input.action))
    throw new Error("Action inconnue.");

  const resolved = await resolvePortalByToken(input.token);
  if (!resolved) throw new Error("Lien introuvable ou désactivé.");

  const proposal = await (prisma as any).candidateProposal.findUnique({
    where: { id: input.proposalId },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } }
    }
  });
  if (!proposal || proposal.portalId !== resolved.portalId || !proposal.isVisible) {
    throw new Error("Proposition introuvable.");
  }

  const status =
    input.action === "ACCEPT" ? "ACCEPTED" :
    input.action === "REJECT" ? "REJECTED" : "INTERVIEW_REQUESTED";

  await (prisma as any).candidateProposal.update({
    where: { id: proposal.id },
    data: {
      status,
      clientMessage: input.clientMessage?.trim() || null,
      clientActedAt: new Date(),
      actedByContactId:   resolved.contact?.id   ?? null,
      actedByContactName: resolved.contact?.name ?? null
    }
  });

  const actor = resolved.contact ? `${resolved.contact.name}` : "lien général";
  await logActivity({
    actorId: null,
    action: "UPDATE",
    entityType: "CandidateProposal",
    entityId: proposal.id,
    message: `[Portail ${resolved.name}] ${actor} a répondu : ${status}${input.clientMessage ? ` — « ${input.clientMessage.slice(0, 120)} »` : ""}`
  });

  if (proposal.ownerUserId) {
    const actorSuffix = resolved.contact ? ` par ${resolved.contact.name}` : "";
    const title = {
      ACCEPTED:            `✅ ${resolved.name}${actorSuffix} accepte ${proposal.candidate.firstName} ${proposal.candidate.lastName}`,
      REJECTED:            `❌ ${resolved.name}${actorSuffix} refuse ${proposal.candidate.firstName} ${proposal.candidate.lastName}`,
      INTERVIEW_REQUESTED: `📅 ${resolved.name}${actorSuffix} veut rencontrer ${proposal.candidate.firstName} ${proposal.candidate.lastName}`
    }[status];
    await createNotification({
      userId: proposal.ownerUserId,
      type: "OTHER",
      title,
      message: input.clientMessage?.trim() || null,
      href: `/candidates/${proposal.candidate.id}`,
      entityType: "CandidateProposal",
      entityId: proposal.id
    });
    try {
      const owner = await prisma.user.findUnique({
        where: { id: proposal.ownerUserId },
        select: { email: true, firstName: true }
      });
      if (owner?.email) {
        await sendMail({
          to: owner.email,
          subject: title,
          html: `<p>Bonjour ${owner.firstName || ""},</p>
                 <p>${title}</p>
                 ${input.clientMessage ? `<blockquote>${input.clientMessage}</blockquote>` : ""}
                 <p><a href="${process.env.NEXTAUTH_URL || ""}/candidates/${proposal.candidate.id}">Voir le candidat</a></p>`
        });
      }
    } catch (e) {
      console.error("[client-portal] email owner failed", e);
    }
  }

  revalidatePath(`/portal/${input.token}`);
  return { ok: true, status };
}

export async function trackPortalView(token: string) {
  // Incrémente le compteur sur l'entité qui porte réellement le token
  // (ClientPortal OU ClientPortalContact), pas forcément le portail.
  const [portalUpdate, contactUpdate] = await Promise.all([
    (prisma as any).clientPortal.updateMany({
      where: { token, isActive: true },
      data: { lastViewedAt: new Date(), viewCount: { increment: 1 } }
    }),
    (prisma as any).clientPortalContact.updateMany({
      where: { token, isActive: true },
      data: { lastViewedAt: new Date(), viewCount: { increment: 1 } }
    })
  ]);
  // best-effort — silencieux
}
