// Template React PDF — devis Dasolabs.
// On utilise @react-pdf/renderer 3.4.5 (v4 a un bug 'unitsPerEm' en serverless).
// La Helvetica built-in de v3 supporte le WinAnsi qui inclut € (0x80), é (0xE9),
// à (0xE0), etc. — largement suffisant pour des devis BE/FR.
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  G
} from "@react-pdf/renderer";
import React from "react";
import type { CompanyInfo } from "./company-info";
import { DEFAULT_COMPANY_INFO } from "./company-info";

const VAT_RATE_DEFAULT = 21;

// ─────────────────────────────────────────────────────────────
// LOGO — reproduction inline du fichier dasolabs-icon.svg
// (couleur #202037 = midnight de la charte ERP)
// ─────────────────────────────────────────────────────────────
function DasolabsIcon({ size = 40, color = "#202037" }: { size?: number; color?: string }) {
  // viewBox d'origine 400×500 → on garde le ratio
  const height = (size * 500) / 400;
  return (
    <Svg viewBox="0 0 400 500" width={size} height={height}>
      <G>
        <Path
          fill={color}
          d="M208.6,352.8c29.2-4.7,48.9-32.2,44.2-61.4c-4.7-29.2-32.2-48.9-61.4-44.2s-48.9,32.2-44.2,61.4 C152,337.7,179.4,357.5,208.6,352.8z"
        />
        <Path
          fill={color}
          d="M400,301.6c0-0.5,0-1.1,0-1.6s0-1.1,0-1.6V14.2c0-11.7-13.2-18.3-22.6-11.4c-40,29.2-68.7,72.9-78.4,123.4 c-29.2-16.6-63-26.2-99-26.2C89.5,100,0,189.5,0,300s89.5,200,200,200s194.5-84.1,199.8-189.9c0.2-1,0.2-1.9,0.2-3V301.6z M200,413.5c-62.7,0-113.5-50.8-113.5-113.5S137.3,186.5,200,186.5S313.5,237.3,313.5,300S262.7,413.5,200,413.5z"
        />
      </G>
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
// Couleurs alignées sur la charte ERP (tailwind.config.ts)
const colors = {
  ink: "#202037",      // midnight-900 / midnight DEFAULT
  indigo: "#202037",   // utilisé pour les éléments principaux du PDF (sombre)
  accent: "#5b5fd6",   // indigoaccent — pour les highlights
  grey: "#727496",     // midnight-400
  light: "#f3f3f7",    // midnight-50
  border: "#e1e1ec"    // midnight-100
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: colors.ink
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
    borderBottom: `2 solid ${colors.indigo}`,
    paddingBottom: 12
  },
  brand: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: colors.indigo
  },
  brandTagline: {
    fontSize: 8,
    color: colors.grey,
    marginTop: 2
  },
  docTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.indigo,
    textAlign: "right"
  },
  docMeta: {
    fontSize: 9,
    color: colors.grey,
    textAlign: "right",
    marginTop: 2
  },
  twoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
    gap: 30
  },
  block: {
    flex: 1
  },
  blockLabel: {
    fontSize: 8,
    color: colors.grey,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4
  },
  blockName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3
  },
  blockLine: {
    fontSize: 9,
    color: colors.ink,
    marginBottom: 1
  },
  infoBox: {
    backgroundColor: colors.light,
    padding: 10,
    marginBottom: 18,
    borderLeft: `3 solid ${colors.indigo}`,
    flexDirection: "row",
    gap: 24
  },
  infoCol: {
    flex: 1
  },
  infoLabel: {
    fontSize: 7,
    color: colors.grey,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  infoValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: colors.ink,
    marginTop: 1
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.indigo,
    marginTop: 8,
    marginBottom: 8
  },
  table: {
    marginBottom: 14
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.indigo,
    color: "white",
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 8,
    fontFamily: "Helvetica-Bold"
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: `0.5 solid ${colors.border}`,
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 9
  },
  tableRowAlt: {
    backgroundColor: "#fafafc"
  },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 0.7, textAlign: "right" },
  colPrice: { flex: 1.3, textAlign: "right" },
  colTotal: { flex: 1.3, textAlign: "right" },
  totalsBlock: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 22
  },
  totalsBox: {
    width: 240,
    borderTop: `1 solid ${colors.border}`,
    paddingTop: 6
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 10
  },
  totalRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 4,
    marginTop: 4,
    borderTop: `1 solid ${colors.indigo}`,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.indigo
  },
  milestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9,
    borderBottom: `0.5 solid ${colors.border}`
  },
  legalBlock: {
    marginTop: 16,
    padding: 10,
    fontSize: 7.5,
    color: colors.grey,
    backgroundColor: colors.light,
    lineHeight: 1.4
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: colors.grey,
    borderTop: `0.5 solid ${colors.border}`,
    paddingTop: 6
  }
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// IMPORTANT : on N'utilise PAS Intl.NumberFormat car il insère des
// NARROW NO-BREAK SPACE (U+202F) comme séparateurs de milliers, ce que
// la font Helvetica de @react-pdf/renderer ne sait pas encoder en WinAnsi
// (apparaît comme "/" dans le PDF). On formate à la main avec un espace
// normal ASCII (U+0020) en séparateur.
// ─────────────────────────────────────────────────────────────
function fmtNumber(n: number | string, digits = 2): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return "0,00";
  const negative = v < 0;
  const abs = Math.abs(v);
  const fixed = abs.toFixed(digits);
  const [intPart, decPart] = fixed.split(".");
  // Espace ASCII tous les 3 chiffres en partant de la droite
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negative ? "-" : ""}${intWithSep}${decPart ? "," + decPart : ""}`;
}

function fmtEur(n: number | string): string {
  return `${fmtNumber(n, 2)} €`;
}

/** Format quantité : pas de décimale si entier, sinon jusqu'à 2 décimales. */
function fmtQty(n: number | string): string {
  const v = Number(n ?? 0);
  if (Number.isInteger(v)) return fmtNumber(v, 0);
  // Arrondit à 2 décimales, supprime les zéros inutiles
  return fmtNumber(v, 2).replace(/,?0+$/, (m) => (m.includes(",") ? "" : m));
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  // Format DD/MM/YYYY manuellement pour éviter tout NBSP exotique
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
export interface OfferPdfData {
  reference: string;
  title: string;
  description?: string | null;
  totalSell: number;
  vatRate?: number;
  sentAt?: Date | null;
  expectedDecisionAt?: Date | null;
  company: {
    name: string;
    vatNumber?: string | null;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  };
  contacts?: { firstName: string; lastName: string; email?: string | null }[];
  lines: {
    description: string;
    quantity: number | string;
    unit: string;
    unitSellPrice: number | string;
    totalSell: number | string;
  }[];
  milestones: {
    label: string;
    amount: number | string;
    expectedAt?: Date | null;
    percentage?: number | string | null;
  }[];
  owner?: { firstName: string; lastName: string; email?: string | null } | null;
}

// ─────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────
export function OfferPdfDocument({
  data,
  companyInfo
}: {
  data: OfferPdfData;
  companyInfo?: CompanyInfo;
}) {
  // companyInfo = données de l'émetteur (Dasolabs) configurables dans /settings/company
  const company = companyInfo ?? DEFAULT_COMPANY_INFO;
  const vatRate = data.vatRate ?? VAT_RATE_DEFAULT;
  const totalHt = Number(data.totalSell);
  const vatAmount = (totalHt * vatRate) / 100;
  const totalTtc = totalHt + vatAmount;
  const validityDays = company.offerValidityDays ?? 30;
  const validityDate = data.expectedDecisionAt
    ? fmtDate(data.expectedDecisionAt)
    : `${validityDays} jours à compter de l'émission`;
  const paymentDays = company.paymentTermsDays ?? 30;

  return (
    <Document
      title={`Devis ${data.reference}`}
      author={company.legalName}
      creator="Dasolabs ERP"
      producer="Dasolabs ERP"
    >
      <Page size="A4" style={styles.page}>
        {/* HEADER : logo + nom à gauche, titre devis à droite */}
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <DasolabsIcon size={36} color={colors.ink} />
            <View>
              <Text style={styles.brand}>{company.legalName.split(" ")[0] || "DASOLABS"}</Text>
              <Text style={styles.brandTagline}>IT & industrial consulting</Text>
            </View>
          </View>
          <View>
            <Text style={styles.docTitle}>DEVIS</Text>
            <Text style={styles.docMeta}>{data.reference}</Text>
            <Text style={styles.docMeta}>Émis le {fmtDate(data.sentAt ?? new Date())}</Text>
          </View>
        </View>

        {/* EMETTEUR / CLIENT */}
        <View style={styles.twoCol}>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Émetteur</Text>
            <Text style={styles.blockName}>{company.legalName}</Text>
            <Text style={styles.blockLine}>{company.street}</Text>
            <Text style={styles.blockLine}>
              {company.postalCode} {company.city}, {company.country}
            </Text>
            <Text style={styles.blockLine}>TVA : {company.vatNumber}</Text>
            {company.bceNumber && <Text style={styles.blockLine}>BCE : {company.bceNumber}</Text>}
            <Text style={styles.blockLine}>{company.email}</Text>
            {company.phone && <Text style={styles.blockLine}>{company.phone}</Text>}
          </View>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Destinataire</Text>
            <Text style={styles.blockName}>{data.company.name}</Text>
            {data.company.street && <Text style={styles.blockLine}>{data.company.street}</Text>}
            {(data.company.postalCode || data.company.city) && (
              <Text style={styles.blockLine}>
                {data.company.postalCode ?? ""} {data.company.city ?? ""}
              </Text>
            )}
            {data.company.country && <Text style={styles.blockLine}>{data.company.country}</Text>}
            {data.company.vatNumber && (
              <Text style={styles.blockLine}>TVA : {data.company.vatNumber}</Text>
            )}
            {data.contacts && data.contacts.length > 0 && (
              <Text style={[styles.blockLine, { marginTop: 4 }]}>
                À l'attention de : {data.contacts[0].firstName} {data.contacts[0].lastName}
              </Text>
            )}
          </View>
        </View>

        {/* INFO BAR */}
        <View style={styles.infoBox}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Objet</Text>
            <Text style={styles.infoValue}>{data.title}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Validité</Text>
            <Text style={styles.infoValue}>{validityDate}</Text>
          </View>
        </View>

        {data.description && (
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sectionTitle}>Description de la prestation</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.5, color: colors.ink }}>
              {data.description}
            </Text>
          </View>
        )}

        {/* LIGNES */}
        <Text style={styles.sectionTitle}>Détail du devis</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>Unité</Text>
            <Text style={styles.colPrice}>PU HTVA</Text>
            <Text style={styles.colTotal}>Total HTVA</Text>
          </View>
          {data.lines.map((line, i) => (
            <View
              key={i}
              style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
            >
              <Text style={styles.colDesc}>{line.description}</Text>
              <Text style={styles.colQty}>{fmtQty(line.quantity)}</Text>
              <Text style={styles.colUnit}>{line.unit}</Text>
              <Text style={styles.colPrice}>{fmtEur(line.unitSellPrice)}</Text>
              <Text style={styles.colTotal}>{fmtEur(line.totalSell)}</Text>
            </View>
          ))}
        </View>

        {/* TOTAUX */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Total HTVA</Text>
              <Text>{fmtEur(totalHt)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>TVA ({vatRate}%)</Text>
              <Text>{fmtEur(vatAmount)}</Text>
            </View>
            <View style={styles.totalRowGrand}>
              <Text>Total TTC</Text>
              <Text>{fmtEur(totalTtc)}</Text>
            </View>
          </View>
        </View>

        {/* TRANCHES */}
        {data.milestones.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.sectionTitle}>Modalités de facturation</Text>
            {data.milestones.map((m, i) => (
              <View key={i} style={styles.milestoneRow}>
                <Text>
                  {m.label}
                  {m.expectedAt && `  ·  prévu le ${fmtDate(m.expectedAt)}`}
                  {m.percentage && `  ·  ${fmtQty(m.percentage)}%`}
                </Text>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{fmtEur(m.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* MENTIONS LÉGALES */}
        <View style={styles.legalBlock}>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3, color: colors.ink }}>
            Conditions
          </Text>
          {company.legalNotice && company.legalNotice.trim() ? (
            <Text>{company.legalNotice}</Text>
          ) : (
            <Text>
              • Devis valable {data.expectedDecisionAt ? `jusqu'au ${fmtDate(data.expectedDecisionAt)}` : `${validityDays} jours`} à compter de la date d'émission.{"\n"}
              • Acceptation : bon pour accord daté et signé à renvoyer par email à {company.email}.{"\n"}
              • Paiement : {paymentDays} jours fin de mois à compter de la date de facture, par virement sur IBAN {company.iban}{company.bic ? ` (BIC ${company.bic})` : ""}.{"\n"}
              • Pénalités de retard : taux légal belge (loi du 02/08/2002), sans mise en demeure préalable.{"\n"}
              • Litiges : tribunaux compétents, droit belge applicable.
            </Text>
          )}
        </View>

        {/* FOOTER */}
        <View style={styles.footer} fixed>
          <Text>
            {company.legalName} · {company.vatNumber} · {company.iban}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
