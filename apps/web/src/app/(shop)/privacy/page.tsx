import { BUSINESS_DETAILS } from "@dimsum/types";
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
    BUSINESS_DETAILS.legalName,
    `Sede legale: ${BUSINESS_DETAILS.legalAddress}`,
    `P.IVA ${BUSINESS_DETAILS.vatNumber}`,
    `REA ${BUSINESS_DETAILS.rea}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const contact = config.supportEmail ?? config.email ?? BUSINESS_DETAILS.pec;
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
            <strong>Pagamenti</strong>: metodo scelto (contanti o POS), importo e stato dell’incasso. Paghi di
            persona alla consegna o al ritiro. Il sito non raccoglie né conserva i dati della carta; il
            pagamento con carta avviene sul POS fisico portato dal rider o presente nel locale.
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
            <strong>Assistente virtuale Dim</strong> (facoltativo): i messaggi che scrivi nella chat, per
            risponderti. Non servono dati personali: evita di scrivere recapiti o dati sulla salute oltre a
            quanto ti serve chiedere (ad esempio un&apos;allergia). La conversazione resta solo nella scheda del
            browser e non la conserviamo sui nostri server.
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
        <p>
          I dati dell&apos;ordine (nome, recapiti e, per la consegna, l&apos;indirizzo) sono necessari: senza non
          possiamo preparare e consegnare l&apos;ordine. L&apos;account, il consenso alle offerte e le notifiche
          sono facoltativi e puoi ordinare anche senza.
        </p>
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
              <td>
                E-mail di ringraziamento pochi minuti dopo la consegna, con l&apos;invito facoltativo a lasciare
                una recensione
              </td>
              <td>
                Legittimo interesse (art. 6.1.f): puoi opporti in ogni momento rispondendo all&apos;e-mail o
                scrivendoci
              </td>
            </tr>
            <tr>
              <td>Rispondere alle domande che fai all&apos;assistente virtuale Dim</td>
              <td>Esecuzione di misure richieste da te (art. 6.1.b); per le allergie che scegli di indicare, il tuo consenso esplicito (art. 9.2.a)</td>
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
          {e.EMAIL_PROVIDER === "brevo" ? (
            <li>Sendinblue SAS (Brevo), Francia, per l&apos;invio delle e-mail;</li>
          ) : e.EMAIL_PROVIDER === "resend" ? (
            <li>Resend, per l&apos;invio delle e-mail;</li>
          ) : (
            <li>il fornitore del servizio di posta elettronica;</li>
          )}
          <li>{maps};</li>
          {e.ANTHROPIC_API_KEY ? (
            <li>
              Anthropic PBC (Stati Uniti), per le risposte dell&apos;assistente virtuale Dim, solo con i messaggi
              che scrivi nella chat;
            </li>
          ) : null}
          {f.googleAuth ? <li>Google Ireland Ltd., se scegli di accedere con Google;</li> : null}
          {f.appleAuth ? (
            <li>Apple Distribution International Ltd., se scegli di accedere con Apple;</li>
          ) : null}
          <li>
            i servizi di notifica del tuo browser o sistema operativo (ad esempio Google, Apple o Mozilla), solo se
            attivi le notifiche push;
          </li>
          <li>
            i rider che effettuano la consegna, limitatamente a nome, telefono e indirizzo dell&apos;ordine
            affidato.
          </li>
        </ul>
        <p>
          Se scegli di lasciare una recensione, la scrivi direttamente su Google: da quel momento si applica
          l&apos;informativa di Google e noi vediamo solo ciò che pubblichi.
        </p>
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

      <LegalSection title="9. Sicurezza">
        <p>
          Il sito funziona solo su connessione cifrata (HTTPS). Le password sono conservate in forma cifrata
          non reversibile, l&apos;accesso ai dati in gestione è limitato per ruolo (cucina, rider,
          amministrazione) e le operazioni sugli ordini sono registrate. Nessun sistema è infallibile: se
          dovessimo rilevare una violazione che ti riguarda, ti avviseremo come previsto dalla legge.
        </p>
      </LegalSection>

      <LegalSection title="10. Modifiche a questa informativa">
        <p>
          Possiamo aggiornare questa informativa quando cambiano il servizio o la normativa. La versione in
          vigore è sempre su questa pagina, con la data di aggiornamento in alto; se le modifiche sono
          rilevanti te lo segnaliamo sul sito o via e-mail.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
