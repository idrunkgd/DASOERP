/**
 * Template PDF « Bon de commande fournisseur » (Purchase Order) aux couleurs
 * Dasolabs. Une seule page avec header charte, encart fournisseur/livraison,
 * tableau des lignes, total, notes, mentions légales.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CompanyInfo } from "./company-info";
import { DEFAULT_COMPANY_INFO } from "./company-info";
import { BRAND_COLORS as C } from "./dasolabs-brand";

/**
 * Helper : @react-pdf/renderer avec Helvetica ne rend pas les espaces
 * insécables Unicode. Remplace NBSP par un espace normal.
 */
function pdfSafe(s: string | number | null | undefined): string {
  if (s == null) return "";
  return String(s).replace(/ | /g, " ");
}

function fmtMoney(n: number, currency = "EUR"): string {
  const raw = new Intl.NumberFormat("fr-BE", {
    style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(n);
  return pdfSafe(raw);
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return pdfSafe(new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "long", year: "numeric" }).format(d));
}

const s = StyleSheet.create({
  page: {
    paddingTop: 36, paddingBottom: 50, paddingHorizontal: 36,
    fontSize: 10, fontFamily: "Helvetica", color: C.ink
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingBottom: 12, borderBottom: `2 solid ${C.ink}`, marginBottom: 20
  },
  brandName: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.ink },
  brandTagline: { fontSize: 7, color: C.grey, marginTop: 2 },
  docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.accent, textAlign: "right" },
  docRef: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.ink, marginTop: 4, textAlign: "right" },
  docDate: { fontSize: 8, color: C.grey, marginTop: 2, textAlign: "right" },

  boxRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  box: {
    width: "48%", padding: 10, borderRadius: 4,
    backgroundColor: C.light, borderLeft: `3 solid ${C.accent}`
  },
  boxTitle: {
    fontSize: 7, color: C.grey, marginBottom: 5,
    textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold"
  },
  boxLine: { fontSize: 9, color: C.ink, marginTop: 1.5 },
  boxStrong: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.ink },

  sectionTitle: {
    fontSize: 10, fontFamily: "Helvetica-Bold", color: C.ink,
    textTransform: "uppercase", letterSpacing: 0.5,
    borderBottom: `1 solid ${C.border}`, paddingBottom: 3, marginBottom: 8, marginTop: 6
  },

  // Tableau
  tHeadRow: { flexDirection: "row", backgroundColor: C.ink, paddingVertical: 6, paddingHorizontal: 6 },
  tHead: { color: "#FFFFFF", fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3 },
  tRow: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottom: `0.5 solid ${C.border}` },
  tRowAlt: { backgroundColor: C.light },
  cLabel: { width: "42%", paddingRight: 6, fontSize: 9 },
  cQty:   { width: "10%", textAlign: "right", fontSize: 9 },
  cUnit:  { width: "8%",  textAlign: "left",  fontSize: 8, color: C.grey },
  cPrice: { width: "15%", textAlign: "right", fontSize: 9 },
  cVat:   { width: "10%", textAlign: "right", fontSize: 9, color: C.grey },
  cTotal: { width: "15%", textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },

  totalsBlock: { marginTop: 12, alignSelf: "flex-end", width: "45%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9, color: C.grey },
  totalValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.ink },
  totalTtcRow: {
    flexDirection: "row", justifyContent: "space-between",
    marginTop: 4, paddingVertical: 6, paddingHorizontal: 8,
    backgroundColor: C.accent, borderRadius: 3
  },
  totalTtcLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  totalTtcValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },

  notesBlock: { marginTop: 20, padding: 10, backgroundColor: C.light, borderRadius: 4 },
  notesText: { fontSize: 9, color: C.ink, lineHeight: 1.5 },

  footer: {
    position: "absolute", bottom: 20, left: 36, right: 36,
    paddingTop: 6, borderTopWidth: 0.5, borderTopColor: C.border
  },
  footerLine: { fontSize: 7.5, color: C.grey, textAlign: "center", lineHeight: 1.4 }
});

export interface PurchaseOrderPdfData {
  reference: string;
  title: string;
  status: string;
  currency: string;
  createdAt: Date;
  sentAt: Date | null;
  deliveryDate: Date | null;
  deliveryAddress: string | null;
  paymentTerms: string | null;
  notes: string | null;
  supplier: {
    name: string;
    vatNumber?: string | null;
    street?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
  };
  lines: Array<{
    label: string;
    description: string | null;
    quantity: number;
    unit: string | null;
    unitPriceHt: number;
    vatRate: number;
    totalHt: number;
  }>;
  totalHt: number;
  totalVat: number;
  totalTtc: number;
  companyInfo: CompanyInfo;
}

function LegalFooter({ companyInfo }: { companyInfo: CompanyInfo }) {
  const parts1: string[] = [];
  if (companyInfo.legalName) parts1.push(companyInfo.legalName);
  const addr = [companyInfo.street, `${companyInfo.postalCode} ${companyInfo.city}`, companyInfo.country]
    .filter(Boolean).join(", ");
  if (addr) parts1.push(addr);
  const idParts: string[] = [];
  if (companyInfo.bceNumber) idParts.push(`BCE ${companyInfo.bceNumber}`);
  if (companyInfo.vatNumber) idParts.push(`TVA ${companyInfo.vatNumber}`);
  const bankParts: string[] = [];
  if (companyInfo.iban) bankParts.push(`IBAN ${companyInfo.iban}`);
  if (companyInfo.bic)  bankParts.push(`BIC ${companyInfo.bic}`);
  const contactParts: string[] = [];
  if (companyInfo.phone)   contactParts.push(companyInfo.phone);
  if (companyInfo.email)   contactParts.push(companyInfo.email);
  if (companyInfo.website) contactParts.push(companyInfo.website);

  return (
    <View style={s.footer} fixed>
      <Text style={s.footerLine}>{pdfSafe(parts1.join(" · "))}</Text>
      {idParts.length > 0 && <Text style={s.footerLine}>{pdfSafe(idParts.join(" · "))}</Text>}
      {bankParts.length > 0 && <Text style={s.footerLine}>{pdfSafe(bankParts.join(" · "))}</Text>}
      {contactParts.length > 0 && <Text style={s.footerLine}>{pdfSafe(contactParts.join(" · "))}</Text>}
    </View>
  );
}

export function PurchaseOrderPdfDocument({ data }: { data: PurchaseOrderPdfData }) {
  const ci = data.companyInfo ?? DEFAULT_COMPANY_INFO;
  const supplierAddr = [data.supplier.street,
    [data.supplier.postalCode, data.supplier.city].filter(Boolean).join(" "),
    data.supplier.country
  ].filter(Boolean);

  return (
    <Document title={`Bon de commande ${data.reference}`}>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>{pdfSafe(ci.legalName ?? "DASOLABS")}</Text>
            <Text style={s.brandTagline}>Consultance technique — Automation, dev, industrie.</Text>
          </View>
          <View>
            <Text style={s.docTitle}>BON DE COMMANDE</Text>
            <Text style={s.docRef}>{pdfSafe(data.reference)}</Text>
            <Text style={s.docDate}>Émis le {fmtDate(data.createdAt)}</Text>
          </View>
        </View>

        {/* Cartouches */}
        <View style={s.boxRow}>
          <View style={s.box}>
            <Text style={s.boxTitle}>Fournisseur</Text>
            <Text style={s.boxStrong}>{pdfSafe(data.supplier.name)}</Text>
            {supplierAddr.map((line, i) => <Text key={i} style={s.boxLine}>{pdfSafe(line)}</Text>)}
            {data.supplier.vatNumber && <Text style={s.boxLine}>TVA {pdfSafe(data.supplier.vatNumber)}</Text>}
            {data.supplier.contactName && <Text style={[s.boxLine, { marginTop: 5 }]}>À l'attention de {pdfSafe(data.supplier.contactName)}</Text>}
            {data.supplier.contactEmail && <Text style={s.boxLine}>{pdfSafe(data.supplier.contactEmail)}</Text>}
          </View>
          <View style={s.box}>
            <Text style={s.boxTitle}>Livraison</Text>
            <Text style={s.boxLine}><Text style={{ color: C.grey }}>Date souhaitée : </Text>{fmtDate(data.deliveryDate)}</Text>
            {data.deliveryAddress
              ? <Text style={[s.boxLine, { marginTop: 4 }]}>{pdfSafe(data.deliveryAddress)}</Text>
              : <Text style={[s.boxLine, { marginTop: 4 }]}>{pdfSafe([ci.street, `${ci.postalCode} ${ci.city}`].filter(Boolean).join(", "))}</Text>
            }
            {data.paymentTerms && (
              <>
                <Text style={[s.boxTitle, { marginTop: 8 }]}>Paiement</Text>
                <Text style={s.boxLine}>{pdfSafe(data.paymentTerms)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Titre de la commande */}
        <Text style={s.sectionTitle}>Objet — {pdfSafe(data.title)}</Text>

        {/* Tableau des lignes */}
        <View style={s.tHeadRow}>
          <Text style={[s.cLabel, s.tHead]}>Désignation</Text>
          <Text style={[s.cQty,   s.tHead]}>Qté</Text>
          <Text style={[s.cUnit,  s.tHead, { color: "#FFFFFF" }]}>Unité</Text>
          <Text style={[s.cPrice, s.tHead]}>Prix U. HT</Text>
          <Text style={[s.cVat,   s.tHead, { color: "#FFFFFF" }]}>TVA</Text>
          <Text style={[s.cTotal, s.tHead]}>Total HT</Text>
        </View>
        {data.lines.map((l, i) => (
          <View key={i} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]}>
            <View style={s.cLabel}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{pdfSafe(l.label)}</Text>
              {l.description && <Text style={{ fontSize: 8, color: C.grey, marginTop: 2 }}>{pdfSafe(l.description)}</Text>}
            </View>
            <Text style={s.cQty}>{pdfSafe(l.quantity.toString())}</Text>
            <Text style={s.cUnit}>{pdfSafe(l.unit ?? "")}</Text>
            <Text style={s.cPrice}>{fmtMoney(l.unitPriceHt, data.currency)}</Text>
            <Text style={s.cVat}>{pdfSafe(l.vatRate.toString())} %</Text>
            <Text style={s.cTotal}>{fmtMoney(l.totalHt, data.currency)}</Text>
          </View>
        ))}

        {/* Totaux */}
        <View style={s.totalsBlock}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total HT</Text>
            <Text style={s.totalValue}>{fmtMoney(data.totalHt, data.currency)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>TVA</Text>
            <Text style={s.totalValue}>{fmtMoney(data.totalVat, data.currency)}</Text>
          </View>
          <View style={s.totalTtcRow}>
            <Text style={s.totalTtcLabel}>TOTAL TTC</Text>
            <Text style={s.totalTtcValue}>{fmtMoney(data.totalTtc, data.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {data.notes && (
          <View style={s.notesBlock}>
            <Text style={[s.boxTitle, { marginBottom: 4 }]}>Notes / conditions particulières</Text>
            <Text style={s.notesText}>{pdfSafe(data.notes)}</Text>
          </View>
        )}

        <LegalFooter companyInfo={ci} />
      </Page>
    </Document>
  );
}
