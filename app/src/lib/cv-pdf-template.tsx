/**
 * Template PDF « CV standalone » aux couleurs Dasolabs.
 *
 * Reprend l'identité visuelle des offres projet : logo, couleurs, header
 * à filet indigo, cartouches. Une page (parfois 2 selon les expériences).
 *
 * Structure :
 *   • Header : logo + « CV Consultant » (droite)
 *   • Bandeau profil : photo + nom + séniorité + coordonnées
 *   • Cartouches KPI : années xp, statut, localisation
 *   • Langues (pills bordurées)
 *   • Compétences (pills teintées)
 *   • Expériences pro antichronologiques
 *   • Footer : émetteur + coordonnées légales
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

  // Header : logo + titre
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 12, borderBottom: `2 solid ${C.ink}`, marginBottom: 16
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink },
  brandTagline: { fontSize: 7, color: C.grey, marginTop: 1 },
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.accent, textAlign: "right" },
  docSubtitle: { fontSize: 8, color: C.grey, textAlign: "right", marginTop: 2 },

  // Bandeau profil : photo + nom
  profile: { flexDirection: "row", gap: 16, alignItems: "center", marginBottom: 14 },
  photo: { width: 82, height: 82, borderRadius: 41 },
  photoPlaceholder: {
    width: 82, height: 82, borderRadius: 41, backgroundColor: C.ink,
    justifyContent: "center", alignItems: "center"
  },
  photoInitials: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#FFF" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.ink },
  role: { fontSize: 11, color: C.accent, marginTop: 2, fontFamily: "Helvetica-Bold" },
  contactRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
    fontSize: 9, color: C.grey, marginTop: 5
  },
  contact: { fontSize: 9, color: C.grey },

  // Cartouches KPI
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kpi: {
    flex: 1, backgroundColor: C.light, padding: 10, borderRadius: 4,
    borderLeft: `3 solid ${C.accent}`
  },
  kpiLabel: { fontSize: 7, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 2 },

  // Sections
  h2: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink,
    marginTop: 6, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5
  },
  h2Line: { borderBottom: `1 solid ${C.border}`, marginBottom: 8, paddingBottom: 2 },

  // Skills / langues (pills)
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  skill: {
    fontSize: 9, padding: "3pt 8pt", backgroundColor: C.light,
    borderRadius: 10, color: C.ink
  },
  language: {
    fontSize: 9, padding: "3pt 8pt", border: `0.5pt solid ${C.accent}`,
    borderRadius: 10, color: C.accent
  },

  // Expériences pro
  expItem: {
    paddingLeft: 12, borderLeft: `2 solid ${C.accent}`, marginBottom: 9, paddingVertical: 2
  },
  expTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.ink },
  expCompany: { fontSize: 10, color: C.accent, marginTop: 1 },
  expDates: { fontSize: 8, color: C.grey, marginTop: 1 },
  expDesc: { fontSize: 9, color: C.ink, marginTop: 3, lineHeight: 1.35 },

  // Footer
  footer: {
    position: "absolute", bottom: 24, left: 36, right: 36,
    fontSize: 7, color: C.grey, textAlign: "center",
    borderTop: `0.5pt solid ${C.border}`, paddingTop: 6
  }
});

export type CvProfile = {
  kind: "candidate" | "user";
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  seniority: string | null;
  yearsExperience: number | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
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

function fmtMonthYear(d: Date | null): string {
  if (!d) return "aujourd'hui";
  return new Intl.DateTimeFormat("fr-BE", { month: "short", year: "numeric" }).format(d);
}
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "long", year: "numeric" }).format(d);
}

export function CvPdf({
  profile, companyInfo = DEFAULT_COMPANY_INFO
}: { profile: CvProfile; companyInfo?: CompanyInfo }) {
  const initials = ((profile.firstName[0] ?? "") + (profile.lastName[0] ?? "")).toUpperCase();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header charte Dasolabs */}
        <View style={styles.header}>
          <View style={styles.brand}>
            <DasolabsIcon size={38} color={C.ink} />
            <View>
              <Text style={styles.brandName}>{companyInfo.legalName ?? "DASOLABS"}</Text>
              <Text style={styles.brandTagline}>Expert IT · Consulting</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>CV consultant</Text>
            <Text style={styles.docSubtitle}>Émis le {fmtDate(new Date())}</Text>
          </View>
        </View>

        {/* Bandeau profil */}
        <View style={styles.profile}>
          {profile.photoUrl ? (
            <Image src={profile.photoUrl} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
            {profile.seniority && <Text style={styles.role}>{profile.seniority}</Text>}
            <View style={styles.contactRow}>
              {profile.email && <Text style={styles.contact}>✉ {profile.email}</Text>}
              {profile.phone && <Text style={styles.contact}>☎ {profile.phone}</Text>}
              {profile.city && <Text style={styles.contact}>📍 {profile.city}</Text>}
              {profile.linkedinUrl && <Text style={styles.contact}>{profile.linkedinUrl}</Text>}
            </View>
          </View>
        </View>

        {/* KPI cartouches */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Expérience</Text>
            <Text style={styles.kpiValue}>
              {profile.yearsExperience != null ? `${profile.yearsExperience} ans` : "—"}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Profil</Text>
            <Text style={styles.kpiValue}>
              {profile.kind === "user" ? "Consultant interne" : "Freelance"}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Localisation</Text>
            <Text style={styles.kpiValue}>{profile.city ?? "—"}</Text>
          </View>
        </View>

        {profile.spokenLanguages.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Langues parlées</Text></View>
            <View style={styles.pills}>
              {profile.spokenLanguages.map((l) => <Text key={l} style={styles.language}>{l}</Text>)}
            </View>
          </>
        )}

        {profile.skills.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Compétences</Text></View>
            <View style={styles.pills}>
              {profile.skills.map((s) => <Text key={s} style={styles.skill}>{s}</Text>)}
            </View>
          </>
        )}

        {profile.experiences.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Expériences professionnelles</Text></View>
            {profile.experiences.map((exp, idx) => (
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
          {companyInfo.email ? ` · ${companyInfo.email}` : ""}
        </Text>
      </Page>
    </Document>
  );
}
