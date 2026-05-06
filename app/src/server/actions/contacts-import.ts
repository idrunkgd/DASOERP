"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { parseCSV } from "@/lib/csv-parse";
import { revalidatePath } from "next/cache";

const RowSchema = z.object({
  firstName: z.string().min(1, "Prénom requis"),
  lastName: z.string().min(1, "Nom requis"),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)).transform(v => v || undefined),
  phone: z.string().optional().transform(v => v?.trim() || undefined),
  jobTitle: z.string().optional().transform(v => v?.trim() || undefined),
  status: z.string().optional().transform(v => {
    const s = (v ?? "").toUpperCase().trim();
    return ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(s) ? (s as any) : "ACTIVE";
  }),
  companyName: z.string().optional().transform(v => v?.trim() || undefined),
  tags: z.string().optional().transform(v =>
    v?.split(/[,;]/).map(s => s.trim()).filter(Boolean) ?? []
  ),
  notes: z.string().optional()
});

export type ContactImportReport = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data: any }[];
};

/** Normalise une clé : minuscules, sans accents, sans espaces/underscores/tirets/points. */
function normKey(k: string): string {
  return k
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // retire accents
    .replace(/[\s_\-\.]+/g, "");                       // retire espaces, _, -, .
}

/** Cherche dans un row la première valeur dont la clé normalisée matche un alias. */
function pick(row: Record<string, any>, aliases: string[]): string | undefined {
  const normalized: Record<string, any> = {};
  for (const k of Object.keys(row)) normalized[normKey(k)] = row[k];
  for (const a of aliases) {
    const v = normalized[normKey(a)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

/** Nettoie un email "wrappé" markdown : [x@y.com](mailto:x@y.com) → x@y.com */
function cleanEmail(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const m = s.match(/^\[([^\]]+)\]\(mailto:[^)]+\)$/);
  if (m) return m[1].trim();
  return s.replace(/^mailto:/i, "").trim();
}

export async function importContactsCsv(csvText: string): Promise<ContactImportReport> {
  const session = await requirePermission("contacts.write");
  const { rows } = parseCSV(csvText);
  const report: ContactImportReport = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // Récupère firstName/lastName via aliases ; sinon découpe fullName
    let firstName = pick(r, ["firstName", "first_name", "first name", "prenom", "prénom", "given name", "givenname"]);
    let lastName = pick(r, ["lastName", "last_name", "last name", "nom", "surname", "family name", "familyname"]);
    if (!firstName || !lastName) {
      const full = pick(r, ["fullName", "full name", "name", "nom complet", "nomcomplet", "displayname", "display name"]);
      if (full) {
        const parts = full.split(/\s+/);
        if (!firstName) firstName = parts[0];
        if (!lastName && parts.length > 1) lastName = parts.slice(1).join(" ");
      }
    }

    const norm = {
      firstName,
      lastName,
      email: cleanEmail(pick(r, ["email", "mail", "e-mail", "courriel", "adresseemail", "emailaddress"])),
      phone: pick(r, ["phone", "tel", "telephone", "téléphone", "mobile", "gsm", "phonenumber", "tél", "tel."]),
      jobTitle: pick(r, ["jobTitle", "job title", "fonction", "poste", "titre", "title", "position", "role"]),
      status: pick(r, ["status", "statut", "état", "etat"]),
      companyName: pick(r, ["companyName", "company", "entreprise", "société", "societe", "organization", "organisation", "employer", "employeur"]),
      tags: pick(r, ["tags", "etiquettes", "étiquettes", "labels", "categories", "catégories"]),
      notes: pick(r, ["notes", "note", "remarques", "remarque", "comments", "commentaires", "description"])
    };

    const parsed = RowSchema.safeParse(norm);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(x => {
        const p = x.path.join(".");
        return `${p || "?"}: ${x.message}`;
      }).join("; ");
      report.errors.push({ row: i + 2, reason: issues, data: norm });
      continue;
    }
    const { companyName, ...data } = parsed.data;

    try {
      // Cherche/crée la company si un nom est fourni
      let companyId: string | null = null;
      if (companyName) {
        const existingCompany = await prisma.company.findFirst({
          where: { name: { equals: companyName, mode: "insensitive" } }
        });
        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const created = await prisma.company.create({
            data: { name: companyName, status: "PROSPECT", country: "Belgique", ownerId: session.user.id }
          });
          companyId = created.id;
        }
      }

      // Match : email (si présent) sinon (firstName + lastName + companyId)
      let existing = null;
      if (data.email) {
        existing = await prisma.contact.findFirst({
          where: { email: { equals: data.email, mode: "insensitive" } }
        });
      }
      if (!existing) {
        existing = await prisma.contact.findFirst({
          where: {
            firstName: { equals: data.firstName, mode: "insensitive" },
            lastName: { equals: data.lastName, mode: "insensitive" },
            companyId: companyId ?? undefined
          }
        });
      }

      const payload: any = { ...data, companyId };
      if (existing) {
        await prisma.contact.update({ where: { id: existing.id }, data: payload });
        report.updated++;
      } else {
        await prisma.contact.create({ data: { ...payload, ownerId: session.user.id } });
        report.created++;
      }
    } catch (e: any) {
      report.errors.push({ row: i + 2, reason: e.message ?? "DB error", data: parsed.data });
    }
  }

  await logActivity({
    actorId: session.user.id, action: "CSV_IMPORT", entityType: "Contact",
    message: `Import CSV : ${report.created} créés, ${report.updated} mis à jour, ${report.errors.length} erreurs`,
    diff: { report } as any
  });
  revalidatePath("/contacts");
  return report;
}
