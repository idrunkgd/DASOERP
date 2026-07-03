/**
 * Template PDF « CV standalone » — sortie du CV d'un candidat OU d'un
 * consultant interne en dehors du contexte d'une offre.
 *
 * Structure épurée sur 1 page (parfois 2 si beaucoup d'expériences) :
 *   • Bandeau nom + photo + séniorité + coordonnées
 *   • Bloc "en un coup d'œil" (années xp, ville, langues)
 *   • Compétences (pills)
 *   • Expériences pro dans l'ordre antichronologique
 *
 * Le même composant sert candidat et consultant : on lui passe une
 * shape normalisée (voir CvProfile). Les routes API (candidat vs user)
 * font la conversion.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import type { CompanyInfo } from "./company-info";
import { DEFAULT_COMPANY_INFO } from "./company-info";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#0a0a0a" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 16,
    paddingBottom: 12, marginBottom: 14, borderBottom: "2pt solid #202037"
  },
  photo: { width: 78, height: 78, borderRadius: 39, backgroundColor: "#eee" },
  photoPlaceholder: {
    width: 78, height: 78, borderRadius: 39, backgroundColor: "#202037",
    justifyContent: "center", alignItems: "center"
  },
  photoInitials: { fontSize: 28, color: "#F5F5F0", fontWeight: 700 },
  name: { fontSize: 22, fontWeight: 700 },
  role: { fontSize: 12, color: "#666", marginTop: 2 },
  contactRow: { flexDirection: "row", gap: 12, fontSize: 9, color: "#333", marginTop: 4, flexWrap: "wrap" },
  contactItem: { fontSize: 9, color: "#333" },
  emitter: { position: "absolute", top: 36, right: 36, textAlign: "right" },
  emitterLabel: { fontSize: 7, color: "#999", textTransform: "uppercase" },
  emitterName: { fontSize: 9, fontWeight: 700, color: "#202037" },

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpi: { flex: 1, backgroundColor: "#F5F5F0", padding: 8, borderRadius: 4 },
  kpiLabel: { fontSize: 8, color: "#666", textTransform: "uppercase" },
  kpiValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },

  h2: { fontSize: 12, fontWeight: 700, marginTop: 4, marginBottom: 6, color: "#202037" },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  skill: { fontSize: 9, padding: "3pt 8pt", backgroundColor: "#F5F5F0", borderRadius: 10 },
  languages: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  language: { fontSize: 9, padding: "3pt 8pt", border: "0.5pt solid #202037", borderRadius: 10 },

  expItem: { paddingLeft: 10, borderLeft: "2pt solid #202037", marginBottom: 9, paddingVertical: 2 },
  expTitle: { fontSize: 11, fontWeight: 700 },
  expCompany: { fontSize: 10, color: "#202037" },
  expDates: { fontSize: 8, color: "#666", marginTop: 1 },
  expDesc: { fontSize: 9, color: "#444", marginTop: 3, lineHeight: 1.35 },

  footer: {
    position: "absolute", bottom: 20, left: 36, right: 36,
    fontSize: 7, color: "#888", textAlign: "center",
    borderTop: "0.5pt solid #ddd", paddingTop: 5
  }
});

export type CvProfile = {
  kind: "candidate" | "user";  // pour label "confidentialité" ou similaire si voulu
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

export function CvPdf({
  profile, companyInfo = DEFAULT_COMPANY_INFO
}: { profile: CvProfile; companyInfo?: CompanyInfo }) {
  const initials = ((profile.firstName[0] ?? "") + (profile.lastName[0] ?? "")).toUpperCase();
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.emitter}>
          <Text style={styles.emitterLabel}>Émis par</Text>
          <Text style={styles.emitterName}>{companyInfo.name}</Text>
        </View>

        <View style={styles.header}>
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
              {profile.email && <Text style={styles.contactItem}>{profile.email}</Text>}
              {profile.phone && <Text style={styles.contactItem}>{profile.phone}</Text>}
              {profile.city && <Text style={styles.contactItem}>{profile.city}</Text>}
              {profile.linkedinUrl && <Text style={styles.contactItem}>{profile.linkedinUrl}</Text>}
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Expérience</Text>
            <Text style={styles.kpiValue}>
              {profile.yearsExperience != null ? `${profile.yearsExperience} ans` : "—"}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Statut</Text>
            <Text style={styles.kpiValue}>
              {profile.kind === "user" ? "Consultant" : "Freelance / candidat"}
            </Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>Localisation</Text>
            <Text style={styles.kpiValue}>{profile.city ?? "—"}</Text>
          </View>
        </View>

        {profile.spokenLanguages.length > 0 && (
          <>
            <Text style={styles.h2}>Langues</Text>
            <View style={styles.languages}>
              {profile.spokenLanguages.map((l) => <Text key={l} style={styles.language}>{l}</Text>)}
            </View>
          </>
        )}

        {profile.skills.length > 0 && (
          <>
            <Text style={styles.h2}>Compétences</Text>
            <View style={styles.skills}>
              {profile.skills.map((s) => <Text key={s} style={styles.skill}>{s}</Text>)}
            </View>
          </>
        )}

        {profile.experiences.length > 0 && (
          <>
            <Text style={styles.h2}>Expériences professionnelles</Text>
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
          {companyInfo.name} · {companyInfo.addressLine} · CV émis le {new Date().toLocaleDateString("fr-BE")}
        </Text>
      </Page>
    </Document>
  );
}
