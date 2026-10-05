# DIMSUM — ordering, delivery e loyalty

Piattaforma proprietaria di DIMSUM (Via Emerico Amari 47, Palermo): sito e PWA per i clienti,
pannello per il ristorante con schermo cucina, app web per i rider e un'API versionata
(`/api/v1`) pronta per le future app native. Il catalogo è quello reale del ristorante
(116 prodotti, 16 categorie, foto originali), importato dalla piattaforma precedente.

## Cosa c'è

| Percorso | Per chi | Cosa |
| --- | --- | --- |
| `/`, `/menu`, `/cart`, `/checkout` | clienti | Ordine con consegna o ritiro, da ospite o con account. Installabile come app (PWA). |
| `/order/[ref]` | clienti | Tracking in tempo reale, mappa del rider dopo il ritiro, assistenza, annullamento. |
| `/account` | clienti | Ordini e riordino, indirizzi, preferiti, notifiche, privacy (export e cancellazione). |
| `/admin` | staff e admin | Dashboard, ordini, menu, orari, zone, rider, coupon, club, clienti, statistiche, team, registro. |
| `/admin/cucina` | cucina | Schermo cucina: suoni, tempi di preparazione, escalation degli ordini in attesa. |
| `/rider` | rider | App rider (PWA separata): turno, consegne, navigazione, incasso contanti. |
| `/api/v1/*` | web e app native | API versionata; il sito usa la stessa API delle future app. |
| `/dev/outbox` | sviluppo | E-mail inviate in locale (link di verifica e reset password). Disattivata in produzione. |

## Architettura

Monorepo npm workspaces:

```
apps/web               Next.js 16 (App Router, Cache Components, React Compiler):
                       sito, PWA, admin, app rider e API /api/v1 come route handler
packages/types         contratti dell'API (DTO) condivisi tra server, web e app native
packages/validation    schemi Zod degli input, usati da client e server
packages/domain        logica di dominio pura e testata: prezzi e IVA, coupon, zone di
                       consegna, orari (Europe/Rome, fasce oltre la mezzanotte), stati
                       dell'ordine, ETA, permessi, ricerca tollerante ai refusi, fedeltà
packages/api-client    client tipizzato dell'API v1 (web oggi, app Expo domani)
packages/db            schema Prisma e migrazioni PostgreSQL, seed e import del catalogo
```

Scelte principali:

- **Il server decide.** Prezzi, sconti e totali sono ricalcolati sul server: se il client mostra
  un totale diverso l'ordine viene rifiutato (`409 PRICE_CHANGED`) e il cliente vede il nuovo
  prezzo. Gli stati dell'ordine passano da una macchina a stati (`packages/domain/src/order-state.ts`)
  che il server applica a ogni comando.
- **Pagamenti confermati dal server.** Un ordine risulta pagato solo dopo la conferma di Stripe
  via webhook firmato, mai per la risposta del browser. Il checkout è idempotente
  (`Idempotency-Key`): un doppio tap non crea due ordini. I dati delle carte non passano dai
  nostri server (Stripe Payment Element: carta, Apple Pay, Google Pay).
- **Tempo reale senza servizi esterni.** PostgreSQL `LISTEN/NOTIFY` + Server-Sent Events
  (`/api/v1/realtime`). Gli eventi sono notifiche leggere: i client ricaricano i dati
  dall'API, quindi un evento perso non crea incoerenze.
- **Nessun filesystem persistente.** Le foto caricate dall'admin vanno su Vercel Blob; i lavori
  dopo la risposta (e-mail, push) usano `after()`; i lavori pianificati usano Vercel Cron.
- **Pronta per le app native.** Autenticazione anche via bearer token (Better Auth), deep link
  (`/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`) e Sign in with
  Apple predisposti.

## Avvio in locale

Requisiti: Node.js 22.12 o successivo e npm. Docker non serve: lo sviluppo usa un PostgreSQL 17
incorporato.

```bash
npm install
cp .env.example .env    # imposta BETTER_AUTH_SECRET e gli account SEED_* (vedi sotto)
npm run dev
```

`npm run dev` avvia PostgreSQL sulla porta 54329 (dati in `.data/`), applica le migrazioni,
carica il catalogo reale se il database è vuoto e avvia il sito su http://localhost:3000.

Gli account iniziali vengono creati dal seed con i valori `SEED_*` del `.env`:

| Variabili | Ruolo | Dove si entra |
| --- | --- | --- |
| `SEED_ADMIN_*` | Super admin | `/login`, poi `/admin` |
| `SEED_STAFF_*` | Cucina | `/login`, poi `/admin/cucina` |
| `SEED_RIDER_*` | Rider | `/rider/login` |

In locale nulla esce dal computer:

- **Pagamenti:** `PAYMENT_PROVIDER=dev` sostituisce Stripe con un simulatore. Anche qui il
  pagamento viene confermato dal server. Il simulatore è bloccato nella produzione su Vercel.
- **E-mail:** `EMAIL_PROVIDER=outbox` le salva nel database: si leggono su `/dev/outbox`.
- **Accesso con Google:** senza chiavi, in sviluppo il pulsante "Continua con Google" è visibile
  e spiega cosa configurare; in produzione compare solo se le chiavi ci sono. Per provarlo in
  locale crea un client OAuth (vedi [Deploy](#deploy-su-vercel), punto 7) con URI di
  reindirizzamento `http://localhost:3000/api/auth/callback/google` e imposta
  `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nel `.env`.
- **Mappe:** `MAPS_PROVIDER=osm` non richiede chiavi. Le mappe vengono da OpenFreeMap e i percorsi
  da OSRM.
- **Ricerca indirizzi:** usa un indice delle vie e dei civici dell'area di consegna, preso da
  OpenStreetMap e salvato nel progetto (`apps/web/src/server/maps/street-index.json`). Risponde
  subito mentre si scrive, tollera gli errori di battitura e non dipende da servizi esterni (quelli
  pubblici non rispondono in modo affidabile ai server cloud). Se le zone di consegna si allargano,
  rigeneralo con `node apps/web/scripts/build-street-index.mjs` e pubblica il file aggiornato.
  Dati © OpenStreetMap contributors, licenza ODbL.

### Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Database, migrazioni, seed se vuoto e sito in sviluppo |
| `npm run build` / `npm start` | Build di produzione e avvio |
| `npm run typecheck` · `npm run lint` · `npm run format` | Controlli statici e formattazione |
| `npm test` | Test unitari (Vitest) |
| `npm run test:e2e` | Test end-to-end (Playwright) |
| `npm run db:migrate` | Crea una nuova migrazione dopo una modifica allo schema |
| `npm run db:deploy` | Applica le migrazioni (non distruttivo) |
| `npm run db:seed` | Seed idempotente: dati reali, catalogo e account mancanti |
| `npm run db:reset` | Cancella e ricrea il database. **Solo in locale.** |
| `npm run catalog:import` | Importa i prodotti mancanti; `-- --sync` riallinea anche nomi e prezzi alla fonte |

Il catalogo e la sua pipeline di import sono descritti in [packages/db/README.md](packages/db/README.md).

## Variabili d'ambiente

Tutte le variabili sono documentate in [.env.example](.env.example). Nel browser arrivano solo
quelle `NEXT_PUBLIC_*`. In produzione servono:

| Area | Variabili |
| --- | --- |
| Base | `APP_URL` (es. `https://dimsum.it`); su Vercel, se manca, vale il dominio di produzione |
| Database | `DATABASE_URL` (pooled), `DIRECT_DATABASE_URL` o `DATABASE_URL_UNPOOLED` (diretta: migrazioni e `LISTEN` del tempo reale) |
| Accesso | `BETTER_AUTH_SECRET`; opzionali `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `APPLE_*` |
| Pagamenti | `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| E-mail | `EMAIL_PROVIDER=resend` con `RESEND_API_KEY`, oppure `smtp` con `SMTP_URL`; `EMAIL_FROM` |
| Foto | `STORAGE_PROVIDER=vercel-blob`, `BLOB_READ_WRITE_TOKEN` |
| Notifiche push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push generate-vapid-keys`) |
| Sicurezza | `CRON_SECRET`, `HASH_SALT` |
| Opzionali | chiavi mappe (`GOOGLE_MAPS_API_KEY`, `MAPBOX_ACCESS_TOKEN`), Upstash per il rate limiting, ID delle app native per i deep link |

## Deploy su Vercel

1. **Database.** Nel progetto Vercel apri Storage e collega un database **Neon** (regione
   Frankfurt): Vercel imposta da solo `DATABASE_URL` (pooled) e `DATABASE_URL_UNPOOLED` (diretta),
   entrambe riconosciute dall'app. Con un altro PostgreSQL usa `DATABASE_URL` e
   `DIRECT_DATABASE_URL`.
2. **Progetto.** Importa il repository su Vercel con **Root Directory `apps/web`**.
   [apps/web/vercel.json](apps/web/vercel.json) installa dalla radice del monorepo (`npm ci`) ed
   esegue `npm run vercel-build`: genera il client Prisma, applica le migrazioni, esegue il seed e
   compila. La regione è `fra1`, vicina ai clienti e al database europeo.
3. **Variabili.** Imposta quelle della tabella sopra per Production (e Preview, con un database
   separato). Il minimo per partire: `BETTER_AUTH_SECRET`, `HASH_SALT`, `CRON_SECRET` e gli
   account `SEED_ADMIN_*` del punto 4.
4. **Catalogo e super admin.** Il seed gira a ogni deploy ed è idempotente: al primo crea
   impostazioni, orari, zone di consegna, promozione e i 116 piatti con le foto; ai successivi
   aggiunge solo ciò che manca e non tocca le modifiche fatte dall'admin. Con `SEED_ADMIN_EMAIL`,
   `SEED_ADMIN_PASSWORD` (almeno 10 caratteri) e `SEED_ADMIN_NAME` crea il primo super admin.
   Dopo il primo accesso puoi togliere `SEED_ADMIN_PASSWORD`: un account esistente non viene mai
   modificato. Per lo stesso motivo non registrarti dal sito con quell'e-mail prima del primo
   deploy. Gli altri account (cucina, rider, admin) si creano da `/admin/team` e `/admin/rider`.
5. **Cron.** Il piano Hobby permette solo cron giornalieri, ed è l'unico dichiarato in
   `vercel.json`: `/api/cron/daily` alle 02:30 UTC (compleanni e scadenze del Club, conservazione
   dei dati). I lavori al minuto (avviso per gli ordini non accettati, pagamenti online
   abbandonati, fine delle pause) partono dal traffico normale: lo schermo cucina si aggiorna ogni
   20 secondi durante il servizio. Per renderli indipendenti dal traffico, con il piano Pro o uno
   scheduler esterno, chiama `/api/cron/operations` ogni minuto con
   `Authorization: Bearer <CRON_SECRET>`.
6. **Stripe.** In Dashboard → Developers → Webhooks crea l'endpoint
   `https://<dominio>/api/webhooks/stripe` con gli eventi `payment_intent.succeeded`,
   `payment_intent.payment_failed`, `payment_intent.processing`, `payment_intent.canceled`,
   `refund.created`, `refund.updated`, e copia il signing secret in `STRIPE_WEBHOOK_SECRET`. Per
   Apple Pay e Google Pay registra il dominio in Settings → Payment method domains.
7. **Google.** Su Google Cloud Console crea un client OAuth di tipo "Applicazione web" con origine
   `https://<dominio>` e URI di reindirizzamento `https://<dominio>/api/auth/callback/google`.
8. **E-mail.** Verifica su Resend (o sul tuo SMTP) il dominio di `EMAIL_FROM`, con record SPF e
   DKIM.

## Test

- **Unitari** (`npm test`, Vitest, 78 test): totali e IVA, coupon, zone di consegna, ETA, orari,
  macchina a stati dell'ordine, ricerca e carrello, oltre a moduli e routing dell'admin.
- **End-to-end** (`npm run test:e2e`, Playwright, 10 test). La suite compila una build di
  produzione in `.next-e2e` e la avvia sulla porta 3100 con il database `TEST_DATABASE_URL`, il
  cui nome deve finire in `_test`. La preparazione non è distruttiva: applica le migrazioni,
  esegue il seed idempotente e apre il ristorante 24 ore su 24, così i test non dipendono
  dall'orario.
  - progetto `api`: catalogo reale, promozione automatica, totale verificato dal server, checkout
    idempotente con pagamento confermato dal server, privacy del tracking, annullamento con
    rimborso, permessi per ruolo, protezione CSRF, webhook e cron non firmati rifiutati;
  - progetto `mobile` (Pixel 7): ordine da ospite con ritiro e pagamento online gestito dalla
    cucina in tempo reale; consegna completa (cucina → rider → tracking del cliente → consegnato
    con incasso in contanti); registrazione, uscita, accesso dal checkout con carrello e indirizzo
    conservati, ordine, storico e indirizzo salvato.

In locale Playwright usa Chrome installato; in CI serve `npx playwright install --with-deps chromium`.

L'accesso con Google non è automatizzabile (Google blocca i login automatici). Usa lo stesso
percorso di ritorno al checkout (`/checkout?riprendi=1`) coperto dal test con e-mail. Prima del
lancio va provato a mano: carrello da ospite, "Continua con Google", ritorno al checkout con
carrello e indirizzo, pagamento, ordine nello storico.

## Sicurezza e privacy

- Sessioni Better Auth in cookie `httpOnly` e `secure` (prefisso `dimsum.`), salvate nel database.
  Account disattivabili, verifica dell'e-mail, rate limiting su accesso, checkout e API sensibili.
  I limiti sono per IP, letto da `x-forwarded-for`, che Vercel imposta su ogni richiesta. Fuori da
  Vercel va messo davanti un proxy che sovrascriva l'header, altrimenti un client potrebbe
  falsificarlo.
- Ruoli `CUSTOMER`, `RIDER`, `STAFF`, `ADMIN`, `SUPER_ADMIN` con una matrice di permessi unica
  (`packages/domain/src/permissions.ts`), verificata su ogni route. Lo staff di cucina, per
  esempio, non vede le impostazioni e non può rimborsare.
- Le scritture autenticate da cookie richiedono la stessa origine (CSRF). Header di sicurezza:
  CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Il tracking pubblico usa un identificativo non indovinabile e mostra l'e-mail mascherata. La
  posizione del rider è visibile solo tra ritiro e consegna e viene raccolta solo durante le
  consegne attive, mai fuori turno.
- Solo cookie tecnici, nessun tracker di analytics o marketing. I consensi marketing sono opt-in
  e registrati con la versione dell'informativa. Il cliente può esportare i propri dati e
  cancellare l'account da `/account/privacy`. Le sessioni di accesso conservano IP e dispositivo
  per la sicurezza dell'account; nei registri anti-abuso l'IP è salvato solo come hash (`HASH_SALT`).
- Conservazione: posizioni dei rider 30 giorni, notifiche ed e-mail 365 giorni, ticket chiusi 730
  giorni (job giornaliero).
- Ogni azione dello staff su ordini, catalogo e impostazioni finisce nel registro (`/admin/registro`).

## Limiti noti

- **Posizione del rider dal browser.** Una web app riceve la posizione solo mentre è aperta: con
  lo schermo bloccato o l'app in background il browser la sospende. L'app rider la invia ogni
  10 secondi (30 con batteria bassa) mentre è aperta. Per il tracciamento in background serve
  l'app nativa, che può usare la stessa API (`/api/v1/rider/location`).
- **Dimsum Club.** Il programma fedeltà è completo ma spento fino al lancio: si attiva da
  `/admin/club`. Finché è spento, il sito ne mostra solo l'anteprima.
- **Sign in with Apple** è predisposto ma richiede un account Apple Developer e le variabili `APPLE_*`.
