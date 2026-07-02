/**
 * Template PDF d'une MissionProposal (proposition consultant à envoyer au client).
 *
 * Structure :
 *   Page 1 — Contexte & prix
 *     • Header Dasolabs (logo, adresse, TVA)
 *     • Destinataire (client + contact)
 *     • Titre "Proposition de consultant"
 *     • Bloc mission : titre + description
 *     • Bloc consultant proposé : nom, séniorité, rôle, résumé court
 *     • Bloc conditions : période, régime, jours calculés, TJM, TOTAL HT
 *     • Signature de l'interlocuteur Dasolabs
 *   Page 2 — Profil consultant
 *     • Photo + nom + coordonnées
 *     • Bio / séniorité / années xp / langues
 *     • Compétences
 *     • Expériences professionnelles (les 5 dernières)
 *
 * On utilise @react-pdf/renderer 3.4.5 (v4 a un bug unitsPerEm en serverless).
 */
import {
  Document, Page, Text, View, StyleSheet, Image
} from "@react-pdf/renderer";
import React from "react";
import type { CompanyInfo } from "./company-info";
import { DEFAULT_COMPANY_INFO } from "./company-info";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0a0a0a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, alignItems: "flex-start" },
  brand: { fontSize: 18, fontWeight: 700 },
  brandSub: { fontSize: 8, color: "#666" },
  refBlock: { textAlign: "right" },
  refLabel: { fontSize: 8, color: "#666" },
  refValue: { fontSize: 14, fontWeight: 700 },
  boxes: { flexDirection: "row", justifyContent: "space-between", marginVertical: 12 },
  box: { width: "48%", padding: 8, border: "1pt solid #ddd", borderRadius: 4 },
  boxTitle: { fontSize: 8, color: "#666", marginBottom: 4, textTransform: "uppercase" },
  boxName: { fontSize: 11, fontWeight: 700 },
  boxLine: { fontSize: 9, color: "#333" },
  title: { fontSize: 20, fontWeight: 700, marginTop: 10, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666", marginBottom: 12 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 14, marginBottom: 6, color: "#202037" },
  para: { fontSize: 10, lineHeight: 1.4, marginBottom: 4, color: "#333" },
  intro: { padding: 10, backgroundColor: "#F5F5F0", borderRadius: 4, fontSize: 10, lineHeight: 1.5, marginBottom: 10, fontStyle: "italic" },
  // Bloc conditions financières
  condCard: { border: "1pt solid #202037", borderRadius: 4, marginTop: 10 },
  condRow: { flexDirection: "row", justifyContent: "space-between", padding: 8, borderBottom: "0.5pt solid #eee" },
  condLast: { flexDirection: "row", justifyContent: "space-between", padding: 10, backgroundColor: "#202037", borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  condLabel: { fontSize: 10, color: "#333" },
  condValue: { fontSize: 10, fontWeight: 700, color: "#0a0a0a" },
  totalLabel: { fontSize: 12, color: "#F5F5F0", fontWeight: 700 },
  totalValue: { fontSize: 16, color: "#F5F5F0", fontWeight: 700 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: "#666", textAlign: "center", borderTop: "0.5pt solid #ddd", paddingTop: 6 },
  // Page 2 consultant
  profileHeader: { flexDirection: "row", gap: 16, marginBottom: 14, alignItems: "flex-start" },
  photo: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#eee" },
  photoPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: "#eee", justifyContent: "center", alignItems: "center" },
  photoInitials: { fontSize: 32, color: "#999", fontWeight: 700 },
  profileName: { fontSize: 18, fontWeight: 700 },
  profileRole: { fontSize: 11, color: "#666", marginTop: 2 },
  profileMeta: { fontSize: 9, color: "#666", marginTop: 4 },
  kpiRow: { flexDirection: "row", gap: 8, marginVertical: 10 },
  kpi: { flex: 1, border: "1pt solid #ddd", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 8, color: "#666", textTransform: "uppercase" },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  skill: { fontSize: 9, padding: "3pt 8pt", backgroundColor: "#F5F5F0", borderRadius: 10 },
  expItem: { paddingLeft: 8, borderLeft: "2pt solid #202037", marginBottom: 8 },
  expTitle: { fontSize: 10, fontWeight: 700 },
  expCompany: { fontSize: 9, color: "#333" },
  expDates: { fontSize: 8, color: "#666" },
  expDesc: { fontSize: 9, color: "#444", marginTop: 2, lineHeight: 1.3 }
});

export type ProposalPdfData = {
  reference: string;
  intro: string | null;
  // Mission
  missionTitle: string;
  missionDescription: string | null;
  // Client destinataire
  clientCompany: { name: string; vatNumber: string | null; addressLine: string | null };
  clientContact: {
    firstName: string; lastName: string; jobTitle: string | null;
    email: string | null; phone: string | null;
  } | null;
  // Conditions
  startDate: Date;
  endDate: Date;
  workDaysPerWeek: number;
  includeHolidays: boolean;
  computedDays: number;
  dailyRate: number;
  computedBudgetHt: number;
  // Consultant
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
  // Owner Dasolabs (interlocuteur)
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
  const initials = (data.candidate.firstName[0] ?? "") + (data.candidate.lastName[0] ?? "");
  const workRegimeLabel =
    Number(data.workDaysPerWeek) === 5 ? "Temps plein (5 j/sem)" :
    Number(data.workDaysPerWeek) === 4 ? "4/5 (4 j/sem)" :
    Number(data.workDaysPerWeek) === 2.5 ? "Mi-temps (2.5 j/sem)" :
    `${data.workDaysPerWeek} j/sem`;

  return (
    <Document>
      {/* ═════════════════ PAGE 1 — CONTEXTE & PRIX ═════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{companyInfo.name}</Text>
            <Text style={styles.brandSub}>{companyInfo.addressLine}</Text>
            {companyInfo.vatNumber && <Text style={styles.brandSub}>TVA {companyInfo.vatNumber}</Text>}
          </View>
          <View style={styles.refBlock}>
            <Text style={styles.refLabel}>PROPOSITION CONSULTANT</Text>
            <Text style={styles.refValue}>{data.reference}</Text>
            <Text style={styles.brandSub}>Émise le {fmtDate(new Date())}</Text>
          </View>
        </View>

        <Text style={styles.title}>Proposition de consultant</Text>
        <Text style={styles.subtitle}>
          Pour la mission : <Text style={{ fontWeight: 700 }}>{data.missionTitle}</Text>
        </Text>

        <View style={styles.boxes}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Destinataire</Text>
            <Text style={styles.boxName}>{data.clientCompany.name}</Text>
            {data.clientCompany.addressLine && <Text style={styles.boxLine}>{data.clientCompany.addressLine}</Text>}
            {data.clientCompany.vatNumber && <Text style={styles.boxLine}>TVA {data.clientCompany.vatNumber}</Text>}
            {data.clientContact && (
              <>
                <Text style={[styles.boxLine, { marginTop: 4, fontWeight: 700 }]}>
                  À l'attention de {data.clientContact.firstName} {data.clientContact.lastName}
                </Text>
                {data.clientContact.jobTitle && <Text style={styles.boxLine}>{data.clientContact.jobTitle}</Text>}
                {data.clientContact.email && <Text style={styles.boxLine}>{data.clientContact.email}</Text>}
                {data.clientContact.phone && <Text style={styles.boxLine}>{data.clientContact.phone}</Text>}
              </>
            )}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Interlocuteur Dasolabs</Text>
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

        {data.intro && <Text style={styles.intro}>{data.intro}</Text>}

        {data.missionDescription && (
          <>
            <Text style={styles.h2}>Contexte de la mission</Text>
            <Text style={styles.para}>{data.missionDescription}</Text>
          </>
        )}

        <Text style={styles.h2}>Consultant proposé</Text>
        <Text style={styles.para}>
          Nous vous proposons <Text style={{ fontWeight: 700 }}>{data.candidate.firstName} {data.candidate.lastName}</Text>
          {data.candidate.seniority ? ` (${data.candidate.seniority})` : ""}
          {data.candidate.yearsExperience ? `, ${data.candidate.yearsExperience} ans d'expérience` : ""}.
          Vous trouverez son profil détaillé en page 2 de cette proposition.
        </Text>

        <Text style={styles.h2}>Conditions financières</Text>
        <View style={styles.condCard}>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Période</Text>
            <Text style={styles.condValue}>
              Du {fmtDate(data.startDate)} au {fmtDate(data.endDate)}
            </Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Régime</Text>
            <Text style={styles.condValue}>{workRegimeLabel}</Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Jours facturables (weekends et fériés déduits{data.includeHolidays ? " – fériés belges" : ""})</Text>
            <Text style={styles.condValue}>{data.computedDays} j</Text>
          </View>
          <View style={styles.condRow}>
            <Text style={styles.condLabel}>Tarif journalier HTVA</Text>
            <Text style={styles.condValue}>{fmtEUR(data.dailyRate)}</Text>
          </View>
          <View style={styles.condLast}>
            <Text style={styles.totalLabel}>Budget total HTVA</Text>
            <Text style={styles.totalValue}>{fmtEUR(data.computedBudgetHt)}</Text>
          </View>
        </View>

        <Text style={[styles.para, { marginTop: 12, color: "#666" }]}>
          Facturation mensuelle en fin de mois sur base des jours prestés.
          TVA 21 % applicable en sus. Proposition valable 30 jours.
        </Text>

        <Text style={styles.footer}>
          {companyInfo.name} · {companyInfo.addressLine} · TVA {companyInfo.vatNumber} · {companyInfo.email}
        </Text>
      </Page>

      {/* ═════════════════ PAGE 2 — PROFIL CONSULTANT ═════════════════ */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{companyInfo.name}</Text>
            <Text style={styles.brandSub}>Profil consultant</Text>
          </View>
          <View style={styles.refBlock}>
            <Text style={styles.refLabel}>Annexe à {data.reference}</Text>
          </View>
        </View>

        <View style={styles.profileHeader}>
          {data.candidate.photoUrl ? (
            <Image src={data.candidate.photoUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitials}>{initials.toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{data.candidate.firstName} {data.candidate.lastName}</Text>
            {data.candidate.seniority && (
              <Text style={styles.profileRole}>{data.candidate.seniority}</Text>
            )}
            <Text style={styles.profileMeta}>
              {[
                data.candidate.yearsExperience ? `${data.candidate.yearsExperience} ans d'expérience` : null,
                data.candidate.city ? data.candidate.city : null
              ].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </View>

        {data.candidate.spokenLanguages.length > 0 && (
          <>
            <Text style={styles.h2}>Langues parlées</Text>
            <View style={styles.skills}>
              {data.candidate.spokenLanguages.map((l) => (
                <Text key={l} style={styles.skill}>{l}</Text>
              ))}
            </View>
          </>
        )}

        {data.candidate.skills.length > 0 && (
          <>
            <Text style={styles.h2}>Compétences techniques</Text>
            <View style={styles.skills}>
              {data.candidate.skills.map((s) => (
                <Text key={s} style={styles.skill}>{s}</Text>
              ))}
            </View>
          </>
        )}

        {data.candidate.experiences.length > 0 && (
          <>
            <Text style={styles.h2}>Expériences professionnelles</Text>
            {data.candidate.experiences.slice(0, 5).map((exp, idx) => (
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
          {companyInfo.name} · {companyInfo.addressLine} · TVA {companyInfo.vatNumber}
        </Text>
      </Page>
    </Document>
  );
}
