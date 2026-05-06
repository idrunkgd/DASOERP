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
        // Visiteur = pas de groupe OU groupe nommé "Visiteur" OU groupe avec 0 perm
        const isVisitor = !user.accessGroup
          || user.accessGroup.name === "Visiteur"
          || (user.accessGroup.permissions?.length ?? 0) === 0;
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
      // Permet de rafraîchir isVisitor lorsqu'on change un groupe (via update())
      if (trigger === "update" && token?.id) {
        const u = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { accessGroup: { select: { name: true, permissions: true } } }
        });
        if (u) {
          token.isVisitor = !u.accessGroup
            || u.accessGroup.name === "Visiteur"
            || (u.accessGroup.permissions?.length ?? 0) === 0;
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
