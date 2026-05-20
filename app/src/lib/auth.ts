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
      }
      return session;
    }
  }
};
