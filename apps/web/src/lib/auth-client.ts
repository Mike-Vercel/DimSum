"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ basePath: "/api/auth" });

export const { useSession, signIn, signUp, signOut } = authClient;

export type ClientSession = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
