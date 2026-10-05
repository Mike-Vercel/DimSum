import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { features } from "@/server/env";
import { POLICY_VERSION } from "@/server/services/consents";

export const metadata: Metadata = {
  title: "Cookie policy",
  description:
    "I cookie e gli strumenti tecnici usati da DIMSUM: solo quelli necessari al servizio, nessuna profilazione.",
  alternates: { canonical: "/cookie" },
};

const COOKIES: [string, string, string][] = [
  [
    "dimsum.session_token",
    "Mantiene l'accesso al tuo account (anche dopo aver chiuso il browser).",
    "60 giorni",
  ],
  ["dimsum.session_data", "Copia firmata della sessione per rispondere più velocemente.", "5 minuti"],
  [
    "dimsum.recent_orders",
    "Ricorda gli ordini fatti da questo dispositivo per seguirli e collegarli al tuo account.",
    "14 giorni",
  ],
  [
    "dimsum.state, dimsum.oauth_state",
    "Proteggono l'accesso con Google o Apple durante il login.",
    "Pochi minuti",
  ],
];

const STORAGE: [string, string][] = [
  ["dimsum.cart", "Il carrello, così non si perde se ricarichi la pagina o chiudi l'app."],
  ["dimsum.order-prefs", "Consegna o ritiro, indirizzo e orario scelti."],
  ["dimsum.checkout", "I dati inseriti al checkout, per non doverli riscrivere."],
  ["dimsum.cookie-notice", "Ricorda che hai già letto l'avviso sui cookie."],
];

export default function CookiePage() {
  const stripe = features().paymentProvider === "stripe";
  return (
    <LegalDocument
      title="Cookie policy"
      version={POLICY_VERSION}
      intro={
        <p>
          Usiamo esclusivamente cookie e strumenti tecnici, necessari a far funzionare carrello, accesso e
          pagamenti. Non usiamo cookie di profilazione, pubblicità o statistiche di terze parti: per questo
          non ti chiediamo alcun consenso.
        </p>
      }
    >
      <LegalSection title="Cookie tecnici">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>A cosa serve</th>
              <th>Durata</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map(([name, purpose, duration]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{purpose}</td>
                <td>{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="Memoria del dispositivo">
        <p>
          Alcune preferenze restano solo sul tuo dispositivo (local storage) e non vengono inviate a nessuno
          finché non effettui un ordine:
        </p>
        <table>
          <tbody>
            {STORAGE.map(([name, purpose]) => (
              <tr key={name}>
                <td>
                  <code>{name}</code>
                </td>
                <td>{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Quando esci dall&apos;account cancelliamo da questo dispositivo carrello, indirizzo e dati del
          checkout.
        </p>
      </LegalSection>

      {stripe ? (
        <LegalSection title="Pagamenti">
          <p>
            Durante il pagamento online il modulo di Stripe può impostare cookie tecnici propri per la
            prevenzione delle frodi (es. <code>__stripe_mid</code>, <code>__stripe_sid</code>). Sono necessari
            a completare il pagamento in sicurezza; maggiori dettagli nella{" "}
            <a href="https://stripe.com/it/cookie-settings" target="_blank" rel="noopener noreferrer">
              cookie policy di Stripe
            </a>
            .
          </p>
        </LegalSection>
      ) : null}

      <LegalSection title="Mappe">
        <p>
          Le mappe sono caricate come immagini dai server del fornitore delle mappe, senza cookie di
          profilazione.
        </p>
      </LegalSection>

      <LegalSection title="Come gestirli">
        <p>
          Puoi cancellare cookie e dati salvati dalle impostazioni del browser: perderai il carrello e
          l&apos;accesso, che potrai rifare in qualsiasi momento. Per il resto valgono le informazioni
          dell&apos;<Link href="/privacy">informativa privacy</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
