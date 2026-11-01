"use server";
/**
 * Actions côté PUBLIC du portail client (pas de login, uniquement par token).
 * À utiliser uniquement depuis /portal/[token].
 *
 * Règles de sécurité :
 *  - On vérifie TOUJOURS la validité et l'activité du portail à chaque appel.
 *  - On ne renvoie JAMAIS d'infos internes (notes internes, cost, autres clients).
 *  - L'action du client est journalisée (audit log + notification à l'owner).
 */
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sendMail } from "@/lib/email";
import { revalidatePath } from "next/cache";

type Action = "ACCEPT" | "REJECT" | "REQUEST_INTERVIEW";

export async function respondToProposalPublic(input: {
  token: string;
  proposalId: string;
  action: Action;
  clientMessage?: string;
}) {
  if (!input.token || !input.proposalId) throw new Error("Lien invalide.");
  if (!["ACCEPT", "REJECT", "REQUEST_INTERVIEW"].includes(input.action))
    throw new Error("Action inconnue.");

  const portal = await (prisma as any).clientPortal.findUnique({
    where: { token: input.token },
    select: { id: true, isActive: true, name: true, company: { select: { name: true } } }
  });
  if (!portal || !portal.isActive) throw new Error("Lien introuvable ou désactivé.");

  const proposal = await (prisma as any).candidateProposal.findUnique({
    where: { id: input.proposalId },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } }
    }
  });
  if (!proposal || proposal.portalId !== portal.id || !proposal.isVisible) {
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
      clientActedAt: new Date()
    }
  });

  await logActivity({
    actorId: null,
    action: "UPDATE",
    entityType: "CandidateProposal",
    entityId: proposal.id,
    message: `[Portail ${portal.name}] Client a répondu : ${status}${input.clientMessage ? ` — « ${input.clientMessage.slice(0, 120)} »` : ""}`
  });

  // Notif in-app + email à l'owner du candidat
  if (proposal.ownerUserId) {
    const title = {
      ACCEPTED: `✅ ${portal.name} accepte ${proposal.candidate.firstName} ${proposal.candidate.lastName}`,
      REJECTED: `❌ ${portal.name} refuse ${proposal.candidate.firstName} ${proposal.candidate.lastName}`,
      INTERVIEW_REQUESTED: `📅 ${portal.name} veut rencontrer ${proposal.candidate.firstName} ${proposal.candidate.lastName}`
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
  // Appelé une fois au chargement de /portal/[token] pour le compteur.
  await (prisma as any).clientPortal.updateMany({
    where: { token, isActive: true },
    data: { lastViewedAt: new Date(), viewCount: { increment: 1 } }
  });
}
