import { ALLERGEN_DISCLAIMER } from "@dimsum/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal/legal-document";
import { POLICY_VERSION } from "@/server/services/consents";
import { getRestaurantConfig } from "@/server/services/restaurant";

export const metadata: Metadata = {
  title: "Termini e condizioni",
  description:
    "Condizioni di vendita per gli ordini online di DIMSUM: prezzi, consegna, pagamenti, annullamenti e rimborsi.",
  alternates: { canonical: "/termini" },
};

export default async function TermsPage() {
  const config = await getRestaurantConfig();
  const seller = [
    config.legalName ?? config.name,
    config.address.formatted,
    config.vatNumber ? `P.IVA ${config.vatNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const contact = config.supportEmail ?? config.email;
  return (
    <LegalDocument
      title="Termini e condizioni di vendita"
      version={POLICY_VERSION}
      intro={
        <p>
          Queste condizioni regolano gli ordini effettuati sul sito e sull&apos;app di {config.name}.
          Ordinando le accetti: ti consigliamo di leggerle e conservarle.
        </p>
      }
    >
      <LegalSection title="1. Chi vende">
        <p>
          {seller}.
          {contact ? (
            <>
              {" "}
              Contatti: <a href={`mailto:${contact}`}>{contact}</a>
              {config.phone ? `, ${config.phone}` : ""}.
            </>
          ) : null}
        </p>
      </LegalSection>

      <LegalSection title="2. L'ordine">
        <p>
          Il contratto si conclude quando la cucina accetta l&apos;ordine: ricevi la conferma via e-mail e
          sulla pagina di tracking. Se un prodotto non è più disponibile o l&apos;indirizzo non è servito,
          l&apos;ordine può essere rifiutato: in questo caso non paghi nulla e l&apos;eventuale pagamento
          online viene rimborsato per intero.
        </p>
        <p>
          Puoi ordinare come ospite oppure con un account. Gli ordini programmati vengono preparati per
          l&apos;orario scelto, compatibilmente con gli orari di servizio.
        </p>
      </LegalSection>

      <LegalSection title="3. Prezzi">
        <p>
          I prezzi sono in euro e includono l&apos;IVA. Costo di consegna, eventuale ordine minimo e soglia di
          consegna gratuita dipendono dalla zona e sono mostrati prima del pagamento. Se un prezzo cambia
          mentre stai ordinando ti mostriamo il nuovo totale prima di confermare: non addebitiamo mai importi
          diversi da quello che hai visto. La mancia al rider è facoltativa e va interamente al rider.
        </p>
      </LegalSection>

      <LegalSection title="4. Pagamento">
        <p>
          Puoi pagare online con i metodi proposti al checkout oppure, se attivo, in contanti alla consegna o
          al ritiro. L&apos;ordine pagato online viene inviato alla cucina solo dopo la conferma del pagamento
          da parte del circuito.
        </p>
      </LegalSection>

      <LegalSection title="5. Consegna e ritiro">
        <p>
          I tempi indicati sono stime aggiornate in tempo reale e non costituiscono un termine essenziale. Il
          rider consegna all&apos;indirizzo indicato: verifica civico, citofono e note. Se non sei reperibile
          il rider prova a contattarti al numero fornito.
        </p>
        <p>Per il ritiro presentati al locale all&apos;orario indicato con il numero d&apos;ordine.</p>
      </LegalSection>

      <LegalSection title="6. Annullamento e diritto di recesso">
        <p>
          Puoi annullare l&apos;ordine dalla pagina di tracking finché la cucina non lo ha accettato ed entro{" "}
          {config.customerCancelWindowMinutes} minuti dall&apos;invio: il pagamento online viene rimborsato
          per intero. Dopo l&apos;accettazione contatta il ristorante.
        </p>
        <p>
          Trattandosi di alimenti preparati su ordinazione e deperibili, il diritto di recesso non si applica
          (art. 59, comma 1, lettere c) e d), del Codice del consumo).
        </p>
      </LegalSection>

      <LegalSection title="7. Problemi con l'ordine e rimborsi">
        <p>
          Se manca qualcosa o c&apos;è un errore scrivici dalla pagina dell&apos;ordine (“Contatta
          assistenza”) o dalla pagina <Link href="/supporto">Assistenza</Link>, possibilmente entro 24 ore.
          Valutiamo ogni richiesta e, se dovuto, rimborsiamo in tutto o in parte sul metodo di pagamento
          usato. Restano salvi i diritti di garanzia previsti dalla legge.
        </p>
      </LegalSection>

      <LegalSection title="8. Allergeni e alcolici">
        <p>{ALLERGEN_DISCLAIMER}</p>
        <p>
          La vendita di bevande alcoliche è riservata ai maggiorenni: al checkout ti chiediamo di confermarlo
          e il rider può chiedere un documento alla consegna.
        </p>
      </LegalSection>

      <LegalSection title="9. Account e programma fedeltà">
        <p>
          Sei responsabile della custodia delle credenziali. Il programma fedeltà, quando attivo, è gratuito e
          regolato dalle condizioni pubblicate nella pagina del Club; i punti non sono convertibili in denaro.
        </p>
      </LegalSection>

      <LegalSection title="10. Legge applicabile e controversie">
        <p>
          Si applica la legge italiana. Per i consumatori è competente il foro del luogo di residenza o
          domicilio. Puoi anche ricorrere agli organismi di risoluzione alternativa delle controversie
          previsti dal Codice del consumo.
        </p>
      </LegalSection>

      <p>
        I dati personali sono trattati come descritto nell&apos;
        <Link href="/privacy">informativa privacy</Link>.
      </p>
    </LegalDocument>
  );
}
