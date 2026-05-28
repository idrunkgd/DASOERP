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
  /// Options du devis (page 2bis du PDF si non vide)
  options?: {
    name: string;
    description?: string | null;
    totalSell: number | string;
    lines: {
      description: string;
      quantity: number | string;
      unit: string;
      unitSellPrice: number | string;
      totalSell: number | string;
    }[];
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

  // ───────────────────────────────────────────────────────────
  // HEADER + FOOTER réutilisés sur les 3 pages
  // ───────────────────────────────────────────────────────────
  const PageHeader = ({ subtitle }: { subtitle: string }) => (
    <View style={styles.header}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <DasolabsIcon size={32} color={colors.ink} />
        <Text style={styles.brand}>{company.legalName.split(" ")[0] || "DASOLABS"}</Text>
      </View>
      <View>
        <Text style={styles.docTitle}>DEVIS</Text>
        <Text style={styles.docMeta}>{data.reference}</Text>
        <Text style={styles.docMeta}>{subtitle}</Text>
      </View>
    </View>
  );

  const PageFooter = () => (
    <View style={styles.footer} fixed>
      <Text>
        {company.legalName} · {company.vatNumber} · {company.iban}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );

  return (
    <Document
      title={`Devis ${data.reference}`}
      author={company.legalName}
      creator="Dasohub"
      producer="Dasohub"
    >
      {/* ═════════════════════════════════════════════════════════
          PAGE 1 — Introduction + Description
          ═════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader subtitle={`Émis le ${fmtDate(data.sentAt ?? new Date())}`} />

        {/* Émetteur / Destinataire */}
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

        {/* Info bar */}
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

        {/* Description — toujours présente sur la page 1 */}
        <Text style={styles.sectionTitle}>Description de la prestation</Text>
        {data.description ? (
          <Text style={{ fontSize: 10, lineHeight: 1.5, color: colors.ink }}>
            {data.description}
          </Text>
        ) : (
          <Text style={{ fontSize: 9, lineHeight: 1.5, color: colors.grey, fontStyle: "italic" }}>
            Le présent devis détaille l'ensemble des prestations proposées à {data.company.name}
            dans le cadre de « {data.title} ». Le détail des lignes et postes est précisé en page
            suivante, et les modalités de facturation ainsi que les conditions générales sont
            détaillées en page 3.
          </Text>
        )}

        <View style={{ marginTop: 18, padding: 10, backgroundColor: colors.light, borderLeft: `3 solid ${colors.accent}` }}>
          <Text style={{ fontSize: 9, color: colors.ink, lineHeight: 1.5 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Synthèse :</Text>
            {" "}Montant total HTVA{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{fmtEur(totalHt)}</Text>
            {" "}— TTC{" "}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{fmtEur(totalTtc)}</Text>
            {" · "}{data.lines.length} ligne(s) au devis
            {data.milestones.length > 0 ? ` · ${data.milestones.length} tranche(s) de facturation` : ""}.
          </Text>
        </View>

        <PageFooter />
      </Page>

      {/* ═════════════════════════════════════════════════════════
          PAGE 2 — Détail des lignes + totaux
          ═════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader subtitle="Détail du devis" />

        <Text style={styles.sectionTitle}>Détail du devis</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>Unité</Text>
            <Text style={styles.colPrice}>PU HTVA</Text>
            <Text style={styles.colTotal}>Total HTVA</Text>
          </View>
          {data.lines.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={{ fontStyle: "italic", color: colors.grey, textAlign: "center", flex: 1 }}>
                Aucune ligne au devis.
              </Text>
            </View>
          ) : (
            data.lines.map((line, i) => (
              <View
                key={i}
                style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                wrap={false}
              >
                <Text style={styles.colDesc}>{line.description}</Text>
                <Text style={styles.colQty}>{fmtQty(line.quantity)}</Text>
                <Text style={styles.colUnit}>{line.unit}</Text>
                <Text style={styles.colPrice}>{fmtEur(line.unitSellPrice)}</Text>
                <Text style={styles.colTotal}>{fmtEur(line.totalSell)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Totaux */}
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

        <PageFooter />
      </Page>

      {/* ═════════════════════════════════════════════════════════
          PAGE 2bis — Options (uniquement si présentes)
          ═════════════════════════════════════════════════════════ */}
      {data.options && data.options.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PageHeader subtitle="Options & suppléments" />

          <Text style={styles.sectionTitle}>Options proposées</Text>
          <Text style={{ fontSize: 9, color: colors.grey, lineHeight: 1.5, marginBottom: 14 }}>
            Les options ci-dessous sont proposées en supplément du devis principal et ne sont pas
            incluses dans le total HTVA de la page précédente. Chaque option peut être commandée
            indépendamment lors de la confirmation du devis.
          </Text>

          {data.options.map((opt, i) => (
            <View key={i} style={{ marginBottom: 18 }} wrap={false}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  backgroundColor: colors.light,
                  padding: 6,
                  borderLeft: `3 solid ${colors.accent}`
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.ink }}>
                  {i + 1}. {opt.name}
                </Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: colors.indigo }}>
                  {fmtEur(opt.totalSell)} HTVA
                </Text>
              </View>
              {opt.description && (
                <Text style={{ fontSize: 9, color: colors.ink, marginTop: 4, lineHeight: 1.4 }}>
                  {opt.description}
                </Text>
              )}
              {opt.lines.length > 0 && (
                <View style={[styles.table, { marginTop: 6 }]}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.colDesc}>Description</Text>
                    <Text style={styles.colQty}>Qté</Text>
                    <Text style={styles.colUnit}>Unité</Text>
                    <Text style={styles.colPrice}>PU HTVA</Text>
                    <Text style={styles.colTotal}>Total HTVA</Text>
                  </View>
                  {opt.lines.map((line, j) => (
                    <View
                      key={j}
                      style={j % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                    >
                      <Text style={styles.colDesc}>{line.description}</Text>
                      <Text style={styles.colQty}>{fmtQty(line.quantity)}</Text>
                      <Text style={styles.colUnit}>{line.unit}</Text>
                      <Text style={styles.colPrice}>{fmtEur(line.unitSellPrice)}</Text>
                      <Text style={styles.colTotal}>{fmtEur(line.totalSell)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}

          <PageFooter />
        </Page>
      )}

      {/* ═════════════════════════════════════════════════════════
          PAGE 3 — Modalités de facturation + Conditions
          ═════════════════════════════════════════════════════════ */}
      <Page size="A4" style={styles.page}>
        <PageHeader subtitle="Modalités & conditions" />

        <Text style={styles.sectionTitle}>Modalités de facturation</Text>
        {data.milestones.length > 0 ? (
          <View style={{ marginBottom: 18 }}>
            {/* Header tableau identique à celui du MilestonesEditor sur la page offre */}
            <View style={styles.tableHeader}>
              <Text style={{ flex: 4 }}>Libellé</Text>
              <Text style={{ flex: 1.6, textAlign: "right" }}>Montant HT</Text>
              <Text style={{ flex: 0.9, textAlign: "right" }}>%</Text>
              <Text style={{ flex: 1.6, textAlign: "right" }}>Date prévue</Text>
            </View>
            {data.milestones.map((m, i) => {
              const pct =
                m.percentage != null && Number(m.percentage) > 0
                  ? Number(m.percentage)
                  : totalHt > 0
                    ? (Number(m.amount) / totalHt) * 100
                    : 0;
              return (
                <View
                  key={i}
                  style={i % 2 === 1 ? [styles.tableRow, styles.tableRowAlt] : styles.tableRow}
                  wrap={false}
                >
                  <Text style={{ flex: 4 }}>{m.label}</Text>
                  <Text style={{ flex: 1.6, textAlign: "right", fontFamily: "Helvetica-Bold" }}>
                    {fmtEur(m.amount)}
                  </Text>
                  <Text style={{ flex: 0.9, textAlign: "right" }}>
                    {pct > 0 ? `${pct.toFixed(1)}%` : "—"}
                  </Text>
                  <Text style={{ flex: 1.6, textAlign: "right" }}>
                    {m.expectedAt ? fmtDate(m.expectedAt) : "—"}
                  </Text>
                </View>
              );
            })}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingTop: 6,
                marginTop: 4,
                borderTop: `1 solid ${colors.indigo}`
              }}
            >
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total à facturer</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{fmtEur(totalHt)} HTVA</Text>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: colors.grey, fontStyle: "italic", marginBottom: 18 }}>
            Facturation à terme à la livraison de la prestation, sauf accord spécifique.
          </Text>
        )}

        <Text style={styles.sectionTitle}>Conditions générales</Text>
        <View style={styles.legalBlock}>
          {company.legalNotice && company.legalNotice.trim() ? (
            <Text>{company.legalNotice}</Text>
          ) : (
            <Text>
              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Validité du devis</Text>{"\n"}
              Devis valable {data.expectedDecisionAt ? `jusqu'au ${fmtDate(data.expectedDecisionAt)}` : `${validityDays} jours`} à compter de la date d'émission.{"\n"}{"\n"}

              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Acceptation</Text>{"\n"}
              Bon pour accord daté et signé à renvoyer par email à {company.email}, ou par courrier postal à l'adresse du siège.{"\n"}{"\n"}

              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Modalités de paiement</Text>{"\n"}
              Paiement à {paymentDays} jours fin de mois à compter de la date de facture, par virement sur le compte IBAN {company.iban}{company.bic ? ` (BIC ${company.bic})` : ""}.{"\n"}{"\n"}

              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Pénalités de retard</Text>{"\n"}
              En cas de retard de paiement, des intérêts au taux légal belge (loi du 02/08/2002) seront appliqués sans mise en demeure préalable, ainsi qu'une indemnité forfaitaire pour frais de recouvrement.{"\n"}{"\n"}

              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Litiges</Text>{"\n"}
              Tout litige sera soumis aux tribunaux compétents de l'arrondissement du siège du prestataire. Le droit belge est seul applicable.{"\n"}{"\n"}

              <Text style={{ fontFamily: "Helvetica-Bold", color: colors.ink }}>Propriété intellectuelle</Text>{"\n"}
              Les livrables restent la propriété de {company.legalName} jusqu'au paiement intégral du devis. Une fois payés, ils sont transférés au client sauf accord contraire écrit.
            </Text>
          )}
        </View>

        {/* Bloc signature */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 22, gap: 30 }}>
          <View style={{ flex: 1, borderTop: `1 solid ${colors.border}`, paddingTop: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.ink }}>
              Bon pour accord
            </Text>
            <Text style={{ fontSize: 8, color: colors.grey, marginTop: 2 }}>
              Nom, fonction, date et signature du client
            </Text>
            <View style={{ height: 50 }} />
          </View>
          <View style={{ flex: 1, borderTop: `1 solid ${colors.border}`, paddingTop: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: colors.ink }}>
              Le prestataire
            </Text>
            <Text style={{ fontSize: 8, color: colors.grey, marginTop: 2 }}>
              {company.legalName} · {fmtDate(new Date())}
            </Text>
          </View>
        </View>

        <PageFooter />
      </Page>
    </Document>
  );
}
