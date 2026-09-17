/**
 * Certificat de formation — PDF légal généré automatiquement quand un user
 * réussit un quiz certifiant avec un score >= passThreshold du cours.
 *
 * Layout : format paysage A4, mise en page sobre "attestation", palette
 * charte Dasolabs (midnight + electric blue).
 */
/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 60,
    fontFamily: "Helvetica",
    fontSize: 11,
    backgroundColor: "#F1F1F6",
    color: "#202037",
    position: "relative"
  },
  frame: {
    borderStyle: "solid",
    borderWidth: 2,
    borderColor: "#3434E8",
    padding: 40,
    height: "100%",
    backgroundColor: "#FFFFFF"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30
  },
  brand: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#202037",
    letterSpacing: -0.5
  },
  brandSlash: {
    color: "#3434E8",
    fontWeight: "bold"
  },
  pill: {
    backgroundColor: "#3434E8",
    color: "#FFFFFF",
    padding: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    fontSize: 9,
    fontWeight: "bold"
  },
  titleBlock: {
    alignItems: "center",
    marginVertical: 20
  },
  certLabel: {
    fontSize: 10,
    color: "#6b6d80",
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 8
  },
  certTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#202037",
    marginBottom: 8,
    textAlign: "center"
  },
  divider: {
    width: 60,
    height: 3,
    backgroundColor: "#3434E8",
    marginTop: 10,
    marginBottom: 24
  },
  attributionLabel: {
    fontSize: 11,
    color: "#6b6d80",
    textAlign: "center",
    marginBottom: 10
  },
  personName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#3434E8",
    textAlign: "center",
    marginBottom: 24
  },
  wording: {
    fontSize: 12,
    color: "#202037",
    lineHeight: 1.7,
    textAlign: "justify",
    marginVertical: 16,
    paddingHorizontal: 20
  },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20
  },
  scoreLabel: {
    fontSize: 12,
    color: "#6b6d80",
    marginRight: 12
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#10B981",
    marginRight: 4
  },
  scorePct: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#10B981"
  },
  footer: {
    position: "absolute",
    bottom: 60,
    left: 60,
    right: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  footerBlock: { flex: 1 },
  footerLabel: {
    fontSize: 9,
    color: "#6b6d80",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  footerValue: {
    fontSize: 11,
    color: "#202037",
    fontWeight: "bold"
  },
  refNote: {
    fontSize: 8,
    color: "#9394a6",
    textAlign: "center",
    marginTop: 6
  }
});

export type CertificateData = {
  personName: string;
  courseTitle: string;
  scorePercent: number;
  issuedAt: Date;
  certificateNumber: string;
  legalWording: string;         // Le pavé légal du cours (Course.certificateWording)
};

export function CertificatePdfDocument({ data }: { data: CertificateData }) {
  const dateStr = data.issuedAt.toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });
  return (
    <Document title={`Certificat ${data.courseTitle} — ${data.personName}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>
                dasolabs<Text style={styles.brandSlash}> /</Text>
              </Text>
              <Text style={{ fontSize: 9, color: "#6b6d80", marginTop: 2 }}>Bureau d'études industriel</Text>
            </View>
            <Text style={styles.pill}>CERTIFICAT</Text>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.certLabel}>Certificat de formation</Text>
            <Text style={styles.certTitle}>{data.courseTitle}</Text>
            <View style={styles.divider} />
          </View>

          <Text style={styles.attributionLabel}>Délivré à</Text>
          <Text style={styles.personName}>{data.personName}</Text>

          <Text style={styles.wording}>{data.legalWording}</Text>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Résultat de l'évaluation :</Text>
            <Text style={styles.scoreValue}>{data.scorePercent}</Text>
            <Text style={styles.scorePct}>%</Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerBlock}>
              <Text style={styles.footerLabel}>Date de délivrance</Text>
              <Text style={styles.footerValue}>{dateStr}</Text>
            </View>
            <View style={{ ...styles.footerBlock, alignItems: "center" }}>
              <Text style={styles.footerLabel}>N° certificat</Text>
              <Text style={{ ...styles.footerValue, fontFamily: "Courier" }}>{data.certificateNumber}</Text>
            </View>
            <View style={{ ...styles.footerBlock, alignItems: "flex-end" }}>
              <Text style={styles.footerLabel}>Émis par</Text>
              <Text style={styles.footerValue}>Dasolabs SRL</Text>
              <Text style={{ fontSize: 9, color: "#6b6d80" }}>hub.dasolabs.be</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
