import Link from "next/link";

export function PageHeader({
  title, subtitle, actions, breadcrumb
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumb && (
          <nav className="text-xs text-midnight-500 mb-1">
            {breadcrumb.map((b, i) => (
              <span key={i}>
                {b.href ? <Link href={b.href} className="hover:underline">{b.label}</Link> : b.label}
                {i < breadcrumb.length - 1 && <span className="mx-1">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold text-midnight-900">{title}</h1>
        {subtitle && <p className="text-sm text-midnight-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
