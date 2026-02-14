import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema";

/**
 * DB Client for Auth.js
 */
const queryClient = postgres(process.env.DATABASE_URL!);
export const db = drizzle(queryClient, { schema });

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: DrizzleAdapter(db),
    session: { strategy: "jwt" },
    providers: [
        GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
        }),
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        ...(process.env.EMAIL_SERVER && process.env.EMAIL_FROM ? [
            Email({
                server: process.env.EMAIL_SERVER,
                from: process.env.EMAIL_FROM,
            }),
        ] : []),
        Credentials({
            name: "Developer Login",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (process.env.NODE_ENV !== "development") return null;

                const isValidUser = credentials?.email === process.env.DEV_ADMIN_EMAIL;
                const isValidPassword = credentials?.password === process.env.DEMO_PASSWORD;

                if (isValidUser && isValidPassword) {
                    return {
                        id: process.env.DEV_ADMIN_ID!,
                        email: process.env.DEV_ADMIN_EMAIL!,
                        name: process.env.DEV_ADMIN_NAME!
                    };
                }
                return null;
            }
        })
    ],
    callbacks: {
        async signIn({ user }) {
            const isLocal = process.env.NODE_ENV === "development" || process.env.NEXTAUTH_URL?.includes("localhost");
            const email = user.email || "";

            if (isLocal) return true;
            if (email.endsWith("@hr.nl")) return true;

            return false; // Deny access for other domains in production
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
});
