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
    paddingTop: 28, paddingBottom: 40, paddingHorizontal: 32,
    fontSize: 10, fontFamily: "Helvetica", color: C.ink
  },

  // Header : logo + titre
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 8, borderBottom: `2 solid ${C.ink}`, marginBottom: 10
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.ink },
  brandTagline: { fontSize: 7, color: C.grey, marginTop: 1 },
  docTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.accent, textAlign: "right" },
  docSubtitle: { fontSize: 8, color: C.grey, textAlign: "right", marginTop: 2 },

  // Bandeau profil : photo + nom
  profile: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 10 },
  photo: { width: 72, height: 72, borderRadius: 36 },
  photoPlaceholder: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.ink,
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

  // Encadré "Votre contact"
  contactBox: {
    marginBottom: 10,
    padding: 8, backgroundColor: C.light,
    borderLeft: `3 solid ${C.accent}`, borderRadius: 4
  },
  contactBoxLabel: {
    fontSize: 7, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4
  },
  contactBoxName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink },
  contactBoxRole: { fontSize: 9, color: C.accent, marginTop: 1 },
  contactBoxLineRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  contactBoxLineIcon: { width: 12, fontSize: 9, color: C.grey },
  contactBoxLineText: { fontSize: 9, color: C.ink },

  // Cartouches KPI — compactes, affichées à droite du bandeau profil
  kpiStack: { flexDirection: "column", gap: 4, width: 150 },
  kpi: {
    backgroundColor: C.light, padding: 6, borderRadius: 4,
    borderLeft: `3 solid ${C.accent}`, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center"
  },
  kpiLabel: { fontSize: 7, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink },

  // Sections
  h2: {
    fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink,
    marginTop: 4, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5
  },
  h2Line: { borderBottom: `1 solid ${C.border}`, marginBottom: 6, paddingBottom: 2 },

  // Skills / langues (pills)
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
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
    paddingLeft: 10, borderLeft: `2 solid ${C.accent}`, marginBottom: 6, paddingVertical: 1
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
  /**
   * Tarif journalier (HTVA, EUR) affiché sur le CV — remplace l'ancien
   * KPI « Profil ». Source : minDailyRate en priorité (souhaité par le
   * candidat) sinon dailyCost. null = non renseigné → « — ».
   */
  dailyRate: number | null;
  skills: string[];
  spokenLanguages: string[];
  /// Centres d'intérêt (hobbies, passions)
  interests?: string[];
  experiences: Array<{
    companyName: string;
    jobTitle: string | null;
    startDate: Date;
    endDate: Date | null;
    description: string | null;
  }>;
  /// Formations / diplômes / certifications
  trainings?: Array<{
    institution: string;
    title: string;
    period: string | null;
    description: string | null;
  }>;
  /// Point de contact Dasolabs affiché sur le CV à la place des coordonnées
  /// personnelles du consultant. Si fourni, remplace email/phone/linkedin.
  cvContact?: {
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

/**
 * Les polices Helvetica de @react-pdf/renderer ne rendent pas les no-break
 * spaces (U+00A0, U+202F) qu'Intl utilise comme séparateurs de milliers en
 * fr-BE. Résultat : "33495,00 €" au lieu de "33 495,00 €". On les remplace.
 */
function pdfSafe(s: string): string {
  return s.replace(/ /g, " ").replace(/ /g, " ");
}

/**
 * @react-pdf/renderer ne supporte que JPEG et PNG. BMP/WEBP/GIF/SVG font
 * planter le rendu ('Base64 image invalid format: bmp'). On accepte :
 *   - data URI JPEG (image/jpeg, image/jpg)
 *   - data URI PNG (image/png)
 *   - URL externe se terminant par .jpg/.jpeg/.png (best effort)
 * Sinon on renvoie false → placeholder avec initiales.
 */
function isPdfSafePhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg")) return true;
  if (url.startsWith("data:image/png")) return true;
  if (url.startsWith("data:")) return false; // autre data URI (bmp, webp…)
  return /\.(jpe?g|png)(\?|$)/i.test(url);
}
function fmtMonthYear(d: Date | null): string {
  if (!d) return "aujourd'hui";
  return pdfSafe(new Intl.DateTimeFormat("fr-BE", { month: "short", year: "numeric" }).format(d));
}
function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return pdfSafe(new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "long", year: "numeric" }).format(d));
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
              <Text style={styles.brandTagline}>Digitalization expert</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>CV consultant</Text>
            <Text style={styles.docSubtitle}>Émis le {fmtDate(new Date())}</Text>
          </View>
        </View>

        {/* Bandeau profil */}
        <View style={styles.profile}>
          {isPdfSafePhoto(profile.photoUrl) ? (
            <Image src={profile.photoUrl!} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoInitials}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
            {profile.seniority && <Text style={styles.role}>{profile.seniority}</Text>}
            <View style={styles.contactRow}>
              {/* Email/phone/linkedin uniquement s'il n'y a pas de point de contact */}
              {!profile.cvContact && (
                <>
                  {profile.email && <Text style={styles.contact}>✉ {profile.email}</Text>}
                  {profile.phone && <Text style={styles.contact}>☎ {profile.phone}</Text>}
                  {profile.linkedinUrl && <Text style={styles.contact}>{profile.linkedinUrl}</Text>}
                </>
              )}
            </View>
          </View>
          {/* KPI compacts à droite du bandeau profil */}
          <View style={styles.kpiStack}>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Expérience</Text>
              <Text style={styles.kpiValue}>
                {profile.yearsExperience != null ? `${profile.yearsExperience} ans` : "—"}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Taux / j</Text>
              <Text style={styles.kpiValue}>
                {profile.dailyRate != null
                  ? pdfSafe(new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(profile.dailyRate))
                  : "—"}
              </Text>
            </View>
            <View style={styles.kpi}>
              <Text style={styles.kpiLabel}>Lieu</Text>
              <Text style={styles.kpiValue}>{profile.city ?? "—"}</Text>
            </View>
          </View>
        </View>

        {/* Encadré "Votre contact" — point de contact Dasolabs pour le CV */}
        {profile.cvContact && (
          <View style={styles.contactBox}>
            <Text style={styles.contactBoxLabel}>Votre contact</Text>
            <Text style={styles.contactBoxName}>{profile.cvContact.name}</Text>
            {profile.cvContact.role && <Text style={styles.contactBoxRole}>{profile.cvContact.role}</Text>}
            {profile.cvContact.email && (
              <View style={styles.contactBoxLineRow}>
                <Text style={styles.contactBoxLineIcon}>✉</Text>
                <Text style={styles.contactBoxLineText}>{profile.cvContact.email}</Text>
              </View>
            )}
            {profile.cvContact.phone && (
              <View style={styles.contactBoxLineRow}>
                <Text style={styles.contactBoxLineIcon}>☎</Text>
                <Text style={styles.contactBoxLineText}>{profile.cvContact.phone}</Text>
              </View>
            )}
          </View>
        )}

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

        {profile.trainings && profile.trainings.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Formations & certifications</Text></View>
            {profile.trainings.map((t, idx) => (
              <View key={idx} style={styles.expItem}>
                <Text style={styles.expTitle}>{t.title}</Text>
                <Text style={styles.expCompany}>{t.institution}</Text>
                {t.period && <Text style={styles.expDates}>{t.period}</Text>}
                {t.description && <Text style={styles.expDesc}>{t.description}</Text>}
              </View>
            ))}
          </>
        )}

        {profile.interests && profile.interests.length > 0 && (
          <>
            <View style={styles.h2Line}><Text style={styles.h2}>Centres d'intérêt</Text></View>
            <View style={styles.pills}>
              {profile.interests.map((i) => (
                <Text key={i} style={styles.skill}>{i}</Text>
              ))}
            </View>
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
