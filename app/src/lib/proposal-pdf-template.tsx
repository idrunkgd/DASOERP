/**
 * Template PDF « Proposition consultant » (offre commerciale à envoyer
 * au client) aux couleurs Dasolabs.
 *
 * Structure :
 *   PAGE 1 — Contexte & prix
 *     • Header charte Dasolabs (logo + adresse + n° TVA)
 *     • Titre : PROPOSITION CONSULTANT + référence PROP-YYYY-NNNN
 *     • Cartouches : destinataire client, interlocuteur Dasolabs
 *     • Intro (message d'accompagnement optionnel)
 *     • Description mission
 *     • Consultant proposé (résumé — détail complet page 2)
 *     • Bloc conditions financières (dates, régime, jours, TJM, TOTAL HT)
 *     • Mentions légales / facturation / validité
 *     • Footer
 *   PAGE 2 — Profil consultant
 *     • Bandeau photo + nom + séniorité + coordonnées
 *     • Langues, compétences (pills)
 *     • Expériences pro
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { CompanyInfo } from "./company-info";
import { DEFAULT_COMPANY_INFO } from "./company-info";
import { BRAND_COLORS as C, DasolabsIcon } from "./dasolabs-brand";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36, paddingBottom: 50, paddingHorizontal: 36,
    fontSize: 10, fontFamily: "Helvetica", color: C.ink
  },

  // Header charte
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 12, borderBottom: `2 solid ${C.ink}`, marginBottom: 20
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink },
  brandTagline: { fontSize: 7, color: C.grey, marginTop: 1 },
  brandLegal: { fontSize: 7, color: C.grey, marginTop: 4, lineHeight: 1.3 },
  docHeader: { textAlign: "right" },
  docTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.accent },
  docRef: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 4 },
  docDate: { fontSize: 8, color: C.grey, marginTop: 2 },

  // Cartouches destinataire / interlocuteur
  boxRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  box: {
    width: "48%", padding: 10, borderRadius: 4,
    backgroundColor: C.light, borderLeft: `3 solid ${C.accent}`
  },
  boxTitle: {
    fontSize: 7, color: C.grey, marginBottom: 5,
    textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold"
  },
  boxName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink },
  boxLine: { fontSize: 9, color: C.ink, marginTop: 2 },
  boxSmall: { fontSize: 8, color: C.grey, marginTop: 1 },

  // Intro / sections
  intro: {
    padding: 10, backgroundColor: C.light, borderRadius: 4,
    fontSize: 10, lineHeight: 1.5, marginBottom: 12,
    fontStyle: "italic", color: C.ink
  },
  h2: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink,
    marginTop: 4, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5
  },
  h2Line: { borderBottom: `1 solid ${C.border}`, marginBottom: 8, paddingBottom: 2 },
  para: { fontSize: 10, lineHeight: 1.4, marginBottom: 8, color: C.ink },

  // Bloc conditions financières
  condCard: {
    border: `1 solid ${C.ink}`, borderRadius: 4, marginTop: 4, overflow: "hidden"
  },
  condRow: {
    flexDirection: "row", justifyContent: "space-between",
    padding: 9, borderBottom: `0.5pt solid ${C.border}`
  },
  condLabel: { fontSize: 10, color: C.grey },
  condValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink },
  condTotal: {
    flexDirection: "row", justifyContent: "space-between",
    padding: 12, backgroundColor: C.ink
  },
  condTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FFF" },
  condTotalValue: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.accent },

  // Mentions bas de page 1
  legalHint: {
    marginTop: 14, padding: 8, backgroundColor: C.light, borderRadius: 3,
    fontSize: 8, color: C.grey, lineHeight: 1.4
  },

  // Page 2 — profil consultant
  profileHeader: {
    flexDirection: "row", gap: 16, marginBottom: 14, alignItems: "center"
  },
  photo: { width: 82, height: 82, borderRadius: 41 },
  photoPlaceholder: {
    width: 82, height: 82, borderRadius: 41, backgroundColor: C.ink,
    justifyContent: "center", alignItems: "center"
  },
  photoInitials: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#FFF" },
  profileName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.ink },
  profileRole: { fontSize: 11, color: C.accent, marginTop: 2, fontFamily: "Helvetica-Bold" },
  profileMeta: { fontSize: 9, color: C.grey, marginTop: 4 },

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpi: {
    flex: 1, backgroundColor: C.light, padding: 8, borderRadius: 4,
    borderLeft: `3 solid ${C.accent}`
  },
  kpiLabel: { fontSize: 7, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  skill: {
    fontSize: 9, padding: "3pt 8pt", backgroundColor: C.light,
    borderRadius: 10, color: C.ink
  },
  language: {
    fontSize: 9, padding: "3pt 8pt", border: `0.5pt solid ${C.accent}`,
    borderRadius: 10, color: C.accent
  },

  expItem: {
    paddingLeft: 12, borderLeft: `2 solid ${C.accent}`,
    marginBottom: 9, paddingVertical: 2
  },
  expTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.ink },
  expCompany: { fontSize: 10, color: C.accent, marginTop: 1 },
  expDates: { fontSize: 8, color: C.grey, marginTop: 1 },
  expDesc: { fontSize: 9, color: C.ink, marginTop: 3, lineHeight: 1.35 },

  footer: {
    position: "absolute", bottom: 24, left: 36, right: 36,
    fontSize: 7, color: C.grey, textAlign: "center",
    borderTop: `0.5pt solid ${C.border}`, paddingTop: 6
  }
});

export type ProposalPdfData = {
  reference: string;
  intro: string | null;
  missionTitle: string;
  missionDescription: string | null;
  clientCompany: { name: string; vatNumber: string | null; addressLine: string | null };
  clientContact: {
    firstName: string; lastName: string; jobTitle: string | null;
    email: string | null; phone: string | null;
  } | null;
  startDate: Date;
  endDate: Date;
  workDaysPerWeek: number;
  includeHolidays: boolean;
  computedDays: number;
  dailyRate: number;
  computedBudgetHt: number;
  candidate: {
    firstName: string; lastName: string;
    photoUrl: string | null;
    seniority: string | null;
    yearsExperience: number | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    skills: string[];
    spokenLanguages: string[];
    experiences: Array<{
      companyName: string;
      jobTitle: string | null;
      startDate: Date;
      endDate: Date | null;
      description: string | null;
    }>;
  };
  owner: { firstName: string; lastName: string; email: string | null; phone: string | null } | null;
};

function fmtEUR(n: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(n);
}
function fmtDate(d: Date | null) {
  if (!d) return "en cours";
  return new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}
function fmtMonthYear(d: Date | null) {
  if (!d) return "aujourd'hui";
  return new Intl.DateTimeFormat("fr-BE", { month: "short", year: "numeric" }).format(d);
}

export function ProposalPdf({
  data, companyInfo = DEFAULT_COMPANY_INFO
}: { data: ProposalPdfData; companyInfo?: CompanyInfo }) {
  const initials = ((data.candidate.firstName[0] ?? "") + (data.candidate.lastName[0] ?? "")).toUpperCase();
  const workRegimeLabel =
    Number(data.workDaysPerWeek) === 5 ? "Temps plein (5 j/sem)" :
    Number(data.workDaysPerWeek) === 4 ? "4/5 (4 j/sem)" :
    Number(data.workDaysPerWeek) === 2.5 ? "Mi-temps (2.5 j/sem)" :
    `${data.workDaysPerWeek} j/sem`;

  return (
    <Document>
      {/* ═════════════════ PAGE 1 — CONTEXTE & PRIX ═════════════════ */}
      <Page size="A4" style={styles.page}>
        {/* Header charte */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <DasolabsIcon size={38} color={C.ink} />
            <View>
              <Text style={styles.brandName}>{companyInfo.legalName ?? "DASOLABS"}</Text>
              <Text style={styles.brandTagline}>Expert IT · Consulting</Text>
              <Text style={styles.brandLegal}>
                {companyInfo.street}, {companyInfo.postalCode} {companyInfo.city}
                {companyInfo.vatNumber ? ` · TVA ${companyInfo.vatNumber}` : ""}
              </Text>
            </View>
          </View>
          <View style={styles.docHeader}>
            <Text style={styles.docTitle}>PROPOSITION</Text>
            <Text style={styles.docRef}>{data.reference}</Text>
            <Text style={styles.docDate}>Émise le {fmtDate(new Date())}</Text>
          </View>
        </View>

        {/* Cartouches destinataire + interlocuteur */}
        <View style={styles.boxRow}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Destinataire</Text>
            <Text style={styles.boxName}>{data.clientCompany.name}</Text>
            {data.clientCompany.addressLine && <Text style={styles.boxLine}>{data.clientCompany.addressLine}</Text>}
            {data.clientCompany.vatNumber && <Text style={styles.boxSmall}>TVA {data.clientCompany.vatNumber}</Text>}
            {data.clientContact && (
              <>
                <Text style={[styles.boxLine, { marginTop: 6, fontFamily: "Helvetica-Bold" }]}>
                  À l'attention de {data.clientContact.firstName} {data.clientContact.lastName}
                </Text>
                {data.clientContact.jobTitle && <Text style={styles.boxSmall}>{data.clientContact.jobTitle}</Text>}
                {data.clientContact.email && <Text style={styles.boxSmall}>{data.clientContact.email}</Text>}
                {data.clientContact.phone && <Text style={styles.boxSmall}>{data.clientContact.phone}</Text>}
              </>
            )}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Votre interlocuteur</Text>
            {data.owner ? (
              <>
                <Text style={styles.boxName}>{data.owner.firstName} {data.owner.lastName}</Text>
                {data.owner.email && <Text style={styles.boxLine}>{data.owner.email}</Text>}
                {data.owner.phone && <Text style={styles.boxLine}>{data.owner.phone}</Text>}
              </>
            ) : (
              <Text style={styles.boxLine}>—</Text>
            )}
          </View>
        </View>

        {/* Objet */}
        <View style={styles.h2Line}>
          <Text style={styles.h2}>Objet</Text>
        </View>
        <Text style={styles.para}>
          Proposition consultant pour la mission « <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.missionTitle}</Text> ».
        </Text>

        {data.intro && <Text style={styles.intro}>{data.intro}</Text>}

        {data.missionDescription && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Contexte de la mission</Text></View>
            <Text style={styles.para}>{data.missionDescription}</Text>
          </>
        )}

        <View style={styles.h2Line}><Text style={styles.h2}>Consultant proposé</Text></View>
        <Text style={styles.para}>
          Nous vous proposons <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.candidate.firstName} {data.candidate.lastName}</Text>
          {data.candidate.seniority ? ` (${data.candidate.seniority})` : ""}
          {data.candidate.yearsExperience ? `, ${data.candidate.yearsExperience} ans d'expérience` : ""}.
          Son profil détaillé figure en page 2.
        </Text>

        <View style={styles.h2Line}><Text style={styles.h2}>Conditions financières</Text></View>
        <View style={styles.condCard}>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Période</Text>
            <Text style={styles.condValue}>Du {fmtDate(data.startDate)} au {fmtDate(data.endDate)}</Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Régime</Text>
            <Text style={styles.condValue}>{workRegimeLabel}</Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>
              Jours facturables (weekends{data.includeHolidays ? " et fériés belges" : ""} déduits)
            </Text>
            <Text style={styles.condValue}>{data.computedDays} j</Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Tarif journalier HTVA</Text>
            <Text style={styles.condValue}>{fmtEUR(data.dailyRate)}</Text>
          </View>
          <View style={styles.condTotal}>
            <Text style={styles.condTotalLabel}>Budget total HTVA</Text>
            <Text style={styles.condTotalValue}>{fmtEUR(data.computedBudgetHt)}</Text>
          </View>
        </View>

        <View style={styles.legalHint}>
          <Text>
            Facturation mensuelle en fin de mois sur base des jours prestés. TVA 21 % applicable en sus.
            Proposition valable {companyInfo.offerValidityDays ?? 30} jours à compter de la date d'émission.
          </Text>
        </View>

        <Text style={styles.footer}>
          {companyInfo.legalName ?? "DASOLABS"} · {companyInfo.street}, {companyInfo.postalCode} {companyInfo.city}
          {companyInfo.vatNumber ? ` · TVA ${companyInfo.vatNumber}` : ""}
          {companyInfo.email ? ` · ${companyInfo.email}` : ""}
        </Text>
      </Page>

      {/* ═════════════════ PAGE 2 — PROFIL CONSULTANT ═════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <DasolabsIcon size={32} color={C.ink} />
            <View>
              <Text style={[styles.brandName, { fontSize: 14 }]}>{companyInfo.legalName ?? "DASOLABS"}</Text>
              <Text style={styles.brandTagline}>Profil consultant — annexe à {data.reference}</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileHeader}>
          {data.candidate.photoUrl ? (
            <Image src={data.candidate.photoUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{data.candidate.firstName} {data.candidate.lastName}</Text>
            {data.candidate.seniority && <Text style={styles.profileRole}>{data.candidate.seniority}</Text>}
            <Text style={styles.profileMeta}>
              {[
                data.candidate.yearsExperience ? `${data.candidate.yearsExperience} ans d'expérience` : null,
                data.candidate.city ? data.candidate.city : null
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Expérience</Text>
            <Text style={styles.kpiValue}>
              {data.candidate.yearsExperience != null ? `${data.candidate.yearsExperience} ans` : "—"}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Compétences</Text>
            <Text style={styles.kpiValue}>{data.candidate.skills.length}</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Expériences</Text>
            <Text style={styles.kpiValue}>{data.candidate.experiences.length}</Text>
          </View>
        </View>

        {data.candidate.spokenLanguages.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Langues parlées</Text></View>
            <View style={styles.pills}>
              {data.candidate.spokenLanguages.map((l) => (
                <Text key={l} style={styles.language}>{l}</Text>
              ))}
            </View>
          </>
        )}

        {data.candidate.skills.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Compétences techniques</Text></View>
            <View style={styles.pills}>
              {data.candidate.skills.map((s) => (
                <Text key={s} style={styles.skill}>{s}</Text>
              ))}
            </View>
          </>
        )}

        {data.candidate.experiences.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Expériences professionnelles</Text></View>
            {data.candidate.experiences.slice(0, 6).map((exp, idx) => (
              <View key={idx} style={styles.expItem}>
                <Text style={styles.expTitle}>{exp.jobTitle ?? "—"}</Text>
                <Text style={styles.expCompany}>{exp.companyName}</Text>
                <Text style={styles.expDates}>
                  {fmtMonthYear(exp.startDate)} → {exp.endDate ? fmtMonthYear(exp.endDate) : "aujourd'hui"}
                </Text>
                {exp.description && <Text style={styles.expDesc}>{exp.description}</Text>}
              </View>
            ))}
          </>
        )}

        <Text style={styles.footer}>
          {companyInfo.legalName ?? "DASOLABS"} · {companyInfo.street}, {companyInfo.postalCode} {companyInfo.city}
          {companyInfo.vatNumber ? ` · TVA ${companyInfo.vatNumber}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
