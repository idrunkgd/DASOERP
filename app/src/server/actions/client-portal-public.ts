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

// ─── Workflow V2 ────────────────────────────────────────────────────

type Slot = { date: string; startTime: string; endTime: string; mode: "VISIO" | "ONSITE" };

function validateSlots(slots: Slot[]): Slot[] {
  if (!Array.isArray(slots)) throw new Error("Créneaux invalides.");
  if (slots.length < 1 || slots.length > 3) throw new Error("Proposez entre 1 et 3 créneaux.");
  const clean: Slot[] = [];
  for (const s of slots) {
    if (!s || typeof s !== "object") throw new Error("Créneau invalide.");
    const { date, startTime, endTime, mode } = s;
    if (!date || !startTime || !endTime) throw new Error("Chaque créneau doit avoir date + heure début + heure fin.");
    if (mode !== "VISIO" && mode !== "ONSITE") throw new Error("Mode d'entretien invalide.");
    clean.push({ date, startTime, endTime, mode });
  }
  return clean;
}

type V2Action =
  | { kind: "ACCEPT" }
  | { kind: "REJECT" }
  | { kind: "SHORTLIST" }
  | { kind: "REQUEST_INTERVIEW_1"; slots: Slot[] }
  | { kind: "REQUEST_INTERVIEW_2"; slots: Slot[] }
  | { kind: "REQUEST_ADDITIONAL_INTERVIEW"; slots: Slot[] };

/**
 * Applique une action V2 sur une proposition. Vérifie que la transition
 * d'état est valide.
 */
export async function respondToProposalV2(input: {
  token: string;
  proposalId: string;
  action: V2Action;
  clientMessage?: string;
}) {
  const resolved = await resolvePortalByToken(input.token);
  if (!resolved) throw new Error("Lien introuvable ou désactivé.");
  if (!resolved.contact) {
    throw new Error("Le lien général est réservé à la prévisualisation Dasolabs — utilisez votre lien personnel.");
  }

  const p = await (prisma as any).candidateProposal.findUnique({
    where: { id: input.proposalId },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      portal:    { select: { workflowVersion: true } }
    }
  });
  if (!p || p.portalId !== resolved.portalId || !p.isVisible) throw new Error("Proposition introuvable.");
  if (p.portal.workflowVersion !== "V2") throw new Error("Ce portail est en mode classique.");

  const curr = p.status as string;
  const data: Record<string, any> = {
    clientMessage: input.clientMessage?.trim() || null,
    clientActedAt: new Date(),
    actedByContactId:   resolved.contact?.id   ?? null,
    actedByContactName: resolved.contact?.name ?? null
  };
  let nextStatus: string | null = null;

  // Transitions assouplies : le client peut toujours progresser sans
  // attendre le marquage admin "entretien effectué".
  switch (input.action.kind) {
    case "ACCEPT":
      // Toujours possible tant qu'on n'est pas en état terminal
      if (["ACCEPTED", "REJECTED"].includes(curr))
        throw new Error("Décision déjà prise.");
      nextStatus = "ACCEPTED";
      break;
    case "REJECT":
      if (["ACCEPTED", "REJECTED"].includes(curr))
        throw new Error("Décision déjà prise.");
      nextStatus = "REJECTED";
      break;
    case "SHORTLIST":
      // Shortlist possible dès qu'un entretien a été demandé/fait
      if (!["INTERVIEW_1_REQUESTED", "INTERVIEW_1_DONE",
            "INTERVIEW_2_REQUESTED", "INTERVIEW_2_DONE"].includes(curr))
        throw new Error("Shortlist disponible après avoir demandé un entretien.");
      nextStatus = "SHORTLISTED";
      data.shortlistedAt = new Date();
      break;
    case "REQUEST_INTERVIEW_1":
      if (curr !== "PROPOSED") throw new Error("Entretien 1 déjà demandé.");
      data.interview1Slots = validateSlots(input.action.slots);
      nextStatus = "INTERVIEW_1_REQUESTED";
      break;
    case "REQUEST_INTERVIEW_2":
      // Possible dès qu'on a demandé OU fait l'entretien 1
      if (!["INTERVIEW_1_REQUESTED", "INTERVIEW_1_DONE"].includes(curr))
        throw new Error("Entretien 2 nécessite d'avoir demandé l'entretien 1.");
      data.interview2Slots = validateSlots(input.action.slots);
      nextStatus = "INTERVIEW_2_REQUESTED";
      break;
    case "REQUEST_ADDITIONAL_INTERVIEW":
      if (curr !== "SHORTLISTED")
        throw new Error("Entretien complémentaire : réservé aux profils shortlistés.");
      data.interview2Slots = validateSlots(input.action.slots);
      nextStatus = "INTERVIEW_2_REQUESTED";
      break;
  }
  if (!nextStatus) throw new Error("Transition inconnue.");

  data.status = nextStatus;
  await (prisma as any).candidateProposal.update({ where: { id: p.id }, data });

  // Chaque action avec commentaire est aussi archivée dans le fil de discussion.
  // À ce stade, resolved.contact est non null (actions bloquées sur lien général).
  if (input.clientMessage?.trim() && resolved.contact) {
    await (prisma as any).candidateProposalComment.create({
      data: {
        proposalId: p.id,
        authorKind: "CLIENT",
        authorName: resolved.contact.name,
        authorContactId: resolved.contact.id,
        content: input.clientMessage.trim()
      }
    });
  }

  const actor = resolved.contact?.name ?? "lien général";
  await logActivity({
    actorId: null, action: "UPDATE", entityType: "CandidateProposal", entityId: p.id,
    message: `[Portail ${resolved.name}] ${actor} → ${nextStatus}`
  });

  if (p.ownerUserId) {
    const label: Record<string, string> = {
      ACCEPTED:              `✅ accepte`,
      REJECTED:              `❌ refuse`,
      SHORTLISTED:           `👥 shortliste`,
      INTERVIEW_1_REQUESTED: `📅 propose 3 créneaux pour entretien 1 avec`,
      INTERVIEW_2_REQUESTED: `📅 propose 3 créneaux pour entretien 2 avec`
    };
    const actorSuffix = resolved.contact ? ` (par ${resolved.contact.name})` : "";
    const title = `${resolved.name}${actorSuffix} ${label[nextStatus] ?? "→ " + nextStatus} ${p.candidate.firstName} ${p.candidate.lastName}`;
    await createNotification({
      userId: p.ownerUserId, type: "OTHER", title,
      message: input.clientMessage?.trim() || null,
      href: `/candidates/${p.candidate.id}`,
      entityType: "CandidateProposal", entityId: p.id
    });
  }

  revalidatePath(`/portal/${input.token}`);
  return { ok: true, status: nextStatus };
}

/**
 * Ajoute un commentaire client sans changer le statut. Permet une vraie
 * discussion : le client peut relancer / préciser sans devoir ré-agir.
 */
export async function addClientComment(input: {
  token: string;
  proposalId: string;
  content: string;
}) {
  const content = input.content?.trim();
  if (!content) throw new Error("Commentaire vide.");
  const resolved = await resolvePortalByToken(input.token);
  if (!resolved) throw new Error("Lien introuvable ou désactivé.");

  const p = await (prisma as any).candidateProposal.findUnique({
    where: { id: input.proposalId },
    include: { candidate: { select: { id: true, firstName: true, lastName: true } } }
  });
  if (!p || p.portalId !== resolved.portalId || !p.isVisible)
    throw new Error("Proposition introuvable.");

  // Si le token résolu est le lien général (pas un contact), c'est Dasolabs
  // qui écrit depuis la vue interne. On tague le commentaire en conséquence.
  const isDasolabs = !resolved.contact;
  const authorKind = isDasolabs ? "DASOLABS" : "CLIENT";
  const authorName = isDasolabs ? "Dasolabs" : resolved.contact!.name;

  await (prisma as any).candidateProposalComment.create({
    data: {
      proposalId: p.id,
      authorKind,
      authorName,
      authorContactId: resolved.contact?.id ?? null,
      content
    }
  });

  await logActivity({
    actorId: null, action: "UPDATE", entityType: "CandidateProposal", entityId: p.id,
    message: `[Portail ${resolved.name}] ${authorName} a commenté : « ${content.slice(0, 120)} »`
  });

  // Notif owner uniquement si c'est le client qui a commenté (pas si c'est
  // Dasolabs qui répond depuis la vue interne — l'owner c'est déjà nous).
  if (!isDasolabs && p.ownerUserId) {
    await createNotification({
      userId: p.ownerUserId, type: "OTHER",
      title: `💬 ${authorName} commente ${p.candidate.firstName} ${p.candidate.lastName}`,
      message: content.slice(0, 200),
      href: `/candidates/${p.candidate.id}`,
      entityType: "CandidateProposal", entityId: p.id
    });
  }

  revalidatePath(`/portal/${input.token}`);
  return { ok: true };
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
