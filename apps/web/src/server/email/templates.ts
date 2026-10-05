/**
 * Transactional e-mail templates (Italian). Marketing e-mails are never sent from here.
 */
import { formatEuro } from "@dimsum/domain";
import { html, htmlToText } from "./html";
import {
  badge,
  button,
  divider,
  h1,
  infoBox,
  itemsTable,
  layout,
  p,
  totalsTable,
  type BrandContext,
  type EmailLine,
  type EmailTotals,
} from "./layout";

export interface RenderedEmail {
  template: string;
  subject: string;
  html: string;
  text: string;
}

export interface OrderEmailData {
  number: string;
  trackingUrl: string;
  customerFirstName: string;
  fulfillmentType: "DELIVERY" | "PICKUP";
  placedAtLabel: string;
  whenLabel: string | null;
  addressLine: string | null;
  paymentLabel: string;
  lines: EmailLine[];
  totals: EmailTotals;
  isGuest: boolean;
  signupUrl: string;
  riderName?: string | null;
  cancellationReason?: string | null;
  refundCents?: number;
  reviewUrl?: string | null;
}

function finalize(template: string, subject: string, htmlBody: string): RenderedEmail {
  return { template, subject, html: htmlBody, text: htmlToText(htmlBody) };
}

function orderSummary(o: OrderEmailData) {
  const rows: [string, string][] = [
    ["Ordine", `#${o.number}`],
    ["Modalità", o.fulfillmentType === "DELIVERY" ? "Consegna a domicilio" : "Ritiro al locale"],
  ];
  if (o.whenLabel)
    rows.push([o.fulfillmentType === "DELIVERY" ? "Arrivo previsto" : "Pronto per", o.whenLabel]);
  if (o.addressLine) rows.push(["Indirizzo", o.addressLine]);
  rows.push(["Pagamento", o.paymentLabel]);
  return html`${infoBox(rows)}${divider()}${itemsTable(o.lines)}${divider()}${totalsTable(o.totals)}`;
}

export function orderReceivedEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${h1(`Grazie ${o.customerFirstName}, abbiamo ricevuto il tuo ordine`)}
  ${p("La cucina lo sta per confermare. Ti aggiorneremo a ogni passaggio: puoi seguirlo in tempo reale dal link qui sotto.")}
  ${button("Segui il tuo ordine", o.trackingUrl)} ${orderSummary(o)}
  ${o.isGuest ? html`${divider()}${p(html`<strong>Vuoi ordinare più velocemente la prossima volta?</strong> Con un account hai indirizzi salvati, riordino in un tap e offerte riservate. <a href="${o.signupUrl}">Crea il tuo account</a>.`, { muted: true, size: 14 })}` : ""}`;
  return finalize(
    "order_received",
    `Ordine #${o.number} ricevuto`,
    layout(brand, {
      preheader: `Ordine #${o.number}: ${formatEuro(o.totals.totalCents)}`,
      title: "Ordine ricevuto",
      body,
    }),
  );
}

export function paymentConfirmedEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${badge("Pagamento confermato")}
    <div style="height:14px"></div>
    ${h1(`Pagamento di ${formatEuro(o.totals.totalCents)} ricevuto`)}
    ${p(`Il pagamento dell'ordine #${o.number} è andato a buon fine. Questa e-mail vale come ricevuta di pagamento (non è un documento fiscale: lo scontrino ti verrà consegnato con l'ordine).`, { muted: true })}
    ${orderSummary(o)} ${button("Segui il tuo ordine", o.trackingUrl)}`;
  return finalize(
    "payment_confirmed",
    `Pagamento confermato · Ordine #${o.number}`,
    layout(brand, { preheader: `Ricevuta dell'ordine #${o.number}`, title: "Pagamento confermato", body }),
  );
}

export function orderConfirmedEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${h1("La cucina ha confermato il tuo ordine")}
  ${p(o.whenLabel ? (o.fulfillmentType === "DELIVERY" ? `Arrivo previsto: ${o.whenLabel}.` : `Sarà pronto per il ritiro: ${o.whenLabel}.`) : "Stiamo preparando il tuo ordine.")}
  ${button("Segui il tuo ordine", o.trackingUrl)} ${orderSummary(o)}`;
  return finalize(
    "order_confirmed",
    `Ordine #${o.number} confermato`,
    layout(brand, {
      preheader: o.whenLabel ? `Previsto ${o.whenLabel}` : "In preparazione",
      title: "Ordine confermato",
      body,
    }),
  );
}

export function readyForPickupEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${h1("Il tuo ordine è pronto per il ritiro")}
  ${p(`Ti aspettiamo da ${brand.restaurantName}, ${brand.address}. Mostra il numero d'ordine al banco: #${o.number}.`)}
  ${button("Apri l'ordine", o.trackingUrl)}`;
  return finalize(
    "ready_for_pickup",
    `Ordine #${o.number} pronto per il ritiro`,
    layout(brand, { preheader: `Ti aspettiamo: ordine #${o.number}`, title: "Pronto per il ritiro", body }),
  );
}

export function outForDeliveryEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${h1(o.riderName ? `${o.riderName} sta arrivando` : "Il tuo ordine è in consegna")}
  ${p(o.whenLabel ? `Arrivo previsto: ${o.whenLabel}. Segui il rider sulla mappa in tempo reale.` : "Segui il rider sulla mappa in tempo reale.")}
  ${button("Segui la consegna", o.trackingUrl)}`;
  return finalize(
    "out_for_delivery",
    `Ordine #${o.number} in consegna`,
    layout(brand, { preheader: "Il rider ha ritirato il tuo ordine", title: "In consegna", body }),
  );
}

export function deliveredEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const delivered = o.fulfillmentType === "DELIVERY";
  const body = html`${h1("Buon appetito!")}
  ${p(delivered ? `L'ordine #${o.number} è stato consegnato.` : `Hai ritirato l'ordine #${o.number}.`)}
  ${p("Grazie per aver ordinato direttamente da noi: per il ristorante fa una grande differenza.", { muted: true })}
  ${o.reviewUrl ? button("Lasciaci una recensione", o.reviewUrl) : ""}
  ${o.isGuest ? p(html`Crea un account per ritrovare questo ordine e riordinarlo in un tap: <a href="${o.signupUrl}">registrati</a>.`, { muted: true, size: 14 }) : ""}`;
  const outcome = delivered ? "consegnato" : "ritirato";
  return finalize(
    "order_delivered",
    `Ordine #${o.number} ${outcome}`,
    layout(brand, { preheader: "Grazie per averci scelto", title: `Ordine ${outcome}`, body }),
  );
}

export function orderCancelledEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const body = html`${h1(`L'ordine #${o.number} è stato annullato`)}
  ${o.cancellationReason ? p(`Motivo: ${o.cancellationReason}`) : ""}
  ${p(
    o.paymentLabel.startsWith("Contanti")
      ? "Non ti è stato addebitato nulla."
      : "Se il pagamento era già stato addebitato riceverai il rimborso completo sullo stesso metodo di pagamento (di solito in 5–10 giorni lavorativi).",
    { muted: true },
  )}
  ${button("Vedi l'ordine", o.trackingUrl)}
  ${p(html`Hai bisogno di aiuto? Rispondi a questa e-mail o scrivici dalla pagina <a href="${brand.appUrl}/supporto">assistenza</a>.`, { muted: true, size: 14 })}`;
  return finalize(
    "order_cancelled",
    `Ordine #${o.number} annullato`,
    layout(brand, { preheader: "Il tuo ordine è stato annullato", title: "Ordine annullato", body }),
  );
}

export function refundEmail(brand: BrandContext, o: OrderEmailData): RenderedEmail {
  const amount = formatEuro(o.refundCents ?? 0);
  const body = html`${h1(`Rimborso di ${amount} in arrivo`)}
  ${p(`Abbiamo disposto un rimborso di ${amount} per l'ordine #${o.number}. L'importo tornerà sul metodo di pagamento utilizzato entro 5–10 giorni lavorativi, a seconda della banca.`)}
  ${button("Vedi l'ordine", o.trackingUrl)}`;
  return finalize(
    "refund_issued",
    `Rimborso ordine #${o.number}`,
    layout(brand, { preheader: `Rimborso di ${amount}`, title: "Rimborso", body }),
  );
}

export function welcomeEmail(
  brand: BrandContext,
  data: { firstName: string; menuUrl: string },
): RenderedEmail {
  const body = html`${h1(`Benvenuto da ${brand.restaurantName}, ${data.firstName}!`)}
  ${p("Il tuo account è pronto. Da ora puoi salvare i tuoi indirizzi, ritrovare gli ordini precedenti, riordinare in un tap e ricevere le offerte riservate (solo se ce lo consenti).")}
  ${button("Ordina ora", data.menuUrl)}`;
  return finalize(
    "welcome",
    `Benvenuto da ${brand.restaurantName}`,
    layout(brand, { preheader: "Il tuo account DIMSUM è pronto", title: "Benvenuto", body }),
  );
}

export function verifyEmailEmail(
  brand: BrandContext,
  data: { firstName: string; url: string },
): RenderedEmail {
  const body = html`${h1("Conferma il tuo indirizzo e-mail")}
  ${p(`Ciao ${data.firstName}, conferma la tua e-mail per proteggere l'account e collegare gli ordini fatti come ospite.`)}
  ${button("Conferma e-mail", data.url)}
  ${p("Se non hai creato tu l'account puoi ignorare questo messaggio.", { muted: true, size: 14 })}`;
  return finalize(
    "verify_email",
    "Conferma la tua e-mail",
    layout(brand, {
      preheader: "Un ultimo passo per completare la registrazione",
      title: "Conferma e-mail",
      body,
    }),
  );
}

export function passwordResetEmail(
  brand: BrandContext,
  data: { firstName: string; url: string },
): RenderedEmail {
  const body = html`${h1("Reimposta la password")}
  ${p(`Ciao ${data.firstName}, abbiamo ricevuto una richiesta di reimpostazione della password del tuo account.`)}
  ${button("Scegli una nuova password", data.url)}
  ${p("Il link scade tra un'ora. Se non hai fatto tu la richiesta, ignora questa e-mail: la tua password resta invariata.", { muted: true, size: 14 })}`;
  return finalize(
    "password_reset",
    "Reimposta la tua password",
    layout(brand, { preheader: "Link per reimpostare la password", title: "Reimposta password", body }),
  );
}

export function teamInviteEmail(
  brand: BrandContext,
  data: { firstName: string; url: string; roleLabel: string },
): RenderedEmail {
  const body = html`${h1(`Benvenuto nel team ${brand.restaurantName}`)}
  ${p(`Ciao ${data.firstName}, è stato creato il tuo account ${data.roleLabel}. Scegli la tua password per accedere.`)}
  ${button("Scegli la password", data.url)}
  ${p("Il link scade tra un'ora: se è scaduto chiedi un nuovo invito al ristorante.", { muted: true, size: 14 })}`;
  return finalize(
    "team_invite",
    `Il tuo account ${brand.restaurantName}`,
    layout(brand, { preheader: "Scegli la tua password", title: "Benvenuto", body }),
  );
}

export function supportReceivedEmail(
  brand: BrandContext,
  data: { firstName: string; reference: string; subject: string },
): RenderedEmail {
  const body = html`${h1("Abbiamo ricevuto la tua richiesta")}
  ${p(`Ciao ${data.firstName}, il nostro staff ti risponderà al più presto. Riferimento: ${data.reference}.`)}
  ${infoBox([
    ["Oggetto", data.subject],
    ["Riferimento", data.reference],
  ])}`;
  return finalize(
    "support_received",
    `Richiesta di assistenza ${data.reference}`,
    layout(brand, { preheader: "Ti risponderemo al più presto", title: "Assistenza", body }),
  );
}

export function supportReplyEmail(
  brand: BrandContext,
  data: { firstName: string; reference: string; subject: string; body: string; staffName: string },
): RenderedEmail {
  const body = html`${h1("Ti abbiamo risposto")}
    ${p(`Ciao ${data.firstName}, ecco la risposta alla tua richiesta ${data.reference}.`)}
    ${infoBox([["Oggetto", data.subject]])}
    <div style="height:16px"></div>
    ${p(data.body, { preserveLines: true })}
    ${p(`— ${data.staffName}, ${brand.restaurantName}`, { muted: true, size: 14 })}
    ${p("Puoi rispondere direttamente a questa e-mail.", { muted: true, size: 14 })}`;
  return finalize(
    "support_reply",
    `Re: ${data.subject} [${data.reference}]`,
    layout(brand, { preheader: data.body.slice(0, 90), title: "Assistenza", body }),
  );
}

export function supportStaffEmail(
  brand: BrandContext,
  data: {
    reference: string;
    category: string;
    subject: string;
    message: string;
    name: string;
    email: string;
    phone: string | null;
    orderNumber: string | null;
    adminUrl: string;
  },
): RenderedEmail {
  const body = html`${h1(`Nuova richiesta di assistenza ${data.reference}`)}
    ${infoBox([
      ["Categoria", data.category],
      ["Cliente", `${data.name} · ${data.email}${data.phone ? ` · ${data.phone}` : ""}`],
      ["Ordine", data.orderNumber ? `#${data.orderNumber}` : "—"],
      ["Oggetto", data.subject],
    ])}
    <div style="height:16px"></div>
    ${p(data.message, { preserveLines: true })} ${button("Apri nel gestionale", data.adminUrl)}`;
  return finalize(
    "support_staff",
    `[Assistenza] ${data.subject}`,
    layout(brand, { preheader: data.subject, title: "Assistenza", body }),
  );
}
