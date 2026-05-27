// Helper pour récupérer/sauvegarder les infos légales Dasolabs.
// Stocké dans la table Setting (key="company_info") en JSON.

import { prisma } from "@/lib/db";

export interface CompanyInfo {
  legalName: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatNumber: string;
  bceNumber: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  website: string;
  /// Mentions légales personnalisées (override les valeurs par défaut)
  legalNotice?: string;
  /// Délai de paiement en jours (défaut 30)
  paymentTermsDays?: number;
  /// Durée de validité d'un devis en jours (défaut 30)
  offerValidityDays?: number;
}

export const DEFAULT_COMPANY_INFO: CompanyInfo = {
  legalName: "DASOLABS SRL",
  street: "Adresse à compléter",
  postalCode: "1000",
  city: "Bruxelles",
  country: "Belgique",
  vatNumber: "BE0000.000.000",
  bceNumber: "0000.000.000",
  email: "contact@dasolabs.com",
  phone: "",
  iban: "BE00 0000 0000 0000",
  bic: "",
  website: "www.dasolabs.com",
  legalNotice: "",
  paymentTermsDays: 30,
  offerValidityDays: 30
};

const SETTING_KEY = "company_info";

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return DEFAULT_COMPANY_INFO;
  // Merge avec les defaults pour rester compatible si on ajoute des champs
  return { ...DEFAULT_COMPANY_INFO, ...(row.value as Partial<CompanyInfo>) };
}

export async function saveCompanyInfo(info: CompanyInfo): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: info as any },
    create: { key: SETTING_KEY, value: info as any }
  });
}
