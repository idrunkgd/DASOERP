import { Info, AlertTriangle, Lightbulb, CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Renderer markdown light et opinionated — spécialisé pour les tutoriels
 * pas-à-pas du wiki formation. Supporte :
 *   # / ## / ###           → titres
 *   **gras** *italique*    → mise en forme inline
 *   `code`                 → code inline
 *   ```lang…```            → bloc de code (indenté monospace)
 *   - / 1.                 → listes non ordonnées / ordonnées
 *   ---                    → séparateur
 *   > [!TIP]  Astuce       → callout vert
 *   > [!INFO] Info         → callout bleu
 *   > [!WARN] Attention    → callout orange
 *   > [!STEP] Étape N      → callout mauve (utilisé pour numéroter les étapes)
 *   [texte](url)           → lien
 *
 * On préfère un renderer local plutôt qu'une lib pour :
 *   - ne pas alourdir le bundle
 *   - contrôler exactement le style des callouts / steps
 *   - éviter les mismatch de types côté Next 14 App Router
 */

type Token =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "hr" }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; text: string; lang?: string }
  | { kind: "callout"; type: "TIP" | "INFO" | "WARN" | "STEP"; text: string };

function tokenize(md: string): Token[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const tokens: Token[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    // Blocs de code ```lang
    if (l.startsWith("```")) {
      const lang = l.slice(3).trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]); i++;
      }
      tokens.push({ kind: "code", text: buf.join("\n"), lang });
      i++;
      continue;
    }
    // Titres
    if (l.startsWith("### ")) { tokens.push({ kind: "h3", text: l.slice(4) }); i++; continue; }
    if (l.startsWith("## "))  { tokens.push({ kind: "h2", text: l.slice(3) }); i++; continue; }
    if (l.startsWith("# "))   { tokens.push({ kind: "h1", text: l.slice(2) }); i++; continue; }
    // Séparateur
    if (l.trim() === "---") { tokens.push({ kind: "hr" }); i++; continue; }
    // Callouts
    const callout = l.match(/^>\s*\[!(TIP|INFO|WARN|STEP)\]\s*(.*)$/);
    if (callout) {
      const type = callout[1] as any;
      const buf = [callout[2]];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2)); i++;
      }
      tokens.push({ kind: "callout", type, text: buf.join("\n") });
      continue;
    }
    // Listes
    if (/^\s*-\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, "")); i++;
      }
      tokens.push({ kind: "ul", items });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++;
      }
      tokens.push({ kind: "ol", items });
      continue;
    }
    // Paragraphe — accumule lignes non vides
    if (l.trim() !== "") {
      const buf = [l];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith(">") && !lines[i].startsWith("```") && !/^\s*[-\d]/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      tokens.push({ kind: "p", text: buf.join(" ") });
      continue;
    }
    i++;
  }
  return tokens;
}

/** Inline rendering — gras / italique / code inline / liens. */
function renderInline(text: string): React.ReactNode {
  // Ordre important : code inline d'abord (protège son contenu), puis liens,
  // puis gras/italique.
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|\[([^\]]+)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    if (m[1]) {
      parts.push(<code key={key++} className="rounded bg-midnight-100 px-1.5 py-0.5 text-[0.85em] font-mono text-midnight-800">{m[1].slice(1, -1)}</code>);
    } else if (m[2]) {
      parts.push(<strong key={key++} className="font-semibold text-midnight-900">{m[2].slice(2, -2)}</strong>);
    } else if (m[3]) {
      parts.push(<em key={key++}>{m[3].slice(1, -1)}</em>);
    } else if (m[4] && m[5]) {
      parts.push(<a key={key++} href={m[5]} className="text-indigoaccent hover:underline" target={m[5].startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{m[4]}</a>);
    }
    cursor = re.lastIndex;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

const CALLOUT_STYLES = {
  TIP:  { icon: Lightbulb,     bg: "bg-emerald-50",  border: "border-emerald-300", text: "text-emerald-900", label: "Astuce" },
  INFO: { icon: Info,          bg: "bg-sky-50",      border: "border-sky-300",     text: "text-sky-900",     label: "Info" },
  WARN: { icon: AlertTriangle, bg: "bg-amber-50",    border: "border-amber-400",   text: "text-amber-900",   label: "Attention" },
  STEP: { icon: ArrowRight,    bg: "bg-indigoaccent/5", border: "border-indigoaccent/40", text: "text-midnight-800", label: "Étape" }
} as const;

export function Markdown({ source }: { source: string }) {
  const tokens = tokenize(source);
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-midnight-800">
      {tokens.map((t, i) => {
        switch (t.kind) {
          case "h1": return <h1 key={i} className="text-2xl font-bold text-midnight-900 mt-8 mb-3">{renderInline(t.text)}</h1>;
          case "h2": return <h2 key={i} className="text-xl font-bold text-midnight-900 mt-8 mb-2 pb-1 border-b border-border">{renderInline(t.text)}</h2>;
          case "h3": return <h3 key={i} className="text-base font-semibold text-midnight-900 mt-5 mb-1">{renderInline(t.text)}</h3>;
          case "p":  return <p key={i}>{renderInline(t.text)}</p>;
          case "hr": return <hr key={i} className="my-6 border-border" />;
          case "ul": return (
            <ul key={i} className="list-disc pl-6 space-y-1.5">
              {t.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ul>
          );
          case "ol": return (
            <ol key={i} className="list-decimal pl-6 space-y-1.5 marker:text-indigoaccent marker:font-semibold">
              {t.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ol>
          );
          case "code": return (
            <pre key={i} className="bg-midnight-900 text-midnight-50 rounded-lg p-4 overflow-x-auto text-sm font-mono">
              <code>{t.text}</code>
            </pre>
          );
          case "callout": {
            const s = CALLOUT_STYLES[t.type];
            const Icon = s.icon;
            return (
              <div key={i} className={"rounded-r border-l-4 p-4 " + s.bg + " " + s.border}>
                <div className={"flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-1.5 " + s.text}>
                  <Icon className="w-4 h-4" /> {s.label}
                </div>
                <div className={"text-sm " + s.text}>
                  {t.text.split("\n\n").map((para, k) => (
                    <p key={k} className={k > 0 ? "mt-2" : ""}>{renderInline(para)}</p>
                  ))}
                </div>
              </div>
            );
          }
        }
      })}
    </div>
  );
}
