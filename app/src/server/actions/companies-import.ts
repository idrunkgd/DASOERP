"use server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";
import { parseCSV } from "@/lib/csv-parse";
import { revalidatePath } from "next/cache";

const RowSchema = z.object({
  name: z.string().min(1),
  vatNumber: z.string().optional().transform(v => v?.trim() || undefined),
  status: z.string().optional().transform(v => {
    const s = (v ?? "").toUpperCase().trim();
    return ["PROSPECT","CLIENT","PARTNER","SUPPLIER"].includes(s) ? (s as any) : "PROSPECT";
  }),
  sector: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  source: z.string().optional(),
  street: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().default("Belgique"),
  notes: z.string().optional()
});

export type ImportReport = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string; data: any }[];
};

export async function importCompaniesCsv(csvText: string): Promise<ImportReport> {
  const session = await requirePermission("companies.write");
  const { rows } = parseCSV(csvText);
  const report: ImportReport = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Tolère différentes clés courantes
    const norm = {
      name: r.name ?? r.nom ?? r.Name ?? r["Nom"],
      vatNumber: r.vatNumber ?? r.tva ?? r.bce ?? r.VAT ?? r["N° TVA"],
      status: r.status ?? r.statut ?? r.Statut,
      sector: r.sector ?? r.secteur ?? r.Secteur,
      size: r.size ?? r.taille ?? r.Taille,
      website: r.website ?? r.site ?? r["Site web"],
      source: r.source ?? r.Source,
      street: r.street ?? r.adresse ?? r.Adresse,
      postalCode: r.postalCode ?? r.cp ?? r["Code postal"],
      city: r.city ?? r.ville ?? r.Ville,
      country: r.country ?? r.pays ?? r.Pays,
      notes: r.notes ?? r.Notes
    };
    const parsed = RowSchema.safeParse(norm);
    if (!parsed.success) {
      report.errors.push({ row: i + 2, reason: parsed.error.issues.map(x => x.message).join("; "), data: norm });
      continue;
    }
    const data = parsed.data as any;
    try {
      // Match sur vatNumber si présent, sinon sur name (case-insensitive)
      const existing = data.vatNumber
        ? await prisma.company.findUnique({ where: { vatNumber: data.vatNumber } })
        : await prisma.company.findFirst({ where: { name: { equals: data.name, mode: "insensitive" } } });
      if (existing) {
        await prisma.company.update({ where: { id: existing.id }, data });
        report.updated++;
      } else {
        await prisma.company.create({ data: { ...data, ownerId: session.user.id } });
        report.created++;
      }
    } catch (e: any) {
      report.errors.push({ row: i + 2, reason: e.message ?? "DB error", data });
    }
  }

  await logActivity({
    actorId: session.user.id, action: "CSV_IMPORT", entityType: "Company",
    message: `Import CSV : ${report.created} créées, ${report.updated} mises à jour, ${report.errors.length} erreurs`,
    diff: { report } as any
  });
  revalidatePath("/companies");
  return report;
}
