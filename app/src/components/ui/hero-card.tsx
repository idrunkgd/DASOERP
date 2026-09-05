/**
 * HeroCard — bloc "brand" signature de la charte : dégradé midnight → electric
 * blue avec orbes floues animées. À utiliser pour :
 *   - le widget "ma mission actuelle" du dashboard consultant
 *   - un séparateur de section marquant
 *   - un CTA important type "Passe à l'action / Découvre X"
 *
 * Deux variantes :
 *   variant="dark"  (défaut) — fond midnight/blue, texte blanc
 *   variant="light"          — fond silver/blanc avec accent bleu discret
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function HeroCard({
  children, className, variant = "dark", pill, title, subtitle, actions
}: {
  children?: ReactNode;
  className?: string;
  variant?: "dark" | "light";
  /** Pilule mono affichée au-dessus du titre. */
  pill?: string;
  title?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        variant === "dark" ? "hero-gradient text-white" : "hero-gradient-light text-midnight-900",
        "p-8 relative",
        className
      )}
    >
      <div className="relative z-10">
        {pill && (
          <div
            className={cn(
              "pill mb-3",
              variant === "dark"
                ? "bg-white/10 text-white backdrop-blur-sm"
                : "bg-midnight-900 text-white"
            )}
          >
            {pill}
          </div>
        )}
        {(title || subtitle || actions) && (
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              {title && (
                <h2 className={cn(
                  "text-3xl md:text-4xl font-extrabold tracking-tight leading-none",
                  variant === "dark" ? "text-white" : "text-midnight-900"
                )}>
                  {title}
                </h2>
              )}
              {subtitle && (
                <div className={cn(
                  "mt-2 text-sm",
                  variant === "dark" ? "text-indigoaccent-light" : "text-midnight-500"
                )}>
                  {subtitle}
                </div>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
