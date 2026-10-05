/**
 * Branded, responsive e-mail layout (table based for Outlook/Gmail, inline styles only).
 */
import { formatEuro } from "@dimsum/domain";
import { html, raw, type RawHtml } from "./html";

export interface BrandContext {
  appUrl: string;
  restaurantName: string;
  address: string;
  phone: string | null;
  legalLine: string | null;
}

const C = {
  canvas: "#F6F1EA",
  card: "#FFFFFF",
  ink: "#141210",
  muted: "#6B635B",
  line: "#E8E0D4",
  red: "#D82A1E",
  dark: "#0E0D0C",
};

export function layout(
  brand: BrandContext,
  opts: { preheader: string; title: string; body: RawHtml; footerNote?: string },
): string {
  const logo = `${brand.appUrl.replace(/\/$/, "")}/brand/email-logo-white.png`;
  return html`<!doctype html>
    <html lang="it">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <title>${opts.title}</title>
        <style>
          @media (max-width: 620px) {
            .container {
              width: 100% !important;
            }
            .px {
              padding-left: 20px !important;
              padding-right: 20px !important;
            }
            .h1 {
              font-size: 24px !important;
              line-height: 30px !important;
            }
          }
          a {
            color: ${C.red};
          }
        </style>
      </head>
      <body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          ${opts.preheader}
        </div>
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          style="background:${C.canvas};"
        >
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table
                role="presentation"
                class="container"
                width="600"
                cellpadding="0"
                cellspacing="0"
                style="width:600px;max-width:600px;"
              >
                <tr>
                  <td style="background:${C.dark};border-radius:20px 20px 0 0;padding:26px 32px;" class="px">
                    <img
                      src="${logo}"
                      width="180"
                      height="22"
                      alt="${brand.restaurantName}"
                      style="display:block;border:0;outline:none;height:auto;width:180px;"
                    />
                  </td>
                </tr>
                <tr>
                  <td
                    style="background:${C.card};padding:32px;border-radius:0 0 20px 20px;font-family:Arial,Helvetica,sans-serif;color:${C.ink};"
                    class="px"
                  >
                    ${opts.body}
                  </td>
                </tr>
                <tr>
                  <td
                    style="padding:24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${C.muted};text-align:center;"
                    class="px"
                  >
                    ${opts.footerNote ? html`<p style="margin:0 0 10px;">${opts.footerNote}</p>` : ""}
                    <p style="margin:0;">
                      ${brand.restaurantName} ·
                      ${brand.address}${brand.phone ? html` · <a href="tel:${brand.phone}" style="color:${C.muted};">${brand.phone}</a>` : ""}
                    </p>
                    ${brand.legalLine ? html`<p style="margin:6px 0 0;">${brand.legalLine}</p>` : ""}
                    <p style="margin:10px 0 0;">
                      <a href="${brand.appUrl}/privacy" style="color:${C.muted};">Privacy</a> ·
                      <a href="${brand.appUrl}/termini" style="color:${C.muted};">Termini</a> ·
                      <a href="${brand.appUrl}/supporto" style="color:${C.muted};">Assistenza</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`.value;
}

export const h1 = (text: string) =>
  html`<h1
    class="h1"
    style="margin:0 0 12px;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.3px;color:${C.ink};"
  >
    ${text}
  </h1>`;

/** Paragraph; `preserveLines` keeps the line breaks of text written by people (support replies). */
export const p = (
  content: string | RawHtml,
  opts: { muted?: boolean; size?: number; preserveLines?: boolean } = {},
) =>
  html`<p
    style="margin:0 0 16px;font-size:${opts.size ?? 16}px;line-height:24px;color:${opts.muted ? C.muted : C.ink};${opts.preserveLines ? "white-space:pre-line;" : ""}"
  >
    ${content}
  </p>`;

export const button = (label: string, href: string) =>
  html`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
    <tr>
      <td style="border-radius:14px;background:${C.red};">
        <a
          href="${href}"
          style="display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px;"
          >${label}</a
        >
      </td>
    </tr>
  </table>`;

export const divider = () => html`<div style="height:1px;background:${C.line};margin:24px 0;"></div>`;

export const badge = (label: string) =>
  html`<span
    style="display:inline-block;padding:4px 10px;border-radius:999px;background:#FDEEEC;color:#C2241A;font-size:13px;font-weight:700;"
    >${label}</span
  >`;

export interface EmailLine {
  quantity: number;
  name: string;
  details: string[];
  totalCents: number;
}

export const itemsTable = (lines: EmailLine[]) =>
  html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="font-size:15px;line-height:22px;"
  >
    ${lines.map(
      (l) =>
        html`<tr>
          <td valign="top" style="padding:8px 10px 8px 0;width:28px;font-weight:700;color:${C.ink};">
            ${l.quantity}×
          </td>
          <td valign="top" style="padding:8px 0;color:${C.ink};">
            ${l.name}${l.details.length ? html`<br /><span style="font-size:13px;color:${C.muted};">${l.details.join(" · ")}</span>` : ""}
          </td>
          <td valign="top" align="right" style="padding:8px 0 8px 10px;white-space:nowrap;color:${C.ink};">
            ${formatEuro(l.totalCents)}
          </td>
        </tr>`,
    )}
  </table>`;

export interface EmailTotals {
  subtotalCents: number;
  discountCents: number;
  deliveryFeeCents: number;
  serviceFeeCents: number;
  tipCents: number;
  taxCents: number;
  totalCents: number;
}

export const totalsTable = (t: EmailTotals) => {
  const row = (label: string, value: string, strong = false) =>
    html`<tr>
      <td
        style="padding:4px 0;color:${strong ? C.ink : C.muted};font-size:${strong ? 17 : 15}px;font-weight:${strong ? 800 : 400};"
      >
        ${label}
      </td>
      <td
        align="right"
        style="padding:4px 0;color:${C.ink};font-size:${strong ? 17 : 15}px;font-weight:${strong ? 800 : 400};white-space:nowrap;"
      >
        ${value}
      </td>
    </tr>`;
  return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Subtotale", formatEuro(t.subtotalCents))}
    ${t.discountCents ? row("Sconto", `−${formatEuro(t.discountCents)}`) : ""}
    ${t.deliveryFeeCents ? row("Consegna", formatEuro(t.deliveryFeeCents)) : ""}
    ${t.serviceFeeCents ? row("Servizio", formatEuro(t.serviceFeeCents)) : ""}
    ${t.tipCents ? row("Mancia al rider", formatEuro(t.tipCents)) : ""}
    ${row("Totale", formatEuro(t.totalCents), true)}
    <tr>
      <td colspan="2" style="padding-top:4px;font-size:12px;color:${C.muted};">
        Prezzi IVA inclusa (IVA ${formatEuro(t.taxCents)}).
      </td>
    </tr>
  </table>`;
};

export const infoBox = (rows: [string, string][]) =>
  html`<table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    style="background:#FCFAF7;border:1px solid ${C.line};border-radius:14px;"
  >
    ${rows.map(
      ([k, v]) =>
        html`<tr>
          <td style="padding:10px 14px;font-size:13px;color:${C.muted};width:38%;">${k}</td>
          <td style="padding:10px 14px;font-size:14px;color:${C.ink};font-weight:600;">${v}</td>
        </tr>`,
    )}
  </table>`;

export { raw };
