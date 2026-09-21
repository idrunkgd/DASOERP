/**
 * Template PDF « Timesheet hebdomadaire » — impression / archivage / signature.
 *
 * Une page A4 portrait avec :
 * - En-tête : logo + nom consultant + période
 * - Tableau : 1 ligne par cible (projet/mission/centre de coût), 7 colonnes jours
 * - Totaux ligne (droite) + total colonne (bas) + total semaine
 * - Statut par entrée (draft/submitted/approved/rejected) via code couleur
 * - Section signatures (consultant + valideur)
 * - Footer : généré le X par Y
 *
 * Le PDF est généré côté serveur via @react-pdf/renderer, sans dépendance
 * à un browser (utilisable en cron, envoi par mail, archivage).
 */
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { BRAND_COLORS as C, DasolabsIcon } from "./dasolabs-brand";

export type TimesheetPdfEntry = {
  targetLabel: string;      // "PRJ-2024-001 — Migration Werum"
  targetType: "PRJ" | "MIS" | "CC";
  targetClient?: string;    // "UCB"
  daysHours: number[];      // [Lundi..Dimanche] · null si pas d'entrée
  daysStatus: (string | null)[]; // ["APPROVED", null, "DRAFT", ...]
  rowTotal: number;
};

export type TimesheetPdfData = {
  consultantName: string;
  consultantEmail: string;
  consultantRole: string;
  weekStart: Date;
  weekEnd: Date;
  rows: TimesheetPdfEntry[];
  dayTotals: number[];    // 7 valeurs · lun→dim
  weekTotal: number;
  generatedBy: string;
  generatedAt: Date;
  /** Optionnel : bloc de commentaires / notes libre */
  notes?: string;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32,
    fontSize: 9, fontFamily: "Helvetica", color: C.ink
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 10, marginBottom: 14
  },
  brandRow:   { flexDirection: "row", alignItems: "center", gap: 8 },
  brandName:  { fontSize: 14, fontWeight: 700, color: C.ink },
  brandTag:   { fontSize: 8, color: C.grey },
  title:      { fontSize: 15, fontWeight: 700, color: C.accent, textAlign: "right" },
  subtitle:   { fontSize: 8, color: C.grey, marginTop: 2, textAlign: "right" },

  // Bloc infos consultant
  infoRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 12,
                 padding: 8, backgroundColor: C.light, borderRadius: 3 },
  infoCol:     { flex: 1 },
  infoLabel:   { fontSize: 7, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue:   { fontSize: 10, color: C.ink, marginTop: 2, fontWeight: 700 },

  // Tableau
  table:       { marginBottom: 12 },
  tableRow:    { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, minHeight: 22 },
  tableRowHead:{ backgroundColor: C.ink, borderBottomColor: C.ink },
  tableRowFoot:{ backgroundColor: C.light, borderTopWidth: 1, borderTopColor: C.ink,
                 borderBottomWidth: 0, fontWeight: 700 },
  cellTarget:  { flex: 3, paddingHorizontal: 5, paddingVertical: 4, justifyContent: "center" },
  cellDay:     { flex: 1, paddingHorizontal: 3, paddingVertical: 4,
                 justifyContent: "center", alignItems: "center",
                 borderLeftWidth: 0.5, borderLeftColor: C.border },
  cellDayWknd: { backgroundColor: C.light },
  cellTotal:   { flex: 1, paddingHorizontal: 3, paddingVertical: 4,
                 justifyContent: "center", alignItems: "flex-end",
                 borderLeftWidth: 0.5, borderLeftColor: C.border,
                 backgroundColor: C.light },
  cellHead:    { color: "#fff", fontSize: 8, fontWeight: 700, textTransform: "uppercase" },
  cellText:    { fontSize: 9, color: C.ink },
  cellTextSm:  { fontSize: 7, color: C.grey, marginTop: 1 },
  cellHours:   { fontSize: 10, color: C.ink, fontWeight: 700 },
  cellHoursMuted: { fontSize: 9, color: C.grey },
  badge:       { paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, fontSize: 6,
                 color: "#fff", alignSelf: "flex-start", marginTop: 1 },
  badgePRJ:    { backgroundColor: "#3b82f6" },
  badgeMIS:    { backgroundColor: "#f59e0b" },
  badgeCC:     { backgroundColor: "#6b7280" },
  statusApproved:  { color: "#059669" },
  statusSubmitted: { color: "#4f46e5" },
  statusRejected:  { color: "#dc2626" },
  statusDraft:     { color: C.ink },

  // Récap
  recap:         { flexDirection: "row", justifyContent: "flex-end", marginBottom: 20 },
  recapBox:      { padding: 10, backgroundColor: C.accent, borderRadius: 3, minWidth: 160 },
  recapLabel:    { fontSize: 8, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  recapValue:    { fontSize: 20, color: "#fff", fontWeight: 700, marginTop: 2 },

  // Notes
  notesBlock:   { marginBottom: 20, padding: 10, borderWidth: 0.5, borderColor: C.border,
                  borderRadius: 3 },
  notesH:       { fontSize: 8, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5,
                  marginBottom: 4 },
  notesTxt:     { fontSize: 9, color: C.ink, lineHeight: 1.4 },

  // Signatures
  sigs:         { flexDirection: "row", gap: 20, marginTop: 20 },
  sigBox:       { flex: 1, borderTopWidth: 1, borderTopColor: C.ink, paddingTop: 6, minHeight: 80 },
  sigLabel:     { fontSize: 8, color: C.grey, textTransform: "uppercase", letterSpacing: 0.5 },
  sigName:      { fontSize: 9, color: C.ink, marginTop: 2, fontWeight: 700 },
  sigDate:      { fontSize: 8, color: C.grey, marginTop: 20 },

  footer:      { position: "absolute", bottom: 18, left: 32, right: 32,
                 fontSize: 7, color: C.grey, textAlign: "center",
                 borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 }
});

function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("fr-BE", { weekday: "short", day: "2-digit", month: "short" });
}

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function TimesheetPdf({ data }: { data: TimesheetPdfData }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(data.weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <DasolabsIcon size={30} color={C.ink} />
            <View>
              <Text style={styles.brandName}>Dasolabs</Text>
              <Text style={styles.brandTag}>Rapport de temps hebdomadaire</Text>
            </View>
          </View>
          <View>
            <Text style={styles.title}>Timesheet</Text>
            <Text style={styles.subtitle}>
              Semaine du {fmtDate(data.weekStart)} au {fmtDate(days[6])}
            </Text>
          </View>
        </View>

        {/* INFOS CONSULTANT */}
        <View style={styles.infoRow}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Consultant</Text>
            <Text style={styles.infoValue}>{data.consultantName}</Text>
            <Text style={styles.cellTextSm}>{data.consultantEmail}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Rôle</Text>
            <Text style={styles.infoValue}>{data.consultantRole}</Text>
          </View>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Total semaine</Text>
            <Text style={{ ...styles.infoValue, color: C.accent, fontSize: 14 }}>
              {data.weekTotal.toFixed(2)}h
            </Text>
          </View>
        </View>

        {/* TABLEAU */}
        <View style={styles.table}>
          {/* Header */}
          <View style={[styles.tableRow, styles.tableRowHead]}>
            <View style={styles.cellTarget}>
              <Text style={styles.cellHead}>Projet / Mission / Centre de coût</Text>
            </View>
            {DAY_LABELS.map((label, i) => (
              <View key={i} style={styles.cellDay}>
                <Text style={styles.cellHead}>{label}</Text>
                <Text style={{ ...styles.cellHead, fontSize: 7 }}>
                  {days[i].getDate().toString().padStart(2, "0")}/{(days[i].getMonth() + 1).toString().padStart(2, "0")}
                </Text>
              </View>
            ))}
            <View style={styles.cellTotal}>
              <Text style={styles.cellHead}>Total</Text>
            </View>
          </View>

          {/* Lignes */}
          {data.rows.length === 0 ? (
            <View style={styles.tableRow}>
              <View style={{ flex: 11, padding: 16, alignItems: "center" }}>
                <Text style={{ ...styles.cellTextSm, fontStyle: "italic" }}>
                  Aucune entrée saisie pour cette semaine.
                </Text>
              </View>
            </View>
          ) : (
            data.rows.map((row, ri) => (
              <View key={ri} style={styles.tableRow}>
                <View style={styles.cellTarget}>
                  <Text style={styles.cellText}>{row.targetLabel}</Text>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center", marginTop: 2 }}>
                    <Text style={[
                      styles.badge,
                      row.targetType === "PRJ" ? styles.badgePRJ : row.targetType === "MIS" ? styles.badgeMIS : styles.badgeCC
                    ]}>
                      {row.targetType === "PRJ" ? "Projet" : row.targetType === "MIS" ? "Mission" : "Centre coût"}
                    </Text>
                    {row.targetClient && <Text style={styles.cellTextSm}>· {row.targetClient}</Text>}
                  </View>
                </View>
                {row.daysHours.map((h, di) => {
                  const isWknd = di === 5 || di === 6;
                  const status = row.daysStatus[di];
                  const statusStyle = status === "APPROVED" ? styles.statusApproved
                    : status === "SUBMITTED" ? styles.statusSubmitted
                    : status === "REJECTED" ? styles.statusRejected
                    : styles.statusDraft;
                  return (
                    <View key={di} style={isWknd ? [styles.cellDay, styles.cellDayWknd] : styles.cellDay}>
                      {h > 0 ? (
                        <>
                          <Text style={[styles.cellHours, statusStyle]}>{h.toFixed(2)}</Text>
                          {status && status !== "DRAFT" && (
                            <Text style={{ ...styles.cellTextSm, fontSize: 6 }}>
                              {status === "APPROVED" ? "✓" : status === "SUBMITTED" ? "⟳" : status === "REJECTED" ? "✗" : ""}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text style={styles.cellHoursMuted}>—</Text>
                      )}
                    </View>
                  );
                })}
                <View style={styles.cellTotal}>
                  <Text style={styles.cellHours}>{row.rowTotal.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}

          {/* Footer totaux par jour */}
          <View style={[styles.tableRow, styles.tableRowFoot]}>
            <View style={styles.cellTarget}>
              <Text style={{ ...styles.cellText, fontWeight: 700, textAlign: "right" }}>Total / jour</Text>
            </View>
            {data.dayTotals.map((t, i) => {
              const isWknd = i === 5 || i === 6;
              return (
                <View key={i} style={isWknd ? [styles.cellDay, styles.cellDayWknd] : styles.cellDay}>
                  <Text style={styles.cellHours}>{t > 0 ? t.toFixed(2) : "—"}</Text>
                </View>
              );
            })}
            <View style={styles.cellTotal}>
              <Text style={{ ...styles.cellHours, color: C.accent }}>{data.weekTotal.toFixed(2)}h</Text>
            </View>
          </View>
        </View>

        {/* Légende statuts */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 12, alignItems: "center" }}>
          <Text style={{ ...styles.cellTextSm, fontWeight: 700 }}>Légende :</Text>
          <Text style={[styles.cellTextSm, styles.statusApproved]}>✓ Validé</Text>
          <Text style={[styles.cellTextSm, styles.statusSubmitted]}>⟳ Soumis</Text>
          <Text style={[styles.cellTextSm, styles.statusDraft]}>• Brouillon</Text>
          <Text style={[styles.cellTextSm, styles.statusRejected]}>✗ Refusé</Text>
        </View>

        {/* Notes optionnelles */}
        {data.notes && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesH}>Notes / Commentaires</Text>
            <Text style={styles.notesTxt}>{data.notes}</Text>
          </View>
        )}

        {/* Signatures */}
        <View style={styles.sigs}>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>Signature consultant</Text>
            <Text style={styles.sigName}>{data.consultantName}</Text>
            <Text style={styles.sigDate}>Date : ___________</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigLabel}>Signature valideur / manager</Text>
            <Text style={styles.sigName}>&nbsp;</Text>
            <Text style={styles.sigDate}>Date : ___________</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Généré le {fmtDate(data.generatedAt)} à {data.generatedAt.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })} par {data.generatedBy} · Dasolabs Timesheet Report · Document confidentiel
        </Text>
      </Page>
    </Document>
  );
}
