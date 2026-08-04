"use server";
/**
 * Contrats — CRUD templates + génération / édition d'instances.
 *
 * Workflow standard :
 *   1. Admin crée un ContractTemplate ("CDI Consultant") avec ses chapitres.
 *   2. Sur la fiche d'un consultant / candidat, admin clique "Générer contrat"
 *      → server action `generateContractFromTemplate` : lit les données du
 *      sujet, résout les variables, snapshotte les chapitres, crée un Contract
 *      en DRAFT.
 *   3. Admin peut éditer les chapitres du contrat généré (snapshot autonome),
 *      changer le statut, exporter (à venir).
 */
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { resolveSubjectVariables, snapshotChapters, type ContractChapterSnapshot } from "@/lib/contracts";

// ═════════════ TEMPLATES ═════════════

const TemplateSchema = z.object({
  name: z.string().min(1).max(120).transform((v) => v.trim()),
  description: z.string().optional().nullable().transform((v) => v?.trim() || null),
  active: z.coerce.boolean().default(true)
});

export async function createContractTemplate(formData: FormData) {
  const session = await requirePermission("contracts.manage");
  const data = TemplateSchema.parse(Object.fromEntries(formData));
  const created = await prisma.contractTemplate.create({
    data: { ...data, createdById: session.user.id }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "ContractTemplate", entityId: created.id,
    message: `Template contrat créé : ${created.name}`
  });
  revalidatePath("/contracts");
  return { ok: true, id: created.id };
}

export async function updateContractTemplate(id: string, formData: FormData) {
  const session = await requirePermission("contracts.manage");
  const data = TemplateSchema.parse(Object.fromEntries(formData));
  await prisma.contractTemplate.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "ContractTemplate", entityId: id,
    message: `Template contrat mis à jour : ${data.name}`
  });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/templates/${id}`);
  return { ok: true };
}

export async function deleteContractTemplate(id: string) {
  const session = await requirePermission("contracts.manage");
  // Les Contracts existants gardent leur snapshot (templateId → SET NULL).
  const t = await prisma.contractTemplate.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "ContractTemplate", entityId: id,
    message: `Template contrat supprimé : ${t.name}`
  });
  revalidatePath("/contracts");
  return { ok: true };
}

// ═════════════ CHAPITRES DE TEMPLATE ═════════════

const ChapterSchema = z.object({
  title: z.string().min(1).max(200).transform((v) => v.trim()),
  bodyMd: z.string().default(""),
  sortOrder: z.coerce.number().int().default(0)
});

export async function addTemplateChapter(templateId: string, formData: FormData) {
  await requirePermission("contracts.manage");
  const data = ChapterSchema.parse(Object.fromEntries(formData));
  // Auto-index : si sortOrder = 0 par défaut, on met le max+1.
  const last = await prisma.contractTemplateChapter.findFirst({
    where: { templateId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true }
  });
  const sortOrder = data.sortOrder > 0 ? data.sortOrder : (last?.sortOrder ?? -1) + 1;
  await prisma.contractTemplateChapter.create({
    data: { templateId, title: data.title, bodyMd: data.bodyMd, sortOrder }
  });
  revalidatePath(`/contracts/templates/${templateId}`);
  return { ok: true };
}

export async function updateTemplateChapter(id: string, formData: FormData) {
  await requirePermission("contracts.manage");
  const data = ChapterSchema.parse(Object.fromEntries(formData));
  const c = await prisma.contractTemplateChapter.update({ where: { id }, data });
  revalidatePath(`/contracts/templates/${c.templateId}`);
  return { ok: true };
}

export async function deleteTemplateChapter(id: string) {
  await requirePermission("contracts.manage");
  const c = await prisma.contractTemplateChapter.delete({ where: { id } });
  revalidatePath(`/contracts/templates/${c.templateId}`);
  return { ok: true };
}

export async function reorderTemplateChapters(
  templateId: string,
  orderedIds: string[]
) {
  await requirePermission("contracts.manage");
  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.contractTemplateChapter.update({
        where: { id },
        data: { sortOrder: idx }
      })
    )
  );
  revalidatePath(`/contracts/templates/${templateId}`);
  return { ok: true };
}

// ═════════════ GÉNÉRATION DE CONTRATS ═════════════

const GenerateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().optional().nullable().transform((v) => v?.trim() || null),
  userId: z.string().optional().nullable().transform((v) => v?.trim() || null),
  candidateId: z.string().optional().nullable().transform((v) => v?.trim() || null),
  startDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  endDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  // Overrides : le user peut préciser un salaire spécifique, une date de début, etc.
  extraVarsJson: z.string().optional().nullable()
});

async function nextContractReference(): Promise<string> {
  // Format : CTR-YYYY-XXXX (compteur annuel).
  const year = new Date().getUTCFullYear();
  const count = await prisma.contract.count({
    where: { reference: { startsWith: `CTR-${year}-` } }
  });
  return `CTR-${year}-${String(count + 1).padStart(4, "0")}`;
}

/**
 * Génère un contrat en DRAFT à partir d'un template appliqué à un User
 * OU un Candidate. Les chapitres sont snapshotés avec variables résolues.
 */
export async function generateContractFromTemplate(formData: FormData) {
  const session = await requirePermission("contracts.manage");
  const data = GenerateSchema.parse(Object.fromEntries(formData));
  if (!data.userId && !data.candidateId) {
    throw new Error("Il faut lier le contrat à un consultant OU un candidat.");
  }
  if (data.userId && data.candidateId) {
    throw new Error("Un contrat ne peut être lié qu'à UN sujet (consultant OU candidat).");
  }

  const template = await prisma.contractTemplate.findUniqueOrThrow({
    where: { id: data.templateId },
    include: { chapters: { orderBy: { sortOrder: "asc" } } }
  });

  // Charge le sujet avec la relation payrollEmployee (pour {{monthlyNetPay}}).
  const subject = data.userId
    ? {
        kind: "user" as const,
        user: await prisma.user.findUniqueOrThrow({
          where: { id: data.userId },
          include: { payrollEmployee: true }
        })
      }
    : {
        kind: "candidate" as const,
        candidate: await prisma.candidate.findUniqueOrThrow({
          where: { id: data.candidateId! },
          // Un Candidate peut aussi avoir une PayrollEmployee liée
          // (freelance ou candidat pré-configuré pour la paie).
          include: { payrollEmployee: true }
        })
      };

  // Parse extras (optionnel : JSON {"startDate": "…", "salary": 3200, …})
  let extra: Record<string, any> = {};
  if (data.extraVarsJson) {
    try {
      extra = JSON.parse(data.extraVarsJson);
    } catch {
      throw new Error("extraVarsJson invalide (JSON malformé).");
    }
  }
  // Injection auto de startDate/endDate si fournis par le form.
  if (data.startDate) extra.startDate = data.startDate;
  if (data.endDate) extra.endDate = data.endDate;

  const vars = resolveSubjectVariables(subject, extra);
  const chapters = snapshotChapters(template.chapters, vars);

  const subjectName = subject.kind === "user"
    ? `${subject.user.firstName} ${subject.user.lastName}`
    : `${subject.candidate.firstName} ${subject.candidate.lastName}`;
  const title = data.title || `${template.name} — ${subjectName}`;
  const reference = await nextContractReference();

  const created = await prisma.contract.create({
    data: {
      reference,
      title,
      status: "DRAFT",
      templateId: template.id,
      templateName: template.name,
      userId: data.userId,
      candidateId: data.candidateId,
      chapters: chapters as any,
      startDate: data.startDate,
      endDate: data.endDate,
      generatedById: session.user.id
    }
  });
  await logActivity({
    actorId: session.user.id, action: "CREATE",
    entityType: "Contract", entityId: created.id,
    message: `Contrat ${reference} généré (${template.name}) pour ${subjectName}`
  });
  revalidatePath("/contracts");
  if (data.userId) revalidatePath(`/users/${data.userId}`);
  if (data.candidateId) revalidatePath(`/candidates/${data.candidateId}`);
  return { ok: true, id: created.id, reference };
}

// ═════════════ CONTRAT (post-génération) ═════════════

const ContractMetaSchema = z.object({
  title: z.string().min(1).max(200).transform((v) => v.trim()),
  status: z.enum(["DRAFT", "ACTIVE", "TERMINATED", "CANCELLED"]),
  startDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  endDate: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  signedAt: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  terminatedAt: z.string().optional().nullable().transform((v) => v ? new Date(v) : null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

export async function updateContractMeta(id: string, formData: FormData) {
  const session = await requirePermission("contracts.manage");
  const data = ContractMetaSchema.parse(Object.fromEntries(formData));
  const updated = await prisma.contract.update({ where: { id }, data });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "Contract", entityId: id,
    message: `Contrat ${updated.reference} : ${data.status}`
  });
  revalidatePath("/contracts");
  revalidatePath(`/contracts/${id}`);
  return { ok: true };
}

/**
 * Met à jour la liste des chapitres snapshotés d'un contrat.
 * Le user peut éditer le titre/corps de chaque chapitre après génération —
 * utile pour les ajustements de dernière minute avant signature.
 */
export async function updateContractChapters(
  id: string,
  chapters: ContractChapterSnapshot[]
) {
  const session = await requirePermission("contracts.manage");
  const clean = chapters
    .filter((c) => c && typeof c.title === "string")
    .map((c, i) => ({
      title: String(c.title).slice(0, 500),
      bodyMd: String(c.bodyMd ?? ""),
      sortOrder: i
    }));
  const updated = await prisma.contract.update({
    where: { id },
    data: { chapters: clean as any }
  });
  await logActivity({
    actorId: session.user.id, action: "UPDATE",
    entityType: "Contract", entityId: id,
    message: `Chapitres du contrat ${updated.reference} mis à jour (${clean.length} chapitres)`
  });
  revalidatePath(`/contracts/${id}`);
  return { ok: true };
}

export async function deleteContract(id: string) {
  const session = await requirePermission("contracts.manage");
  const before = await prisma.contract.findUniqueOrThrow({ where: { id } });
  await prisma.contract.delete({ where: { id } });
  await logActivity({
    actorId: session.user.id, action: "DELETE",
    entityType: "Contract", entityId: id,
    message: `Contrat ${before.reference} supprimé`
  });
  revalidatePath("/contracts");
  if (before.userId) revalidatePath(`/users/${before.userId}`);
  if (before.candidateId) revalidatePath(`/candidates/${before.candidateId}`);
  return { ok: true };
}
