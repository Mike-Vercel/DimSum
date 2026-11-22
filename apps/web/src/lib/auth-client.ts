"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ basePath: "/api/auth", plugins: [emailOTPClient()] });

export const { useSession, signIn, signUp, signOut } = authClient;

export type ClientSession = NonNullable<ReturnType<typeof authClient.useSession>["data"]>;
