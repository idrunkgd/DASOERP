/**
 * Parser CSV simple et résilient :
 * - support virgule, point-virgule ou tab (auto-détecté sur la 1ère ligne)
 * - support guillemets et guillemets doubles échappés
 * - retire le BOM UTF-8 si présent
 */
export function parseCSV(input: string): { headers: string[]; rows: Record<string, string>[] } {
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!text.trim()) return { headers: [], rows: [] };

  // Détection séparateur sur la première ligne (hors guillemets)
  const firstLine = readLine(text, 0).line;
  const sep = pickSeparator(firstLine);

  const lines: string[][] = [];
  let i = 0;
  while (i < text.length) {
    const { fields, next } = readRecord(text, i, sep);
    if (fields.some(f => f !== "")) lines.push(fields);
    i = next;
  }
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).map(arr => {
    const o: Record<string, string> = {};
    headers.forEach((h, idx) => { o[h] = (arr[idx] ?? "").trim(); });
    return o;
  });
  return { headers, rows };
}

function pickSeparator(firstLine: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",", bestCount = -1;
  for (const c of candidates) {
    let inQuote = false, count = 0;
    for (const ch of firstLine) {
      if (ch === '"') inQuote = !inQuote;
      else if (!inQuote && ch === c) count++;
    }
    if (count > bestCount) { bestCount = count; best = c; }
  }
  return best;
}

function readLine(text: string, start: number) {
  let i = start;
  while (i < text.length && text[i] !== "\n") i++;
  return { line: text.slice(start, i), next: i + 1 };
}

function readRecord(text: string, start: number, sep: string): { fields: string[]; next: number } {
  const fields: string[] = [];
  let cur = "", inQuote = false, i = start;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuote = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuote = true; i++; continue; }
    if (ch === sep) { fields.push(cur); cur = ""; i++; continue; }
    if (ch === "\n") { fields.push(cur); return { fields, next: i + 1 }; }
    cur += ch; i++;
  }
  fields.push(cur);
  return { fields, next: i };
}
