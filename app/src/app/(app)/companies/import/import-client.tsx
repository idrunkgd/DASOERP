"use client";
import { useState, useTransition } from "react";
import { importCompaniesCsv, type ImportReport } from "@/server/actions/companies-import";
import { parseCSV } from "@/lib/csv-parse";
import { toast } from "sonner";

export function CompanyImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();

  function onFile(f: File | null) {
    setFile(f); setReport(null);
    if (!f) { setText(""); setPreview(null); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const t = String(reader.result || "");
      setText(t);
      setPreview(parseCSV(t));
    };
    reader.readAsText(f, "utf-8");
  }

  return (
    <div className="space-y-6">
      <section className="card p-6 max-w-3xl">
        <label className="label">Fichier CSV</label>
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} className="input" />
        {file && <p className="text-xs text-midnight-500 mt-2">{file.name} — {(file.size / 1024).toFixed(1)} KB</p>}
      </section>

      {preview && (
        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Aperçu — {preview.rows.length} ligne(s)</h2>
            <button
              disabled={pending || preview.rows.length === 0}
              onClick={() => start(async () => {
                try {
                  const r = await importCompaniesCsv(text);
                  setReport(r);
                  toast.success(`${r.created} créées · ${r.updated} mises à jour · ${r.errors.length} erreurs`);
                } catch (e: any) { toast.error(e.message); }
              })}
              className="btn-primary"
            >{pending ? "Import en cours..." : "Lancer l'import"}</button>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="table-base">
              <thead><tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {preview.rows.slice(0, 20).map((r, i) => (
                  <tr key={i}>{preview.headers.map(h => <td key={h} className="text-xs">{r[h]}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 20 && <p className="text-xs text-midnight-500 mt-2">...et {preview.rows.length - 20} ligne(s) supplémentaires.</p>}
          </div>
        </section>
      )}

      {report && (
        <section className="card p-5">
          <h2 className="font-semibold mb-3">Rapport d'import</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="Total" value={report.total} />
            <Stat label="Créées" value={report.created} tone="success" />
            <Stat label="Mises à jour" value={report.updated} tone="info" />
            <Stat label="Erreurs" value={report.errors.length} tone={report.errors.length ? "danger" : "neutral"} />
          </div>
          {report.errors.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-indigoaccent">Voir les erreurs ({report.errors.length})</summary>
              <table className="table-base mt-2">
                <thead><tr><th>Ligne CSV</th><th>Raison</th><th>Données</th></tr></thead>
                <tbody>
                  {report.errors.map((er, i) => (
                    <tr key={i}><td>{er.row}</td><td className="text-red-700 text-xs">{er.reason}</td><td className="text-xs">{JSON.stringify(er.data)}</td></tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "info" | "danger" | "neutral" }) {
  const colors: any = { success: "text-emerald-700", info: "text-indigo-700", danger: "text-red-700", neutral: "text-midnight-900" };
  return (
    <div className="border border-border rounded-md p-3">
      <div className="text-xs uppercase text-midnight-500">{label}</div>
      <div className={"text-2xl font-semibold " + (colors[tone ?? "neutral"])}>{value}</div>
    </div>
  );
}
