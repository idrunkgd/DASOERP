/**
 * Certificat de formation — PDF légal généré automatiquement quand un user
 * réussit un quiz certifiant avec un score >= passThreshold du cours.
 *
 * Layout : format paysage A4, palette charte Dasolabs.
 * Structure = flex column verticale (frame prend 100% de la hauteur) →
 * pas de collision entre le contenu et le footer, quelle que soit la
 * longueur du pavé légal du cours.
 */
/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Rect, G } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
    backgroundColor: "#F1F1F6",
    color: "#202037"
  },
  frame: {
    borderStyle: "solid",
    borderWidth: 2,
    borderColor: "#3434E8",
    padding: 34,
    height: "100%",
    backgroundColor: "#FFFFFF",
    flexDirection: "column"
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14
  },
  brand: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#202037",
    letterSpacing: -0.5
  },
  brandSlash: { color: "#3434E8", fontWeight: "bold" },
  brandTag: { fontSize: 9, color: "#6b6d80", marginTop: 2 },
  pill: {
    backgroundColor: "#3434E8",
    color: "#FFFFFF",
    padding: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: "bold",
    letterSpacing: 1.5
  },
  // Title block
  titleBlock: { alignItems: "center", marginBottom: 10 },
  certLabel: {
    fontSize: 9,
    color: "#6b6d80",
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 6
  },
  certTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#202037",
    textAlign: "center",
    marginBottom: 6
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: "#3434E8",
    marginTop: 6,
    marginBottom: 10
  },
  // Person
  attributionLabel: {
    fontSize: 10,
    color: "#6b6d80",
    textAlign: "center",
    marginBottom: 4
  },
  personName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#3434E8",
    textAlign: "center",
    marginBottom: 10
  },
  // Wording (le pavé légal)
  wording: {
    fontSize: 11,
    color: "#202037",
    lineHeight: 1.6,
    textAlign: "justify",
    marginVertical: 8,
    paddingHorizontal: 40
  },
  // Score
  scoreBadge: {
    marginTop: 10,
    marginBottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16
  },
  scoreLabel: { fontSize: 11, color: "#065F46", marginRight: 10, fontWeight: "bold" },
  scoreValue: { fontSize: 20, fontWeight: "bold", color: "#10B981" },
  scorePct: { fontSize: 14, fontWeight: "bold", color: "#10B981", marginLeft: 1 },
  // Footer — dernier enfant du frame column, pas d'absolute
  footerSpacer: { flexGrow: 1 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "#e5e7ef",
    borderTopStyle: "solid",
    paddingTop: 12,
    marginTop: 8
  },
  footerBlock: { flex: 1 },
  footerBlockCenter: { flex: 1, alignItems: "center" },
  footerBlockRight: { flex: 1, alignItems: "flex-end" },
  footerLabel: {
    fontSize: 8,
    color: "#6b6d80",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  footerValue: { fontSize: 10, color: "#202037", fontWeight: "bold" },
  footerSub: { fontSize: 8, color: "#6b6d80", marginTop: 1 }
});

// Petit sceau SVG (foudre stylisée dans un cercle) — signature graphique.
function LightningSeal() {
  return (
    <Svg width={56} height={56} viewBox="0 0 100 100">
      <Circle cx={50} cy={50} r={46} stroke="#3434E8" strokeWidth={3} fill="#FFFFFF" />
      <G>
        <Path d="M 55 20 L 30 55 L 48 55 L 42 82 L 70 42 L 52 42 Z" fill="#3434E8" />
      </G>
    </Svg>
  );
}

export type CertificateData = {
  personName: string;
  courseTitle: string;
  scorePercent: number;
  issuedAt: Date;
  certificateNumber: string;
  legalWording: string; // Le pavé légal du cours (Course.certificateWording)
};

export function CertificatePdfDocument({ data }: { data: CertificateData }) {
  const dateStr = data.issuedAt.toLocaleDateString("fr-BE", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return (
    <Document title={`Certificat ${data.courseTitle} — ${data.personName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>
                dasolabs<Text style={styles.brandSlash}> /</Text>
              </Text>
              <Text style={styles.brandTag}>Bureau d'études industriel</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <LightningSeal />
              <Text style={styles.pill}>CERTIFICAT</Text>
            </View>
          </View>

          {/* Titre + sujet */}
          <View style={styles.titleBlock}>
            <Text style={styles.certLabel}>Certificat de formation</Text>
            <Text style={styles.certTitle}>{data.courseTitle}</Text>
            <View style={styles.divider} />
          </View>

          {/* Personne */}
          <Text style={styles.attributionLabel}>Délivré à</Text>
          <Text style={styles.personName}>{data.personName}</Text>

          {/* Pavé légal */}
          <Text style={styles.wording}>{data.legalWording}</Text>

          {/* Score en badge vert */}
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreLabel}>Résultat de l'évaluation</Text>
            <Text style={styles.scoreValue}>{data.scorePercent}</Text>
            <Text style={styles.scorePct}>%</Text>
          </View>

          {/* Spacer flex → pousse le footer en bas quel que soit le contenu */}
          <View style={styles.footerSpacer} />

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Date de délivrance</Text>
              <Text style={styles.footerValue}>{dateStr}</Text>
            </View>
            <View style={styles.footerBlockCenter}>
              <Text style={styles.footerLabel}>N° certificat</Text>
              <Text style={[styles.footerValue, { fontFamily: "Courier" }]}>
                {data.certificateNumber}
              </Text>
            </View>
            <View style={styles.footerBlockRight}>
              <Text style={styles.footerLabel}>Émis par</Text>
              <Text style={styles.footerValue}>Dasolabs SRL</Text>
              <Text style={styles.footerSub}>hub.dasolabs.be</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// Petites re-exports pour éviter un warning "unused" si un jour on n'utilise
// pas certains atomes SVG (au cas où on les enrichit plus tard).
export const _atoms = { Svg, Path, Circle, Rect, G };
