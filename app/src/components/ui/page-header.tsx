import Link from "next/link";

/**
 * En-tête de page — reprend la signature graphique de la charte :
 * pill mono en label (breadcrumb ou éponyme) → gros titre 800 avec slash,
 * puis sous-titre discret en ash.
 */
export function PageHeader({
  title, subtitle, actions, breadcrumb, pill
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  /** Petit label style pilule mono affiché au-dessus du titre. Optionnel. */
  pill?: string;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {pill && <div className="pill-ink mb-3">{pill}</div>}
        {!pill && breadcrumb && (
          <nav className="text-[11px] text-midnight-400 mb-2 font-mono uppercase tracking-widest">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {b.href ? <Link href={b.href} className="hover:text-indigoaccent">{b.label}</Link> : b.label}
                {i < breadcrumb.length - 1 && <span className="mx-1 text-indigoaccent font-bold">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-3xl md:text-4xl font-extrabold text-midnight-900 tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-midnight-400 mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
