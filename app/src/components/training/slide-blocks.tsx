/**
 * Renderer de contenu de slide "designé" pour les cours du HUB.
 *
 * Le champ `bodyMd` de Course.slides accepte un mini-DSL en plus du markdown
 * basique (headings ##, bullets -, gras **) :
 *
 *   [USECASE|Persona / poste|Scénario ...|Action clé]
 *   [DANGER|texte]           → callout rouge (à ne jamais faire)
 *   [WARN|texte]             → callout orange (attention)
 *   [TIP|texte]              → callout bleu (astuce / rappel)
 *   [RULE|texte]             → callout vert (règle d'or)
 *   [EPI|helmet,gloves,mat]  → rangée d'illustrations EPI (voir EPI_ICONS)
 *   [ILLUSTRATION|key]       → grande illustration centrée (voir ILLUS)
 *   [STEPS|étape 1||étape 2||étape 3] → étapes numérotées
 *   [KV|Label:Valeur||Label2:Valeur2] → tableau clé/valeur
 *
 * Tout le reste est traité comme du texte enrichi ligne par ligne.
 * Objectif : rendre les cours BA4/BA5 (et suivants) beaucoup plus visuels
 * sans dépendre d'une lib markdown externe.
 */
import type { ReactNode } from "react";

// ─────────────────────────── SVG ICONS ───────────────────────────
// Chaque SVG est autonome (viewBox), stylé via la charte (indigoaccent
// + midnight). Aucune dépendance externe → build ultra léger.

const stroke = "#3434E8";
const fill = "#F1F1F6";
const dark = "#202037";

function IconHelmet() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <path d="M32 8c-11 0-20 8-20 22h40c0-14-9-22-20-22z" fill={stroke} />
      <rect x="10" y="30" width="44" height="6" rx="2" fill={dark} />
      <path d="M22 30V16" stroke="#fff" strokeWidth="2" />
      <path d="M42 30V16" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
function IconGloves() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <path d="M20 22c0-8 12-8 12 0v10h4V16c0-8 12-8 12 0v22c0 10-6 16-14 16H26c-6 0-10-4-10-10v-14c0-6 4-8 4-8z" fill={stroke} />
      <path d="M20 34h4M28 34h4M36 34h4M44 34h4" stroke="#fff" strokeWidth="1.5" />
      <text x="32" y="52" fontSize="6" fill="#fff" textAnchor="middle" fontWeight="bold">1000V</text>
    </svg>
  );
}
function IconMat() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect x="6" y="30" width="52" height="24" rx="2" fill={stroke} />
      <path d="M6 34h52M6 42h52M6 50h52" stroke="#fff" strokeWidth="1" strokeDasharray="3 3" />
      <text x="32" y="26" fontSize="7" fill={dark} textAnchor="middle" fontWeight="bold">TAPIS ISOLANT</text>
    </svg>
  );
}
function IconVat() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect x="24" y="8" width="16" height="36" rx="2" fill={dark} />
      <circle cx="32" cy="16" r="4" fill="#ff5555" />
      <rect x="26" y="24" width="12" height="10" rx="1" fill="#fff" />
      <text x="32" y="32" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">VAT</text>
      <path d="M18 46l14 12M46 46l-14 12" stroke={dark} strokeWidth="2" />
      <circle cx="18" cy="46" r="3" fill={stroke} />
      <circle cx="46" cy="46" r="3" fill={stroke} />
    </svg>
  );
}
function IconShoes() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <path d="M10 40c0-10 6-16 16-16h20c8 0 12 4 12 12v10c0 4-2 6-6 6H16c-4 0-6-2-6-6v-6z" fill={stroke} />
      <path d="M10 46h48" stroke="#fff" strokeWidth="2" />
      <circle cx="30" cy="34" r="2" fill="#fff" />
      <text x="32" y="58" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">S3 ESD</text>
    </svg>
  );
}
function IconGlasses() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <ellipse cx="18" cy="34" rx="10" ry="7" fill={stroke} opacity="0.4" stroke={stroke} strokeWidth="2" />
      <ellipse cx="46" cy="34" rx="10" ry="7" fill={stroke} opacity="0.4" stroke={stroke} strokeWidth="2" />
      <path d="M28 34h8" stroke={stroke} strokeWidth="2" />
      <path d="M8 34h-3M56 34h3" stroke={dark} strokeWidth="2" />
    </svg>
  );
}
function IconArcsuit() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <circle cx="32" cy="14" r="6" fill={dark} />
      <path d="M22 22h20l4 26H18z" fill={stroke} />
      <path d="M22 48l-4 8h28l-4-8" fill={stroke} />
      <path d="M28 30l4-4 4 4-2 6h-4z" fill="#ffcc00" />
      <text x="32" y="60" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">ARC-FLASH</text>
    </svg>
  );
}
function IconLockout() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect x="16" y="28" width="32" height="28" rx="3" fill={stroke} />
      <path d="M22 28v-6a10 10 0 0120 0v6" stroke={dark} strokeWidth="3" fill="none" />
      <circle cx="32" cy="42" r="4" fill="#fff" />
      <rect x="30" y="42" width="4" height="8" fill="#fff" />
      <text x="32" y="60" fontSize="5" fill={dark} textAnchor="middle" fontWeight="bold">CONSIGNÉ</text>
    </svg>
  );
}
function IconLightning() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <path d="M36 4L14 36h14L22 60l24-30H30l6-26z" fill="#ffcc00" stroke={dark} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconArcFlashDanger() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <circle cx="32" cy="32" r="26" fill="#fff5f5" stroke="#dc2626" strokeWidth="2" />
      <path d="M32 12l4 12h-3l3 8h-4l3 12-6-14h3l-3-8h4z" fill="#dc2626" />
    </svg>
  );
}
function IconTester() {
  return (
    <svg viewBox="0 0 64 64" className="w-full h-full">
      <rect x="18" y="10" width="28" height="40" rx="3" fill={dark} />
      <rect x="22" y="14" width="20" height="12" rx="1" fill="#22c55e" />
      <text x="32" y="23" fontSize="6" fill="#000" textAnchor="middle" fontWeight="bold">0.00 V</text>
      <circle cx="24" cy="34" r="2" fill="#fff" />
      <circle cx="32" cy="34" r="2" fill="#fff" />
      <circle cx="40" cy="34" r="2" fill="#fff" />
      <circle cx="24" cy="42" r="2" fill="#fff" />
      <circle cx="32" cy="42" r="2" fill="#fff" />
      <circle cx="40" cy="42" r="2" fill="#fff" />
      <path d="M18 50l-6 8M46 50l6 8" stroke={dark} strokeWidth="2" />
      <circle cx="12" cy="58" r="3" fill="#ef4444" />
      <circle cx="52" cy="58" r="3" fill="#000" />
    </svg>
  );
}

const EPI_ICONS: Record<string, { label: string; component: () => JSX.Element }> = {
  helmet: { label: "Casque isolant", component: IconHelmet },
  gloves: { label: "Gants isolants", component: IconGloves },
  mat: { label: "Tapis isolant", component: IconMat },
  vat: { label: "VAT", component: IconVat },
  shoes: { label: "Chaussures S3 ESD", component: IconShoes },
  glasses: { label: "Lunettes arc-flash", component: IconGlasses },
  arcsuit: { label: "Vêtement arc-flash", component: IconArcsuit },
  lockout: { label: "Cadenas de consignation", component: IconLockout },
  tester: { label: "Multimètre", component: IconTester }
};

const ILLUS: Record<string, () => JSX.Element> = {
  lightning: IconLightning,
  "arc-flash": IconArcFlashDanger,
  lockout: IconLockout,
  vat: IconVat,
  tester: IconTester
};

// ─────────────────────────── PARSER ───────────────────────────
type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "usecase"; who: string; scenario: string; action: string }
  | { kind: "callout"; tone: "danger" | "warn" | "tip" | "rule"; text: string }
  | { kind: "epi"; icons: string[] }
  | { kind: "illustration"; key: string }
  | { kind: "steps"; items: string[] }
  | { kind: "kv"; rows: [string, string][] };

function parseBlocks(md: string): Block[] {
  const out: Block[] = [];
  const lines = md.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }

    // Bracket macros — peuvent être multi-lignes
    const bracket = line.match(/^\[(USECASE|DANGER|WARN|TIP|RULE|EPI|ILLUSTRATION|STEPS|KV)\|(.*)$/i);
    if (bracket) {
      // Concatène jusqu'à trouver ']' de fin
      let acc = bracket[2];
      while (!acc.trim().endsWith("]") && i + 1 < lines.length) {
        i++;
        acc += " " + lines[i].trim();
      }
      acc = acc.replace(/\]$/, "").trim();
      const kind = bracket[1].toUpperCase();
      const parts = acc.split("|").map((s) => s.trim()).filter(Boolean);
      if (kind === "USECASE" && parts.length >= 3) {
        out.push({ kind: "usecase", who: parts[0], scenario: parts[1], action: parts.slice(2).join(" | ") });
      } else if (kind === "DANGER" || kind === "WARN" || kind === "TIP" || kind === "RULE") {
        out.push({ kind: "callout", tone: kind.toLowerCase() as any, text: parts.join(" | ") });
      } else if (kind === "EPI") {
        out.push({ kind: "epi", icons: parts.join(",").split(",").map((s) => s.trim()).filter(Boolean) });
      } else if (kind === "ILLUSTRATION" && parts.length >= 1) {
        out.push({ kind: "illustration", key: parts[0] });
      } else if (kind === "STEPS") {
        // séparateur ||
        const items = acc.split("||").map((s) => s.trim()).filter(Boolean);
        out.push({ kind: "steps", items });
      } else if (kind === "KV") {
        const rows = acc.split("||").map((s) => s.trim()).filter(Boolean).map((row) => {
          const [k, ...rest] = row.split(":");
          return [k.trim(), rest.join(":").trim()] as [string, string];
        });
        out.push({ kind: "kv", rows });
      }
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) { out.push({ kind: "h3", text: line.slice(4) }); i++; continue; }
    if (line.startsWith("## ")) { out.push({ kind: "h2", text: line.slice(3) }); i++; continue; }

    // Bullets
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      out.push({ kind: "ul", items });
      continue;
    }

    // Paragraphe normal
    out.push({ kind: "p", text: line });
    i++;
  }
  return out;
}

// Rendu inline pour gérer **bold** et `code`
function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const chunk = m[0];
    if (chunk.startsWith("**")) parts.push(<strong key={key++} className="font-semibold text-midnight-900">{chunk.slice(2, -2)}</strong>);
    else parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-midnight-100 text-[0.85em] font-mono text-indigoaccent">{chunk.slice(1, -1)}</code>);
    last = m.index + chunk.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

// ─────────────────────────── RENDERERS ───────────────────────────
function CalloutBlock({ tone, text }: { tone: "danger" | "warn" | "tip" | "rule"; text: string }) {
  const cfg = {
    danger: { bg: "bg-rose-50", border: "border-rose-300", text: "text-rose-900", label: "text-rose-700", icon: "⛔", title: "DANGER" },
    warn: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-900", label: "text-amber-700", icon: "⚠️", title: "ATTENTION" },
    tip: { bg: "bg-sky-50", border: "border-sky-300", text: "text-sky-900", label: "text-sky-700", icon: "💡", title: "À RETENIR" },
    rule: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-900", label: "text-emerald-700", icon: "✅", title: "RÈGLE D'OR" }
  }[tone];
  return (
    <div className={`rounded-xl border-l-4 ${cfg.border} ${cfg.bg} p-4 flex gap-3`}>
      <div className="text-2xl leading-none">{cfg.icon}</div>
      <div>
        <div className={`text-[10px] font-bold uppercase tracking-wider ${cfg.label} mb-1`}>{cfg.title}</div>
        <div className={`${cfg.text} text-sm leading-relaxed`}>{inline(text)}</div>
      </div>
    </div>
  );
}

function UseCaseBlock({ who, scenario, action }: { who: string; scenario: string; action: string }) {
  return (
    <div className="rounded-xl bg-gradient-to-br from-indigoaccent/10 via-midnight-50 to-white border border-indigoaccent/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-10 h-10 rounded-full bg-indigoaccent text-white flex items-center justify-center text-sm font-bold">👤</div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-indigoaccent">Cas concret</div>
          <div className="text-sm font-semibold text-midnight-900">{inline(who)}</div>
        </div>
      </div>
      <div className="text-sm text-midnight-700 leading-relaxed mb-3">{inline(scenario)}</div>
      <div className="rounded-lg bg-white border border-midnight-200 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1">Bonne pratique</div>
        <div className="text-sm text-midnight-900 leading-relaxed">{inline(action)}</div>
      </div>
    </div>
  );
}

function EpiBlock({ icons }: { icons: string[] }) {
  const valid = icons.filter((k) => EPI_ICONS[k]);
  if (!valid.length) return null;
  return (
    <div className="rounded-xl bg-midnight-50/50 border border-midnight-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-indigoaccent mb-3">Équipements de protection individuelle</div>
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {valid.map((k) => {
          const { component: Cmp, label } = EPI_ICONS[k];
          return (
            <div key={k} className="flex flex-col items-center text-center">
              <div className="w-16 h-16 mb-1"><Cmp /></div>
              <div className="text-[10px] text-midnight-700 leading-tight">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IllustrationBlock({ k }: { k: string }) {
  const Cmp = ILLUS[k];
  if (!Cmp) return null;
  return (
    <div className="flex justify-center py-4">
      <div className="w-32 h-32"><Cmp /></div>
    </div>
  );
}

function StepsBlock({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-3 rounded-lg border border-midnight-200 bg-white p-3">
          <div className="w-7 h-7 rounded-full bg-indigoaccent text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
          <div className="text-sm text-midnight-800 leading-relaxed">{inline(it)}</div>
        </li>
      ))}
    </ol>
  );
}

function KvBlock({ rows }: { rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-midnight-200 overflow-hidden">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-midnight-50/50" : "bg-white"}>
              <td className="px-3 py-2 font-semibold text-midnight-700 w-1/3">{inline(k)}</td>
              <td className="px-3 py-2 text-midnight-900">{inline(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SlideBlocks({ bodyMd }: { bodyMd: string }) {
  const blocks = parseBlocks(bodyMd || "");
  if (!blocks.length) return <em className="text-midnight-400">Contenu non renseigné.</em>;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h2":
            return <h2 key={i} className="text-xl font-bold text-midnight-900 mt-4">{inline(b.text)}</h2>;
          case "h3":
            return <h3 key={i} className="text-base font-semibold text-indigoaccent mt-3 uppercase tracking-wide">{inline(b.text)}</h3>;
          case "p":
            return <p key={i} className="text-sm text-midnight-800 leading-relaxed">{inline(b.text)}</p>;
          case "ul":
            return (
              <ul key={i} className="space-y-1.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-midnight-800">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigoaccent flex-shrink-0" />
                    <span className="leading-relaxed">{inline(it)}</span>
                  </li>
                ))}
              </ul>
            );
          case "usecase": return <UseCaseBlock key={i} who={b.who} scenario={b.scenario} action={b.action} />;
          case "callout": return <CalloutBlock key={i} tone={b.tone} text={b.text} />;
          case "epi":     return <EpiBlock key={i} icons={b.icons} />;
          case "illustration": return <IllustrationBlock key={i} k={b.key} />;
          case "steps":   return <StepsBlock key={i} items={b.items} />;
          case "kv":      return <KvBlock key={i} rows={b.rows} />;
        }
      })}
    </div>
  );
}
