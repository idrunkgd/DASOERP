/**
 * Template PDF « Note de frais » à envoyer au comptable. Une page
 * simple avec toutes les infos comptables (date, catégorie, description,
 * HTVA / TVA / TTC, mission éventuelle) + le ticket scanné en dessous.
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { BRAND_COLORS as C, DasolabsIcon } from "./dasolabs-brand";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32, paddingBottom: 40, paddingHorizontal: 36,
    fontSize: 10, fontFamily: "Helvetica", color: C.ink
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 10, marginBottom: 16
  },
  brandRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName:  { fontSize: 14, fontWeight: 700, color: C.ink },
  brandTag:   { fontSize: 8, color: C.muted },
  title:      { fontSize: 16, fontWeight: 700, color: C.accent },
  ref:        { fontSize: 8, color: C.muted, marginTop: 2 },
  section:    { marginBottom: 12 },
  sectionH:   { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: C.muted, marginBottom: 4 },
  grid:       { flexDirection: "row", gap: 24 },
  gridCol:    { flex: 1 },
  field:      { marginBottom: 6 },
  fieldLabel: { fontSize: 8, color: C.muted, marginBottom: 1 },
  fieldValue: { fontSize: 10, color: C.ink },
  totals: {
    marginTop: 10, borderTopWidth: 1, borderTopColor: C.divider, paddingTop: 8,
    flexDirection: "row", justifyContent: "flex-end"
  },
  totalBlock:  { minWidth: 200 },
  totalLine:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalLabel:  { color: C.muted },
  totalValue:  { fontWeight: 700 },
  totalTtc:    {
    marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.divider,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center"
  },
  totalTtcVal: { fontSize: 14, fontWeight: 700, color: C.accent },
  ticket:      { marginTop: 20, alignItems: "center" },
  ticketH:     { fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: C.muted, marginBottom: 6, alignSelf: "flex-start" },
  ticketImg:   { maxWidth: 380, maxHeight: 480, objectFit: "contain" },
  footer:      { position: "absolute", bottom: 18, left: 36, right: 36, fontSize: 7, color: C.muted, textAlign: "center" }
});

const CATEGORY_FR: Record<string, string> = {
  TRANSPORT: "Transport",
  MEAL: "Repas",
  ACCOMMODATION: "Hébergement",
  SUPPLIES: "Fournitures",
  SOFTWARE: "Logiciel",
  TRAINING: "Formation",
  OTHER: "Autre"
};

const STATUS_FR: Record<string, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
  PAID: "Remboursée"
};

export type ExpensePdfData = {
  id: string;
  date: string;              // ISO
  category: string;
  description: string;
  amountHt: number;
  vatAmount: number;
  vatRate: number;
  amountTtc: number;
  status: string;
  authorName: string;
  missionRef?: string | null;
  projectRef?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  receiptDataUri?: string | null;
  notes?: string | null;
};

function fmt(n: number) {
  return n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) + " €";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-BE", {
    year: "numeric", month: "long", day: "numeric"
  });
}

export function ExpensePdf({ data }: { data: ExpensePdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <DasolabsIcon width={28} height={28} />
            <View>
              <Text style={styles.brandName}>Dasolabs</Text>
              <Text style={styles.brandTag}>Digitalization expert</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.title}>NOTE DE FRAIS</Text>
            <Text style={styles.ref}>Ref. NDF-{data.id.slice(-8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Champs */}
        <View style={styles.grid}>
          <View style={styles.gridCol}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Auteur</Text>
              <Text style={styles.fieldValue}>{data.authorName}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Date de la dépense</Text>
              <Text style={styles.fieldValue}>{fmtDate(data.date)}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Catégorie</Text>
              <Text style={styles.fieldValue}>{CATEGORY_FR[data.category] ?? data.category}</Text>
            </View>
            {(data.missionRef || data.projectRef) && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Rattaché à</Text>
                <Text style={styles.fieldValue}>{data.missionRef ?? data.projectRef}</Text>
              </View>
            )}
          </View>
          <View style={styles.gridCol}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Statut</Text>
              <Text style={styles.fieldValue}>{STATUS_FR[data.status] ?? data.status}</Text>
            </View>
            {data.approvedByName && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Approuvée par</Text>
                <Text style={styles.fieldValue}>
                  {data.approvedByName}{data.approvedAt ? ` — ${fmtDate(data.approvedAt)}` : ""}
                </Text>
              </View>
            )}
            {data.paidAt && (
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Remboursée le</Text>
                <Text style={styles.fieldValue}>{fmtDate(data.paidAt)}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionH}>Description</Text>
          <Text style={styles.fieldValue}>{data.description}</Text>
          {data.notes && (
            <Text style={{ ...styles.fieldValue, marginTop: 4, color: C.muted, fontSize: 9 }}>
              {data.notes}
            </Text>
          )}
        </View>

        {/* Totaux */}
        <View style={styles.totals}>
          <View style={styles.totalBlock}>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>Montant HTVA</Text>
              <Text style={styles.totalValue}>{fmt(data.amountHt)}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.totalLabel}>TVA ({data.vatRate}%)</Text>
              <Text style={styles.totalValue}>{fmt(data.vatAmount)}</Text>
            </View>
            <View style={styles.totalTtc}>
              <Text style={{ ...styles.totalLabel, fontWeight: 700, color: C.ink }}>Total TTC</Text>
              <Text style={styles.totalTtcVal}>{fmt(data.amountTtc)}</Text>
            </View>
          </View>
        </View>

        {/* Ticket */}
        {data.receiptDataUri && (
          <View style={styles.ticket}>
            <Text style={styles.ticketH}>Justificatif</Text>
            <Image src={data.receiptDataUri} style={styles.ticketImg} />
          </View>
        )}

        <Text style={styles.footer}>
          Dasolabs — Note de frais générée automatiquement · {fmtDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
