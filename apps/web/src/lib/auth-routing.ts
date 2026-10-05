import type { Role } from "@dimsum/types";

/** Only same-site paths are accepted as post-login destinations (no open redirects). */
export function safeNext(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("/api/")
  )
    return null;
  return value;
}

/** Where each role lands after signing in when no destination was requested. */
export function homeForRole(role: Role | string | null | undefined): string {
  if (role === "RIDER") return "/rider";
  if (role === "STAFF" || role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  return "/account";
}

interface AuthErrorLike {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

/** Better Auth error → message for customers (never the raw technical text). */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (error?.status === 429) return "Troppi tentativi ravvicinati. Attendi un minuto e riprova.";
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail o password non corretti.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Esiste già un account con questa e-mail. Accedi oppure reimposta la password.";
    case "PASSWORD_TOO_SHORT":
      return "La password deve avere almeno 10 caratteri.";
    case "PASSWORD_TOO_LONG":
      return "La password è troppo lunga (massimo 128 caratteri).";
    case "INVALID_EMAIL":
      return "Indirizzo e-mail non valido.";
    case "INVALID_TOKEN":
      return "Il link non è più valido. Richiedine uno nuovo.";
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Questo account usa l'accesso con Google o Apple.";
  }
  // Disabled accounts: the server already sends a customer-facing message.
  if (error?.status === 403 && error.message) return error.message;
  return "Non è stato possibile completare l'operazione. Riprova.";
}
