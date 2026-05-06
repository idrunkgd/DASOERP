function escape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes(";")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(rows: Record<string, any>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const head = cols.join(";");
  const body = rows.map(r => cols.map(c => escape(r[c])).join(";")).join("\n");
  return "﻿" + head + "\n" + body; // BOM pour Excel
}

export function csvResponse(filename: string, content: string) {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
