import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";

// Routes toujours autorisées pour un Visiteur
const VISITOR_ALLOWED_PREFIXES = ["/me", "/api/auth", "/api/profile"];

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;
    const token: any = (req as any).nextauth?.token;
    // Si le JWT marque explicitement isVisitor, on force /me sur les autres routes.
    if (token?.isVisitor && !VISITOR_ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p + "/"))) {
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
