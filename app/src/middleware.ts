import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// Routes toujours autorisées pour un Visiteur
const VISITOR_ALLOWED_PREFIXES = ["/me", "/api/auth", "/api/profile"];

/**
 * Sous-domaines routés vers un préfixe interne :
 *   wiki.hub.dasolabs.be → /formation
 *
 * En prod, Coolify/Caddy termine le TLS pour le sous-domaine et proxy vers
 * la même app. Le middleware détecte le host et rewrite l'URL vers le
 * préfixe correspondant, en préservant le pathname (ex: /getting-started
 * → /formation/getting-started).
 *
 * On garde /formation exposé sur le domaine principal aussi (fallback si
 * quelqu'un tape directement hub.dasolabs.be/formation).
 */
const SUBDOMAIN_ROUTES: Array<{ host: string; prefix: string }> = [
  { host: "wiki.hub.dasolabs.be", prefix: "/formation" },
  { host: "wiki.localhost",       prefix: "/formation" } // pratique en dev
];

export default withAuth(
  function middleware(req) {
    // Traefik (le reverse proxy de Coolify) passe le vrai domaine dans
    // X-Forwarded-Host quand il fait du proxy — le Host header peut être
    // le nom interne du service. On teste les deux, X-Forwarded-Host
    // en priorité car c'est le vrai domaine client.
    const host = (
      req.headers.get("x-forwarded-host") ??
      req.headers.get("host") ??
      ""
    ).toLowerCase();
    const url = req.nextUrl.clone();
    const path = url.pathname;

    // 1. Rewrite sous-domaine → préfixe interne.
    // Ex: wiki.hub.dasolabs.be/cashflow → /formation/cashflow
    // On exclut les paths d'assets statiques (/wiki/mockups/*.svg, favicon,
    // images du dossier public) pour qu'ils soient servis tels quels sans
    // être re-préfixés par /formation.
    const subdomain = SUBDOMAIN_ROUTES.find((s) => host === s.host || host.startsWith(s.host + ":"));
    const isStaticAsset = /\.(svg|png|jpe?g|gif|webp|ico|css|js|woff2?|ttf)$/i.test(path);
    if (
      subdomain
      && !path.startsWith(subdomain.prefix)
      && !path.startsWith("/api/")
      && !path.startsWith("/_next/")
      && !path.startsWith("/wiki/")  // assets du wiki (public/wiki/*)
      && !isStaticAsset
    ) {
      url.pathname = subdomain.prefix + (path === "/" ? "" : path);
      return NextResponse.rewrite(url);
    }

    // 2. Politique visiteur : forcer /me (mais tolérer le wiki formation
    // pour qu'un consultant puisse consulter ses formations disponibles).
    const token: any = (req as any).nextauth?.token;
    if (token?.isVisitor
        && !VISITOR_ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p + "/"))
        && !path.startsWith("/formation")) {
      return NextResponse.redirect(new URL("/me", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    }
  }
);

export const config = {
  matcher: [
    // IMPORTANT : `api/health` exclu pour que Docker/Coolify puisse pinger
    // sans cookie de session (sinon redirect vers /login = healthcheck fail).
    "/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico|dasolabs-icon.svg|dasolabs-logo.svg).*)"
  ]
};
