"use server";
/**
 * Gestion des rattachements d'un Contact à plusieurs Company.
 *
 * Un même Contact peut être rattaché à plusieurs sociétés (ex. Jean Dupont
 * consultant chez A + administrateur chez B) via la table ContactCompany.
 *
 * Invariants maintenus par ces actions :
 *   - Un seul lien marqué isPrimary=true par contact.
 *   - Le Contact.companyId "historique" est TOUJOURS synchronisé avec le
 *     lien isPrimary=true. C'est le champ que continuent d'utiliser
 *     l'ancien code (offres, projets, listes de contacts, PDF...).
 *   - Si on unlink la société principale, on promeut automatiquement une
 *     autre société en principale (ou on met companyId à NULL).
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

const LinkSchema = z.object({
  contactId: z.string().min(1),
  companyId: z.string().min(1),
  jobTitle: z.string().optional().nullable().transform((v) => v?.trim() || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null),
  makePrimary: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true")
});

/**
 * Ajoute un lien Contact ↔ Company. Idempotent : si le lien existe déjà,
 * on met à jour jobTitle / notes / isPrimary au lieu de dupliquer.
 */
export async function linkContactToCompany(formData: FormData) {
  await requirePermission("contacts.write");
  const data = LinkSchema.parse(Object.fromEntries(formData));

  // Sécurité : les deux entités doivent exister
  const [contact, company] = await Promise.all([
    prisma.contact.findUnique({ where: { id: data.contactId }, select: { id: true, companyId: true } }),
    prisma.company.findUnique({ where: { id: data.companyId }, select: { id: true } })
  ]);
  if (!contact) throw new Error("Contact introuvable");
  if (!company) throw new Error("Société introuvable");

  // Si makePrimary=true, il n'y a qu'un seul lien isPrimary par contact :
  // on démote tous les autres liens du même contact.
  await prisma.$transaction(async (tx) => {
    if (data.makePrimary) {
      await tx.contactCompany.updateMany({
        where: { contactId: data.contactId, isPrimary: true },
        data: { isPrimary: false }
      });
    }
    await tx.contactCompany.upsert({
      where: { contactId_companyId: { contactId: data.contactId, companyId: data.companyId } },
      create: {
        contactId: data.contactId,
        companyId: data.companyId,
        jobTitle: data.jobTitle,
        notes: data.notes,
        isPrimary: data.makePrimary
      },
      update: {
        jobTitle: data.jobTitle,
        notes: data.notes,
        // Ne jamais rétrograder isPrimary depuis un upsert non explicite
        ...(data.makePrimary ? { isPrimary: true } : {})
      }
    });
    // Synchroniser Contact.companyId avec le lien principal (rétro-compat)
    if (data.makePrimary) {
      await tx.contact.update({
        where: { id: data.contactId },
        data: { companyId: data.companyId }
      });
    }
  });

  revalidatePath(`/contacts/${data.contactId}`);
  revalidatePath(`/companies/${data.companyId}`);
  return { ok: true };
}

/**
 * Retire le lien Contact ↔ Company. Si c'était le lien principal, on en
 * promeut un autre (le plus ancien) ou on met Contact.companyId à NULL.
 */
export async function unlinkContactFromCompany(contactId: string, companyId: string) {
  await requirePermission("contacts.write");
  await prisma.$transaction(async (tx) => {
    const link = await tx.contactCompany.findUnique({
      where: { contactId_companyId: { contactId, companyId } },
      select: { isPrimary: true }
    });
    if (!link) return; // rien à faire
    await tx.contactCompany.delete({
      where: { contactId_companyId: { contactId, companyId } }
    });
    if (link.isPrimary) {
      // Promouvoir le plus ancien restant en principal
      const nextPrimary = await tx.contactCompany.findFirst({
        where: { contactId },
        orderBy: { createdAt: "asc" },
        select: { id: true, companyId: true }
      });
      if (nextPrimary) {
        await tx.contactCompany.update({
          where: { id: nextPrimary.id }, data: { isPrimary: true }
        });
        await tx.contact.update({
          where: { id: contactId }, data: { companyId: nextPrimary.companyId }
        });
      } else {
        // Plus aucune société : on détache aussi le contact
        await tx.contact.update({ where: { id: contactId }, data: { companyId: null } });
      }
    }
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}

/**
 * Change la société principale d'un contact. Le lien doit déjà exister
 * (on ne crée pas un rattachement en même temps qu'on le promeut).
 */
export async function setPrimaryContactCompany(contactId: string, companyId: string) {
  await requirePermission("contacts.write");
  const link = await prisma.contactCompany.findUnique({
    where: { contactId_companyId: { contactId, companyId } }
  });
  if (!link) throw new Error("Lien introuvable — ajoute d'abord la société");
  await prisma.$transaction(async (tx) => {
    await tx.contactCompany.updateMany({
      where: { contactId, isPrimary: true },
      data: { isPrimary: false }
    });
    await tx.contactCompany.update({
      where: { contactId_companyId: { contactId, companyId } },
      data: { isPrimary: true }
    });
    await tx.contact.update({
      where: { id: contactId }, data: { companyId }
    });
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}

const UpdateLinkSchema = z.object({
  jobTitle: z.string().optional().nullable().transform((v) => v?.trim() || null),
  notes: z.string().optional().nullable().transform((v) => v?.trim() || null)
});

/**
 * Modifie le rôle / notes sur un lien Contact ↔ Company sans toucher
 * à isPrimary (celui-ci est piloté par setPrimaryContactCompany).
 */
export async function updateContactCompanyLink(
  contactId: string, companyId: string, formData: FormData
) {
  await requirePermission("contacts.write");
  const data = UpdateLinkSchema.parse(Object.fromEntries(formData));
  await prisma.contactCompany.update({
    where: { contactId_companyId: { contactId, companyId } },
    data
  });
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/companies/${companyId}`);
  return { ok: true };
}
