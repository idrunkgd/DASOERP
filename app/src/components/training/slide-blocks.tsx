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

// ─── Illustrations Siemens PLC (stylisées, palette charte) ───
function IconCpuS71500() {
  return (
    <svg viewBox="0 0 140 200" className="w-full h-full">
      <rect x="10" y="10" width="120" height="180" rx="4" fill="#2A3560" stroke={dark} strokeWidth="2" />
      <rect x="20" y="24" width="100" height="30" rx="2" fill="#F1F1F6" />
      <text x="70" y="43" fontSize="11" fill={dark} textAnchor="middle" fontWeight="bold">SIEMENS</text>
      <text x="70" y="55" fontSize="7" fill={dark} textAnchor="middle">SIMATIC S7-1500</text>
      <rect x="20" y="62" width="100" height="70" rx="2" fill="#0F1B3D" />
      <text x="70" y="82" fontSize="8" fill="#22c55e" textAnchor="middle" fontFamily="monospace">RUN</text>
      <text x="70" y="98" fontSize="7" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace">CPU 1516-3 PN/DP</text>
      <text x="70" y="112" fontSize="6" fill="#22c55e" textAnchor="middle" fontFamily="monospace">6ES7 516-3AN02-0AB0</text>
      <text x="70" y="124" fontSize="6" fill="#FBB040" textAnchor="middle" fontFamily="monospace">FW V3.0</text>
      <circle cx="30" cy="145" r="3" fill="#22c55e" />
      <circle cx="45" cy="145" r="3" fill="#ef4444" />
      <circle cx="60" cy="145" r="3" fill="#F5A623" />
      <circle cx="75" cy="145" r="3" fill="#F1F1F6" />
      <rect x="20" y="155" width="100" height="25" rx="2" fill={dark} />
      <text x="70" y="171" fontSize="6" fill="#F1F1F6" textAnchor="middle">X1 PN X2 PN X3 DP</text>
    </svg>
  );
}
function IconCpuS71200() {
  return (
    <svg viewBox="0 0 160 100" className="w-full h-full">
      <rect x="8" y="10" width="140" height="80" rx="3" fill="#F1F1F6" stroke={dark} strokeWidth="2" />
      <text x="78" y="26" fontSize="9" fill={dark} textAnchor="middle" fontWeight="bold">SIEMENS SIMATIC S7-1200</text>
      <rect x="18" y="34" width="30" height="46" rx="2" fill="#0F1B3D" />
      <text x="33" y="50" fontSize="6" fill="#22c55e" textAnchor="middle" fontFamily="monospace">CPU</text>
      <text x="33" y="60" fontSize="6" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace">1214C</text>
      <text x="33" y="72" fontSize="5" fill="#FBB040" textAnchor="middle" fontFamily="monospace">DC/DC/DC</text>
      <rect x="55" y="34" width="65" height="46" rx="1" fill="#e5e7eb" />
      <g>{[0,1,2,3,4,5,6,7].map(i => <rect key={i} x={58 + i*7.5} y={38} width="6" height="4" rx="1" fill="#22c55e" />)}</g>
      <g>{[0,1,2,3,4,5].map(i => <rect key={i} x={58 + i*10} y={48} width="8" height="4" rx="1" fill="#FBB040" />)}</g>
      <text x="88" y="76" fontSize="5" fill={dark} textAnchor="middle">14 DI · 10 DO · 2 AI</text>
      <rect x="125" y="34" width="18" height="46" rx="2" fill="#0F1B3D" />
      <circle cx="134" cy="42" r="2" fill="#22c55e" />
      <text x="134" y="60" fontSize="4" fill="#F1F1F6" textAnchor="middle">RJ45</text>
    </svg>
  );
}
function IconEt200sp() {
  return (
    <svg viewBox="0 0 200 100" className="w-full h-full">
      <rect x="4" y="20" width="192" height="60" rx="2" fill="#F1F1F6" stroke={dark} strokeWidth="1.5" />
      <text x="100" y="14" fontSize="8" fill={dark} textAnchor="middle" fontWeight="bold">SIMATIC ET 200SP · Distributed I/O</text>
      {/* IM head */}
      <rect x="10" y="26" width="22" height="48" rx="1.5" fill="#0F1B3D" />
      <text x="21" y="42" fontSize="5" fill="#22c55e" textAnchor="middle" fontFamily="monospace">IM</text>
      <text x="21" y="52" fontSize="5" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace">155</text>
      {/* modules */}
      {[0,1,2,3,4,5,6,7,8].map(i => (
        <g key={i}>
          <rect x={38 + i*18} y="26" width="16" height="48" rx="1" fill={i%2 ? "#e5e7eb" : "#F1F1F6"} stroke={stroke} strokeWidth="0.5" />
          <rect x={41 + i*18} y="30" width="10" height="14" rx="1" fill="#0F1B3D" />
          <circle cx={46 + i*18} cy="37" r="1.2" fill="#22c55e" />
          <text x={46 + i*18} y="60" fontSize="4" fill={dark} textAnchor="middle">
            {["DI","DI","DO","DO","AI","AO","AI","CM","F-DI"][i]}
          </text>
        </g>
      ))}
    </svg>
  );
}
function IconRack() {
  return (
    <svg viewBox="0 0 260 120" className="w-full h-full">
      <rect x="4" y="46" width="252" height="52" rx="2" fill="#e5e7eb" stroke={dark} strokeWidth="1" />
      <text x="130" y="60" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">Rail DIN — bus fond de panier</text>
      {/* PS */}
      <rect x="10" y="14" width="22" height="80" rx="2" fill="#0F1B3D" />
      <text x="21" y="30" fontSize="5" fill="#FBB040" textAnchor="middle" fontFamily="monospace" fontWeight="bold">PS</text>
      <text x="21" y="42" fontSize="5" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace">60W</text>
      {/* CPU */}
      <rect x="34" y="10" width="34" height="88" rx="2" fill="#2A3560" stroke={dark} />
      <text x="51" y="22" fontSize="5" fill="#22c55e" textAnchor="middle" fontFamily="monospace">CPU</text>
      <text x="51" y="34" fontSize="6" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace" fontWeight="bold">1516</text>
      <rect x="38" y="42" width="26" height="18" rx="1" fill="#0F1B3D" />
      <text x="51" y="52" fontSize="4" fill="#22c55e" textAnchor="middle" fontFamily="monospace">DISPLAY</text>
      {/* Signal modules */}
      {[0,1,2,3,4,5].map(i => (
        <g key={i}>
          <rect x={72 + i*28} y="14" width="24" height="80" rx="1.5" fill="#F1F1F6" stroke={stroke} strokeWidth="0.6" />
          <text x={84 + i*28} y="24" fontSize="4.5" fill={dark} textAnchor="middle" fontWeight="bold">
            {["DI 32","DI 32","DO 32","AI 8","AO 4","CM PN"][i]}
          </text>
          <circle cx={84 + i*28} cy="32" r="1.5" fill="#22c55e" />
          {/* terminals */}
          {[0,1,2,3,4,5,6,7].map(j => (
            <rect key={j} x={75 + i*28} y={40 + j*6} width="18" height="2" fill="#a3a3a3" />
          ))}
        </g>
      ))}
      {/* Comm module */}
      <text x="130" y="112" fontSize="6" fill={dark} textAnchor="middle" fontStyle="italic">Configuration typique — CPU + 6 modules signaux</text>
    </svg>
  );
}
function IconProfinet() {
  return (
    <svg viewBox="0 0 260 140" className="w-full h-full">
      {/* Cable */}
      <rect x="20" y="60" width="220" height="20" rx="10" fill="#22c55e" opacity="0.3" />
      <path d="M 20 70 Q 130 90 240 70" stroke="#22c55e" strokeWidth="4" fill="none" />
      <text x="130" y="55" fontSize="9" fill={dark} textAnchor="middle" fontWeight="bold">PROFINET RT</text>
      {/* RJ45 connectors */}
      <rect x="10" y="60" width="20" height="20" rx="3" fill={dark} />
      <rect x="230" y="60" width="20" height="20" rx="3" fill={dark} />
      {/* Devices */}
      <g>
        <rect x="30" y="14" width="60" height="36" rx="3" fill="#2A3560" />
        <text x="60" y="26" fontSize="6" fill="#22c55e" textAnchor="middle" fontFamily="monospace">CPU 1516</text>
        <text x="60" y="38" fontSize="5" fill="#F1F1F6" textAnchor="middle" fontFamily="monospace">IO Controller</text>
      </g>
      <g>
        <rect x="105" y="14" width="50" height="36" rx="3" fill="#F1F1F6" stroke={dark} />
        <text x="130" y="28" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">ET 200SP</text>
        <text x="130" y="40" fontSize="5" fill={dark} textAnchor="middle">IO Device #1</text>
      </g>
      <g>
        <rect x="170" y="14" width="70" height="36" rx="3" fill="#F1F1F6" stroke={dark} />
        <text x="205" y="28" fontSize="6" fill={dark} textAnchor="middle" fontWeight="bold">Variateur G120</text>
        <text x="205" y="40" fontSize="5" fill={dark} textAnchor="middle">IO Device #2</text>
      </g>
      {/* Connect lines */}
      <path d="M 60 50 L 60 60" stroke={dark} strokeWidth="1.5" />
      <path d="M 130 50 L 130 60" stroke={dark} strokeWidth="1.5" />
      <path d="M 205 50 L 205 60" stroke={dark} strokeWidth="1.5" />
      <text x="130" y="110" fontSize="6" fill={dark} textAnchor="middle">1 ms cycle · Isochrone RT · Adressage IP fixe</text>
      <text x="130" y="124" fontSize="7" fill="#22c55e" textAnchor="middle" fontWeight="bold">100 Mbps · Cat 5e / M12 · RJ45</text>
    </svg>
  );
}
function IconDiModule() {
  return (
    <svg viewBox="0 0 160 200" className="w-full h-full">
      <rect x="20" y="10" width="120" height="180" rx="3" fill="#F1F1F6" stroke={dark} strokeWidth="1.5" />
      <text x="80" y="28" fontSize="8" fill={dark} textAnchor="middle" fontWeight="bold">DI 32×24VDC</text>
      <text x="80" y="40" fontSize="6" fill={dark} textAnchor="middle">6ES7 521-1BL10-0AA0</text>
      {/* LEDs */}
      <g>
        {[0,1,2,3,4,5,6,7].map(i => (
          <g key={i}>
            <circle cx={35 + (i%4)*30} cy={55 + Math.floor(i/4)*12} r="3" fill="#22c55e" />
            <text x={35 + (i%4)*30} y={58 + Math.floor(i/4)*12} fontSize="4" fill={dark} textAnchor="middle" fontWeight="bold">
              {i}
            </text>
          </g>
        ))}
      </g>
      {/* Screw terminals */}
      <rect x="30" y="90" width="100" height="90" rx="2" fill="#0F1B3D" />
      {[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(i => (
        <g key={i}>
          <circle cx={38 + (i%8)*12} cy={100 + Math.floor(i/8)*15} r="3" fill="#a3a3a3" />
          <text x={38 + (i%8)*12} y={102 + Math.floor(i/8)*15} fontSize="3" fill={dark} textAnchor="middle" fontWeight="bold">{i}</text>
        </g>
      ))}
      <text x="80" y="176" fontSize="5" fill="#F1F1F6" textAnchor="middle">32 pts · 24 VDC · sink/source</text>
    </svg>
  );
}
function IconIoWiring() {
  return (
    <svg viewBox="0 0 260 140" className="w-full h-full">
      {/* PLC */}
      <rect x="10" y="20" width="60" height="100" rx="3" fill="#2A3560" />
      <text x="40" y="34" fontSize="7" fill="#22c55e" textAnchor="middle" fontWeight="bold">PLC DI</text>
      <text x="40" y="50" fontSize="5" fill="#F1F1F6" textAnchor="middle">I0.0</text>
      <text x="40" y="72" fontSize="5" fill="#F1F1F6" textAnchor="middle">1M+ (24V)</text>
      <text x="40" y="94" fontSize="5" fill="#F1F1F6" textAnchor="middle">1M− (0V)</text>
      <circle cx="70" cy="50" r="2" fill="#F1F1F6" />
      <circle cx="70" cy="72" r="2" fill="#F1F1F6" />
      <circle cx="70" cy="94" r="2" fill="#F1F1F6" />
      {/* Wires */}
      <path d="M 70 50 L 130 50" stroke="#F5A623" strokeWidth="1.5" />
      <path d="M 70 72 L 100 72 L 100 30" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M 70 94 L 200 94" stroke="#0F1B3D" strokeWidth="1.5" />
      {/* Sensor */}
      <rect x="130" y="35" width="70" height="35" rx="3" fill="#F1F1F6" stroke={dark} strokeWidth="1.5" />
      <text x="165" y="50" fontSize="7" fill={dark} textAnchor="middle" fontWeight="bold">Capteur PNP</text>
      <text x="165" y="62" fontSize="5" fill={dark} textAnchor="middle">3-fils, NO</text>
      <path d="M 130 50 L 100 50" stroke="none" fill="none" />
      <path d="M 200 43 L 220 43 L 220 30" stroke="#ef4444" strokeWidth="1.5" />
      <path d="M 200 60 L 220 60 L 220 100" stroke="#0F1B3D" strokeWidth="1.5" />
      {/* 24V rails */}
      <path d="M 100 30 L 220 30" stroke="#ef4444" strokeWidth="2" />
      <text x="165" y="22" fontSize="6" fill="#ef4444" textAnchor="middle" fontWeight="bold">+24 VDC</text>
      <path d="M 200 100 L 220 100" stroke="#0F1B3D" strokeWidth="2" />
      <text x="165" y="115" fontSize="6" fill="#0F1B3D" textAnchor="middle" fontWeight="bold">0 VDC (M)</text>
      <text x="130" y="132" fontSize="5" fill={dark} textAnchor="middle" fontStyle="italic">Câblage type PNP source · signal 24V quand actif</text>
    </svg>
  );
}
function IconTiaPortal() {
  return (
    <svg viewBox="0 0 220 140" className="w-full h-full">
      <rect x="4" y="6" width="212" height="128" rx="4" fill="#F1F1F6" stroke={dark} strokeWidth="1.5" />
      {/* Title bar */}
      <rect x="4" y="6" width="212" height="14" rx="4" fill="#0F1B3D" />
      <text x="12" y="16" fontSize="6" fill="#F1F1F6" fontWeight="bold">TIA Portal V19 — Project_Skid.ap19</text>
      {/* Sidebar */}
      <rect x="4" y="20" width="50" height="114" fill="#e5e7eb" />
      {["Devices","Program blocks","Technology","External","PLC tags","Common"].map((t, i) => (
        <text key={i} x="8" y={34 + i*14} fontSize="5" fill={dark}>■ {t}</text>
      ))}
      {/* Main area */}
      <rect x="56" y="24" width="156" height="80" fill="#FFFFFF" stroke={stroke} strokeWidth="0.5" />
      {/* Ladder rungs */}
      <line x1="60" y1="34" x2="60" y2="100" stroke={dark} strokeWidth="0.8" />
      <line x1="208" y1="34" x2="208" y2="100" stroke={dark} strokeWidth="0.8" />
      {[42, 58, 74, 90].map((y, i) => (
        <g key={i}>
          <line x1="60" y1={y} x2="208" y2={y} stroke={dark} strokeWidth="0.8" />
          <rect x="80" y={y-4} width="18" height="8" fill="#FFFFFF" stroke={dark} strokeWidth="0.6" />
          <text x="89" y={y+2} fontSize="4" fill={dark} textAnchor="middle">I0.{i}</text>
          <circle cx="190" cy={y} r="4" fill="#FFFFFF" stroke={dark} strokeWidth="0.6" />
          <text x="190" y={y+1.5} fontSize="4" fill={dark} textAnchor="middle">Q{i}</text>
        </g>
      ))}
      {/* Bottom */}
      <rect x="56" y="106" width="156" height="26" fill="#0F1B3D" />
      <text x="60" y="118" fontSize="5" fill="#22c55e" fontFamily="monospace">▶ Compile OK — 0 errors, 0 warnings</text>
      <text x="60" y="128" fontSize="5" fill="#FBB040" fontFamily="monospace">✔ Download PLC · Go online</text>
    </svg>
  );
}
function IconCabinet() {
  return (
    <svg viewBox="0 0 180 220" className="w-full h-full">
      <rect x="6" y="6" width="168" height="208" rx="3" fill="#e5e7eb" stroke={dark} strokeWidth="2" />
      <text x="90" y="20" fontSize="7" fill={dark} textAnchor="middle" fontWeight="bold">ARMOIRE 800×2000</text>
      {/* Rail DIN */}
      <rect x="16" y="30" width="148" height="8" fill="#a3a3a3" />
      {/* Disjoncteurs */}
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={20 + i*20} y="38" width="16" height="30" rx="1" fill="#F1F1F6" stroke={dark} strokeWidth="0.5" />
      ))}
      <text x="90" y="58" fontSize="5" fill={dark} textAnchor="middle" fontStyle="italic">Disjoncteurs de branche</text>
      {/* PLC */}
      <rect x="16" y="78" width="148" height="60" rx="2" fill="#F1F1F6" stroke={dark} />
      <rect x="24" y="86" width="14" height="46" rx="1" fill="#0F1B3D" />
      <text x="31" y="102" fontSize="4" fill="#FBB040" textAnchor="middle">PS</text>
      <rect x="40" y="82" width="22" height="52" rx="1" fill="#2A3560" />
      <text x="51" y="102" fontSize="5" fill="#22c55e" textAnchor="middle">CPU</text>
      {[0,1,2,3,4].map(i => (
        <rect key={i} x={64 + i*20} y="86" width="18" height="46" rx="1" fill="#F1F1F6" stroke={stroke} strokeWidth="0.5" />
      ))}
      {/* Relais */}
      <rect x="16" y="146" width="148" height="30" rx="2" fill="#F1F1F6" stroke={dark} />
      {[0,1,2,3,4,5,6,7,8,9].map(i => (
        <rect key={i} x={20 + i*14} y="152" width="10" height="20" rx="1" fill="#FBB040" />
      ))}
      <text x="90" y="169" fontSize="4" fill={dark} textAnchor="middle" fontWeight="bold">Relais interface DO → moteurs</text>
      {/* Bornier */}
      <rect x="16" y="186" width="148" height="20" fill="#0F1B3D" />
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
        <circle key={i} cx={22 + i*12} cy="196" r="2.5" fill="#a3a3a3" />
      ))}
      <text x="90" y="212" fontSize="5" fill="#F1F1F6" textAnchor="middle" fontWeight="bold">Bornier client — arrivées terrain</text>
    </svg>
  );
}
function IconFsafety() {
  return (
    <svg viewBox="0 0 200 140" className="w-full h-full">
      <rect x="4" y="10" width="192" height="120" rx="4" fill="#fef3c7" stroke="#dc2626" strokeWidth="2" />
      {/* Warning triangle */}
      <polygon points="100,20 116,48 84,48" fill="#FBB040" stroke="#dc2626" strokeWidth="1.5" />
      <text x="100" y="43" fontSize="12" fill="#dc2626" textAnchor="middle" fontWeight="bold">!</text>
      <text x="100" y="64" fontSize="10" fill="#dc2626" textAnchor="middle" fontWeight="bold">F-CPU · SAFETY</text>
      {/* Safety blocks */}
      <rect x="20" y="76" width="70" height="40" rx="3" fill="#dc2626" />
      <text x="55" y="90" fontSize="7" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">F-DI 4×</text>
      <text x="55" y="102" fontSize="6" fill="#fef3c7" textAnchor="middle">Arrêt d&apos;urgence</text>
      <text x="55" y="112" fontSize="5" fill="#fef3c7" textAnchor="middle">SIL 3 / PL e</text>
      <rect x="110" y="76" width="70" height="40" rx="3" fill="#dc2626" />
      <text x="145" y="90" fontSize="7" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">F-DO 4×</text>
      <text x="145" y="102" fontSize="6" fill="#fef3c7" textAnchor="middle">Coupure moteur</text>
      <text x="145" y="112" fontSize="5" fill="#fef3c7" textAnchor="middle">Certifié TÜV</text>
      <text x="100" y="128" fontSize="6" fill="#dc2626" textAnchor="middle" fontWeight="bold" fontStyle="italic">Redondance interne · double canal</text>
    </svg>
  );
}
function IconScanCycle() {
  return (
    <svg viewBox="0 0 220 180" className="w-full h-full">
      <circle cx="110" cy="90" r="70" fill="none" stroke={stroke} strokeWidth="2" strokeDasharray="4 4" />
      {/* 4 steps */}
      <g>
        <circle cx="110" cy="30" r="28" fill="#F5A623" />
        <text x="110" y="30" fontSize="9" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">1</text>
        <text x="110" y="42" fontSize="6" fill="#FFFFFF" textAnchor="middle">LIRE I</text>
      </g>
      <g>
        <circle cx="170" cy="90" r="28" fill={stroke} />
        <text x="170" y="90" fontSize="9" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">2</text>
        <text x="170" y="102" fontSize="6" fill="#FFFFFF" textAnchor="middle">EXÉCUTER</text>
      </g>
      <g>
        <circle cx="110" cy="150" r="28" fill="#22c55e" />
        <text x="110" y="150" fontSize="9" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">3</text>
        <text x="110" y="162" fontSize="6" fill="#FFFFFF" textAnchor="middle">ÉCRIRE Q</text>
      </g>
      <g>
        <circle cx="50" cy="90" r="28" fill={dark} />
        <text x="50" y="90" fontSize="9" fill="#FFFFFF" textAnchor="middle" fontWeight="bold">4</text>
        <text x="50" y="102" fontSize="6" fill="#FFFFFF" textAnchor="middle">DIAG.</text>
      </g>
      {/* Arrows */}
      <path d="M 138 40 A 60 60 0 0 1 160 75" stroke={dark} strokeWidth="2" fill="none" markerEnd="url(#arr)" />
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={dark} />
        </marker>
      </defs>
    </svg>
  );
}

const ILLUS: Record<string, () => JSX.Element> = {
  lightning: IconLightning,
  "arc-flash": IconArcFlashDanger,
  lockout: IconLockout,
  vat: IconVat,
  tester: IconTester,
  // Siemens PLC
  "cpu-s71500": IconCpuS71500,
  "cpu-s71200": IconCpuS71200,
  "et200sp": IconEt200sp,
  "rack": IconRack,
  "profinet": IconProfinet,
  "di-module": IconDiModule,
  "io-wiring": IconIoWiring,
  "tia-portal": IconTiaPortal,
  "cabinet": IconCabinet,
  "f-safety": IconFsafety,
  "scan-cycle": IconScanCycle
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
