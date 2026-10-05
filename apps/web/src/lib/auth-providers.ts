/**
 * How a sign-in provider button behaves:
 * - "on": the provider is configured;
 * - "setup": development without keys, the button is visible and explains what to configure;
 * - "off": production without keys, no button (customers never see one that cannot work).
 */
export type ProviderButton = "on" | "setup" | "off";
