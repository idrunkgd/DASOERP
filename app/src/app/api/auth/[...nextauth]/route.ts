import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Force le runtime Node + dynamique : empêche Next.js d'essayer de
// pré-rendre la route à la build (qui crashe NextAuth si NEXTAUTH_URL
// n'est pas accessible au build et fait foirer "page data collection").
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
