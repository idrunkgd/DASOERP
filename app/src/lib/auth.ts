import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    isVisitor: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: { accessGroup: { select: { name: true, permissions: true } } }
        });
        if (!user || !user.active) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        // Visiteur = aucune permission *effective* (groupe + overrides cumulés).
        // Un user dans le groupe "Visiteur" qui a reçu des grants individuels
        // n'est PAS Visiteur — il accède aux modules pour lesquels il a un
        // override granted.
        const basePerms = new Set<string>(user.accessGroup?.permissions ?? []);
        const overrides = await prisma.userPermissionOverride.findMany({
          where: { userId: user.id },
          select: { permission: true, granted: true }
        });
        for (const o of overrides) {
          if (o.granted) basePerms.add(o.permission);
          else basePerms.delete(o.permission);
        }
        const isVisitor = basePerms.size === 0;
        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          isVisitor
        } as any;
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.isVisitor = (user as any).isVisitor ?? false;
      }
      // Permet de rafraîchir isVisitor lorsqu'on change un groupe ou un override
      // de permission (via update()). Recalcule sur les permissions effectives.
      if (trigger === "update" && token?.id) {
        const [u, overrides] = await Promise.all([
          prisma.user.findUnique({
            where: { id: token.id as string },
            include: { accessGroup: { select: { name: true, permissions: true } } }
          }),
          prisma.userPermissionOverride.findMany({
            where: { userId: token.id as string },
            select: { permission: true, granted: true }
          })
        ]);
        if (u) {
          const set = new Set<string>(u.accessGroup?.permissions ?? []);
          for (const o of overrides) {
            if (o.granted) set.add(o.permission);
            else set.delete(o.permission);
          }
          token.isVisitor = set.size === 0;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = session.user.name ?? "";
        session.user.email = session.user.email ?? "";

        // ─── Mode démo : impersonation Jean Démo ────────────────────────
        // Debug tracing : on log chaque étape dans AppLog (visible sur /logs)
        // pour diagnostiquer pourquoi le swap ne se déclenche pas.
        const trace: string[] = [];
        try {
          const { cookies } = await import("next/headers");
          let demoCookie;
          try {
            demoCookie = cookies().get("demo-mode");
            trace.push(`cookies() OK — demo-mode = "${demoCookie?.value ?? "<absent>"}"`);
          } catch (e: any) {
            trace.push(`cookies() THROW : ${e?.message ?? e}`);
            throw e;
          }
          if (demoCookie?.value === "1") {
            // Le check de sécurité est fait dans enableDemoMode() — seul le
            // chemin admin/manager peut poser le cookie. Ici on trust le cookie
            // et on applique le swap. Ça évite le piège du User.role vs
            // AccessGroup.permissions (un user role=CONSULTANT peut être admin
            // via son AccessGroup).
            const demoUser = await prisma.user.findFirst({
              where: { isDemo: true } as any,
              select: { id: true, firstName: true, lastName: true, email: true, role: true }
            });
            trace.push(`demoUser = ${demoUser ? `${demoUser.firstName} ${demoUser.lastName} (${demoUser.role})` : "null"}`);
            if (demoUser) {
              session.user.id = demoUser.id;
              session.user.name = `${demoUser.firstName} ${demoUser.lastName}`;
              session.user.email = demoUser.email;
              session.user.role = demoUser.role;
              trace.push("SWAP DONE");
            }
          }
          // Log toujours (INFO) pour voir chaque appel dans /logs
          try {
            const { logAppError } = await import("./app-log");
            await logAppError({
              level: "INFO",
              message: `[demo-mode session callback] ${trace.join(" | ")}`,
              userId: token.id as string,
              meta: { trace, realRole: token.role, sessionName: session.user.name }
            });
          } catch { /* app-log pas dispo — silencieux */ }
        } catch (e: any) {
          try {
            const { logAppError } = await import("./app-log");
            await logAppError({
              level: "ERROR",
              message: `[demo-mode session callback] FAILED : ${e?.message ?? e}`,
              stack: e?.stack ?? null,
              userId: token.id as string,
              meta: { trace }
            });
          } catch { /* silent */ }
        }
      }
      return session;
    }
  }
};
