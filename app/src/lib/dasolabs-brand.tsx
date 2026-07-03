/**
 * Charte Dasolabs partagée entre les templates PDF (@react-pdf/renderer).
 *
 * Utilisée par offer-pdf-template.tsx (déjà en place), proposal-pdf-template.tsx
 * (offre consultant) et cv-pdf-template.tsx. Permet d'avoir une identité
 * visuelle cohérente et un seul endroit à modifier si la charte évolue.
 */
import React from "react";
import { Svg, Path, G } from "@react-pdf/renderer";

/// Palette alignée sur tailwind.config.ts (charte ERP).
export const BRAND_COLORS = {
  ink:    "#202037",   // midnight — foncé pour titres et bordures
  accent: "#5b5fd6",   // indigoaccent — highlights et totaux
  grey:   "#727496",   // midnight-400 — texte secondaire
  light:  "#f3f3f7",   // midnight-50 — cartouches / fonds doux
  border: "#e1e1ec"    // midnight-100 — filets
};

/**
 * Logo Dasolabs reproduit inline en SVG (pas de dépendance à un fichier
 * externe côté PDF). ViewBox 400×500 conservée pour ratio d'origine.
 */
export function DasolabsIcon({
  size = 40, color = BRAND_COLORS.ink
}: { size?: number; color?: string }) {
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
