import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * En-tête de page — signature graphique de la charte Dasolabs :
 * - dégradé silver → blanc → accent bleu discret en fond
 * - orbe bleue floue en haut à droite (signature charte)
 * - pill mono en label + gros titre 800 + sous-titre discret
 *
 * Deux variantes :
 *   variant="default" (défaut) — dégradé clair signature
 *   variant="hero"              — dégradé sombre midnight → electric blue
 *   variant="flat"              — sans dégradé, minimal (pages ultra-denses)
 */
export function PageHeader({
  title, subtitle, actions, breadcrumb, pill, variant = "hero"
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  pill?: string;
  variant?: "default" | "hero" | "flat";
}) {
  const isHero = variant === "hero";
  const isFlat = variant === "flat";
  const gradientClass =
    isFlat ? "" :
    isHero ? "hero-gradient text-white" :
    "hero-gradient-light";

  const wrapperClass = cn(
    "mb-8 relative",
    !isFlat && "px-6 py-6 md:px-8 md:py-7",
    gradientClass
  );

  const titleColor = isHero ? "text-white" : "text-midnight-900";
  const subtitleColor = isHero ? "text-indigoaccent-light" : "text-midnight-400";
  const breadcrumbColor = isHero ? "text-indigoaccent-light" : "text-midnight-400";

  return (
    <div className={wrapperClass}>
      <div className="relative z-10 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {pill && (
            <div className={cn(
              "mb-3",
              isHero ? "pill bg-white/10 text-white backdrop-blur-sm" : "pill-ink"
            )}>
              {pill}
            </div>
          )}
          {!pill && breadcrumb && (
            <nav className={cn("text-[11px] mb-2 font-mono uppercase tracking-widest", breadcrumbColor)}>
              {breadcrumb.map((b, i) => (
                <span key={i}>
                  {b.href ? <Link href={b.href} className="hover:text-indigoaccent">{b.label}</Link> : b.label}
                  {i < breadcrumb.length - 1 && (
                    <span className={cn("mx-1 font-bold", isHero ? "text-white" : "text-indigoaccent")}>/</span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <h1 className={cn(
            "text-3xl md:text-4xl font-extrabold tracking-tight leading-none",
            titleColor
          )}>
            {title}
          </h1>
          {subtitle && <p className={cn("text-sm mt-2", subtitleColor)}>{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
