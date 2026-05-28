"use server";
// Server actions pour le module Onboarding.
//
// Logique : à la création d'un nouvel user (ou manuellement depuis sa fiche),
// on instancie une checklist depuis le template matchant son rôle (sinon le
// template générique). Les items du template sont copiés en items concrets
// avec leurs dates calculées (startDate + daysOffset) et leur owner par
// défaut (premier user du defaultOwnerRole trouvé).
//
// On crée aussi N entretiens ConsultantReview avec kind ONBOARDING/CHECK_IN
// aux décalages configurés (par défaut J+1, J+30, J+90, J+180).
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

// ─── Création d'un onboarding pour un user ────────────────────────────────

/**
 * Crée un onboarding (instance + items + reviews) pour un user donné, en
 * utilisant le template matchant son rôle. Idempotent : si un onboarding
 * existe déjà pour ce user, on ne le recrée pas.
 */
export async function createOnboardingForUser(
  userId: string,
  startDateIso: string,
  opts?: { templateId?: string }
) {
  const session = await requireSession();

  // Idempotence
  const existing = await prisma.onboarding.findUnique({ where: { userId } });
  if (existing) return existing;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, firstName: true, lastName: true }
  });

  // Trouve le template approprié : préférence pour celui matchant le rôle,
  // sinon le générique (role NULL), sinon le premier actif.
  let template = null;
  if (opts?.templateId) {
    template = await prisma.onboardingTemplate.findUnique({
      where: { id: opts.templateId },
      include: { items: { orderBy: { position: "asc" } } }
    });
  } else {
    template =
      (await prisma.onboardingTemplate.findFirst({
        where: { role: user.role, active: true },
        include: { items: { orderBy: { position: "asc" } } }
      })) ??
      (await prisma.onboardingTemplate.findFirst({
        where: { role: null, active: true },
        include: { items: { orderBy: { position: "asc" } } }
      }));
  }

  const startDate = new Date(startDateIso);

  // Crée l'instance + items en une seule transaction
  const onboarding = await prisma.$transaction(async (tx) => {
    const ob = await tx.onboarding.create({
      data: {
        userId,
        templateId: template?.id ?? null,
        startDate,
        status: "IN_PROGRESS",
        createdById: session.user.id
      }
    });

    if (template?.items.length) {
      // Pour chaque item du template, on essaie de résoudre un owner par
      // défaut depuis defaultOwnerRole (premier user actif avec ce rôle).
      for (const it of template.items) {
        let ownerId: string | null = null;
        if (it.defaultOwnerRole) {
          const owner = await tx.user.findFirst({
            where: { role: it.defaultOwnerRole, active: true },
            select: { id: true }
          });
          ownerId = owner?.id ?? null;
        }
        const due = addDays(startDate, it.daysOffset);
        await tx.onboardingItem.create({
          data: {
            onboardingId: ob.id,
            category: it.category,
            title: it.title,
            description: it.description,
            position: it.position,
            ownerId,
            dueDate: due
          }
        });
      }
    }

    return ob;
  });

  // Création des entretiens planifiés (kind ONBOARDING pour le premier offset,
  // CHECK_IN pour les suivants).
  const offsets = template?.reviewOffsets ?? [1, 30, 90, 180];
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i];
    await prisma.consultantReview.create({
      data: {
        subjectId: userId,
        scheduledAt: addDays(startDate, offset),
        kind: i === 0 ? "ONBOARDING" : "CHECK_IN",
        outcome: "SCHEDULED"
      }
    });
  }

  await logActivity({
    actorId: session.user.id,
    action: "CREATE",
    entityType: "Onboarding",
    entityId: onboarding.id,
    message: `Onboarding lancé pour ${user.firstName} ${user.lastName} (${offsets.length} entretiens planifiés)`,
    after: onboarding
  });

  revalidatePath("/onboarding");
  revalidatePath(`/users/${userId}`);
  return onboarding;
}

// ─── Toggle / update d'un item ─────────────────────────────────────────────

export async function toggleOnboardingItem(itemId: string, done: boolean) {
  const session = await requireSession();
  const item = await prisma.onboardingItem.findUniqueOrThrow({
    where: { id: itemId }
  });
  const updated = await prisma.onboardingItem.update({
    where: { id: itemId },
    data: {
      done,
      doneAt: done ? new Date() : null,
      doneById: done ? session.user.id : null
    }
  });

  // Si tous les items sont done, on marque l'onboarding comme DONE.
  const remaining = await prisma.onboardingItem.count({
    where: { onboardingId: item.onboardingId, done: false }
  });
  if (remaining === 0) {
    await prisma.onboarding.update({
      where: { id: item.onboardingId },
      data: { status: "DONE" }
    });
  } else {
    // Si quelqu'un re-coche un item d'un onboarding "DONE", on rebascule
    // en IN_PROGRESS.
    await prisma.onboarding.updateMany({
      where: { id: item.onboardingId, status: "DONE" },
      data: { status: "IN_PROGRESS" }
    });
  }

  revalidatePath("/onboarding");
  return updated;
}

// ─── CRUD items (ajout libre / suppression) ───────────────────────────────

const NewItemSchema = z.object({
  category: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable()
});

export async function addOnboardingItem(
  onboardingId: string,
  formData: FormData
) {
  await requireSession();
  const raw = Object.fromEntries(formData);
  const data = NewItemSchema.parse({
    category: raw.category,
    title: raw.title,
    description: raw.description || null,
    dueDate: raw.dueDate || null,
    ownerId: raw.ownerId || null
  });
  const maxPos = await prisma.onboardingItem.findFirst({
    where: { onboardingId },
    orderBy: { position: "desc" },
    select: { position: true }
  });
  await prisma.onboardingItem.create({
    data: {
      onboardingId,
      category: data.category,
      title: data.title,
      description: data.description,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      ownerId: data.ownerId,
      position: (maxPos?.position ?? 0) + 10
    }
  });
  revalidatePath("/onboarding");
}

export async function deleteOnboardingItem(itemId: string) {
  await requireSession();
  await prisma.onboardingItem.delete({ where: { id: itemId } });
  revalidatePath("/onboarding");
}

// ─── Archivage de l'onboarding ─────────────────────────────────────────────

export async function archiveOnboarding(onboardingId: string) {
  const session = await requireSession();
  const updated = await prisma.onboarding.update({
    where: { id: onboardingId },
    data: { status: "ARCHIVED" }
  });
  await logActivity({
    actorId: session.user.id,
    action: "UPDATE",
    entityType: "Onboarding",
    entityId: onboardingId,
    message: "Onboarding archivé"
  });
  revalidatePath("/onboarding");
  return updated;
}

// ─── Templates (CRUD léger) ────────────────────────────────────────────────

const TemplateSchema = z.object({
  name: z.string().min(1).max(60),
  role: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  active: z.coerce.boolean().default(true),
  reviewOffsets: z.string().optional() // CSV "1,30,90,180"
});

export async function createOnboardingTemplate(formData: FormData) {
  await requireSession();
  const raw = Object.fromEntries(formData);
  const data = TemplateSchema.parse({
    name: raw.name,
    role: raw.role || null,
    description: raw.description || null,
    active: raw.active ?? "true",
    reviewOffsets: raw.reviewOffsets
  });
  const offsets = parseOffsets(data.reviewOffsets);
  await prisma.onboardingTemplate.create({
    data: {
      name: data.name,
      role: (data.role as Role) || null,
      description: data.description,
      active: data.active,
      reviewOffsets: offsets
    }
  });
  revalidatePath("/settings/onboarding-templates");
}

export async function updateOnboardingTemplate(id: string, formData: FormData) {
  await requireSession();
  const raw = Object.fromEntries(formData);
  const data = TemplateSchema.parse({
    name: raw.name,
    role: raw.role || null,
    description: raw.description || null,
    active: raw.active ?? "true",
    reviewOffsets: raw.reviewOffsets
  });
  const offsets = parseOffsets(data.reviewOffsets);
  await prisma.onboardingTemplate.update({
    where: { id },
    data: {
      name: data.name,
      role: (data.role as Role) || null,
      description: data.description,
      active: data.active,
      reviewOffsets: offsets
    }
  });
  revalidatePath("/settings/onboarding-templates");
}

export async function deleteOnboardingTemplate(id: string) {
  await requireSession();
  await prisma.onboardingTemplate.delete({ where: { id } });
  revalidatePath("/settings/onboarding-templates");
}

// Item de template
const TemplateItemSchema = z.object({
  category: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  description: z.string().optional().nullable(),
  defaultOwnerRole: z.string().optional().nullable(),
  daysOffset: z.coerce.number().int().default(0)
});

export async function addTemplateItem(templateId: string, formData: FormData) {
  await requireSession();
  const raw = Object.fromEntries(formData);
  const data = TemplateItemSchema.parse({
    category: raw.category,
    title: raw.title,
    description: raw.description || null,
    defaultOwnerRole: raw.defaultOwnerRole || null,
    daysOffset: raw.daysOffset ?? 0
  });
  const maxPos = await prisma.onboardingTemplateItem.findFirst({
    where: { templateId },
    orderBy: { position: "desc" },
    select: { position: true }
  });
  await prisma.onboardingTemplateItem.create({
    data: {
      templateId,
      category: data.category,
      title: data.title,
      description: data.description,
      defaultOwnerRole: (data.defaultOwnerRole as Role) || null,
      daysOffset: data.daysOffset,
      position: (maxPos?.position ?? 0) + 10
    }
  });
  revalidatePath("/settings/onboarding-templates");
}

export async function deleteTemplateItem(itemId: string) {
  await requireSession();
  await prisma.onboardingTemplateItem.delete({ where: { id: itemId } });
  revalidatePath("/settings/onboarding-templates");
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + days);
  return x;
}

function parseOffsets(csv?: string): number[] {
  if (!csv) return [1, 30, 90, 180];
  const arr = csv
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0);
  return arr.length > 0 ? arr : [1, 30, 90, 180];
}
