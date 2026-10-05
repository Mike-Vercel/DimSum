import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { env, features } from "@/server/env";
import { POLICY_VERSION } from "@/server/services/consents";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Informativa privacy",
  description:
    "Come DIMSUM tratta i dati personali di clienti e rider: finalità, basi giuridiche, conservazione e diritti.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const config = await getRestaurantConfig();
  const f = features();
  const e = env();
  const controller = [
    config.legalName ?? config.name,
    config.address.formatted,
    config.vatNumber ? `P.IVA ${config.vatNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const contact = config.supportEmail ?? config.email;
  const maps =
    f.mapsProvider === "google"
      ? "Google Ireland Ltd. (Google Maps Platform) per la ricerca degli indirizzi e il calcolo dei percorsi"
      : f.mapsProvider === "mapbox"
        ? "Mapbox Inc. per la ricerca degli indirizzi e il calcolo dei percorsi"
        : "servizi basati su OpenStreetMap: OSRM per il calcolo dei percorsi e OpenFreeMap per le mappe (la ricerca degli indirizzi usa un archivio delle vie ospitato da noi e non coinvolge terzi)";

  return (
    <LegalDocument
      title="Informativa privacy"
      version={POLICY_VERSION}
      intro={
        <p>
          Questa informativa spiega quali dati raccogliamo quando ordini da DIMSUM sul sito, sull&apos;app o
          lavori con noi come rider, perché lo facciamo e come puoi esercitare i tuoi diritti (artt. 13 e 14
          del Regolamento UE 2016/679, &quot;GDPR&quot;).
        </p>
      }
    >
      <LegalSection title="1. Titolare del trattamento">
        <p>{controller}.</p>
        {contact ? (
          <p>
            Per qualsiasi richiesta sulla privacy scrivi a <a href={`mailto:${contact}`}>{contact}</a>
            {config.phone ? <> oppure chiama il {config.phone}</> : null}.
          </p>
        ) : null}
      </LegalSection>

      <LegalSection title="2. Quali dati trattiamo">
        <ul>
          <li>
            <strong>Dati dell&apos;ordine</strong>: nome, e-mail, telefono, prodotti scelti, note per la
            cucina, importi, modalità (consegna o ritiro) e orari.
          </li>
          <li>
            <strong>Indirizzo di consegna</strong>: via, civico, citofono, piano e note per il rider, con le
            coordinate necessarie a verificare la zona e stimare i tempi.
          </li>
          <li>
            <strong>Pagamenti</strong>: esito, importo, circuito e ultime 4 cifre della carta. I dati completi
            della carta sono gestiti esclusivamente dal fornitore dei pagamenti e non transitano sui nostri
            server.
          </li>
          <li>
            <strong>Account</strong> (facoltativo): nome, e-mail, password cifrata o accesso con Google
            {f.appleAuth ? "/Apple" : ""}, telefono, indirizzi salvati, preferiti, storico ordini, consensi e,
            se il programma fedeltà è attivo, punti e data di nascita se scegli di indicarla.
          </li>
          <li>
            <strong>Assistenza</strong>: il contenuto delle richieste che ci invii.
          </li>
          <li>
            <strong>Notifiche</strong>: l&apos;identificativo tecnico del dispositivo per le notifiche push,
            solo se le attivi.
          </li>
          <li>
            <strong>Rider</strong>: dati dell&apos;account di lavoro e posizione GPS{" "}
            <em>solo durante le consegne in corso</em>.
          </li>
          <li>
            <strong>Dati tecnici</strong>: indirizzo IP e tipo di dispositivo associati alle sessioni di
            accesso, per la sicurezza dell&apos;account; nei nostri registri anti-abuso l&apos;IP è conservato
            solo in forma cifrata non reversibile.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Perché li trattiamo e su quale base">
        <table>
          <thead>
            <tr>
              <th>Finalità</th>
              <th>Base giuridica</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                Ricevere, preparare, consegnare l&apos;ordine e aggiornarti sullo stato (e-mail, notifiche,
                pagina di tracking)
              </td>
              <td>Esecuzione del contratto (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Gestire l&apos;account, gli indirizzi, i preferiti e lo storico</td>
              <td>Esecuzione del contratto (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Contabilità, fatturazione e obblighi fiscali</td>
              <td>Obbligo di legge (art. 6.1.c)</td>
            </tr>
            <tr>
              <td>Sicurezza, prevenzione di frodi e abusi, difesa in giudizio</td>
              <td>Legittimo interesse (art. 6.1.f)</td>
            </tr>
            <tr>
              <td>Rispondere alle richieste di assistenza</td>
              <td>Esecuzione del contratto o misure precontrattuali (art. 6.1.b)</td>
            </tr>
            <tr>
              <td>Offerte e novità via e-mail o notifica</td>
              <td>Consenso, facoltativo e revocabile (art. 6.1.a)</td>
            </tr>
            <tr>
              <td>Posizione del rider durante la consegna, per il cliente e la stima dei tempi</td>
              <td>Esecuzione del contratto e legittimo interesse all&apos;organizzazione del servizio</td>
            </tr>
          </tbody>
        </table>
        <p>
          Non effettuiamo profilazione né decisioni automatizzate con effetti giuridici. Non vendiamo i tuoi
          dati.
        </p>
      </LegalSection>

      <LegalSection title="4. A chi comunichiamo i dati">
        <p>Ai soli fornitori che ci aiutano a erogare il servizio, nominati responsabili del trattamento:</p>
        <ul>
          <li>hosting dell&apos;applicazione (Vercel Inc.) e fornitore del database;</li>
          {f.paymentProvider === "stripe" ? (
            <li>Stripe Payments Europe Ltd. per i pagamenti online;</li>
          ) : null}
          {e.EMAIL_PROVIDER === "brevo" ? (
            <li>Sendinblue SAS (Brevo), Francia, per l&apos;invio delle e-mail;</li>
          ) : e.EMAIL_PROVIDER === "resend" ? (
            <li>Resend, per l&apos;invio delle e-mail;</li>
          ) : (
            <li>il fornitore del servizio di posta elettronica;</li>
          )}
          <li>{maps};</li>
          {f.googleAuth ? <li>Google Ireland Ltd., se scegli di accedere con Google;</li> : null}
          {f.appleAuth ? (
            <li>Apple Distribution International Ltd., se scegli di accedere con Apple;</li>
          ) : null}
          <li>
            i rider che effettuano la consegna, limitatamente a nome, telefono e indirizzo dell&apos;ordine
            affidato.
          </li>
        </ul>
        <p>
          Alcuni fornitori possono trattare dati fuori dallo Spazio economico europeo: in tal caso il
          trasferimento avviene sulla base di decisioni di adeguatezza della Commissione europea o di clausole
          contrattuali standard.
        </p>
      </LegalSection>

      <LegalSection title="5. Per quanto tempo li conserviamo">
        <ul>
          <li>
            Ordini e documenti contabili: 10 anni, come previsto dalla normativa civilistica e fiscale. Se
            elimini l&apos;account, gli ordini restano senza i tuoi recapiti.
          </li>
          <li>Account: finché non lo elimini (puoi farlo in ogni momento da “Privacy e dati”).</li>
          <li>Posizioni GPS dei rider: 30 giorni, poi cancellate automaticamente.</li>
          <li>Registri tecnici e di sicurezza: fino a 12 mesi.</li>
          <li>Consensi: per tutta la durata del trattamento e il tempo necessario a dimostrarli.</li>
          <li>Richieste di assistenza: fino a 24 mesi dalla chiusura.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. I tuoi diritti">
        <p>
          Puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità dei dati e opporti al
          trattamento basato sul legittimo interesse; puoi revocare i consensi in ogni momento senza
          pregiudicare la liceità dei trattamenti precedenti. Se hai un account trovi tutto in{" "}
          <Link href="/account/privacy">Privacy e dati</Link>: scarichi i tuoi dati in un file ed elimini
          l&apos;account in autonomia.
        </p>
        <p>
          Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali (
          <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">
            garanteprivacy.it
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="7. Cookie e tecnologie simili">
        <p>
          Usiamo solo strumenti tecnici necessari al funzionamento del servizio. I dettagli sono nella{" "}
          <Link href="/cookie">cookie policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Minori">
        <p>
          Il servizio è rivolto a maggiori di 14 anni. L&apos;acquisto di bevande alcoliche è riservato ai
          maggiorenni.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
