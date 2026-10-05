# @dimsum/db

Schema PostgreSQL (Prisma 7 con adapter `pg`), migrazioni, client condiviso, seed e import del
catalogo reale di DIMSUM.

```
prisma/schema.prisma        modello dati
prisma/migrations/          migrazioni SQL (anche quelle di dati, scritte a mano)
prisma.config.ts            usa DIRECT_DATABASE_URL se presente, altrimenti DATABASE_URL
src/client.ts               client Prisma (pool pg, una istanza per processo)
src/seed/                   seed idempotente: impostazioni, orari, zone, promozioni, catalogo, account
src/catalog-source/         normalizzazione della fonte e download delle foto originali
data/brenvo/raw/            risposte pubbliche catturate dalla piattaforma precedente (fonte congelata)
data/brenvo/catalog.json    catalogo normalizzato, quello che il seed importa
data/brenvo/originals/      foto originali (non versionate, si riscaricano)
scripts/dev-postgres.mjs    PostgreSQL 17 incorporato per sviluppo e test
```

## Database locale

`npm run db:start` (dalla radice) avvia PostgreSQL 17 sulla porta 54329, con i dati in
`.data/postgres`, e crea i database `dimsum` e `dimsum_test`. `npm run dev` lo avvia da solo.

## Migrazioni

- Dopo una modifica a `schema.prisma`: `npm run db:migrate` (crea la migrazione e la applica in
  locale).
- In produzione: `npm run db:deploy`, eseguito anche da `npm run vercel-build`. Non cancella dati.
- Le correzioni di dati sono migrazioni SQL come le altre (per esempio
  `20261004223000_cart_item_line_id` e `20261005010000_direct_review_link`), così ogni ambiente
  le riceve una sola volta.
- `npm run db:reset` cancella il database: solo in locale.

## Il catalogo reale

La fonte è il menu pubblico di DIMSUM sulla piattaforma di ordinazione precedente (Brenvo,
ristorante `8L3E9`), catturato il 4 ottobre 2026: 116 prodotti in 16 categorie, tutti con foto,
più orari, zone di consegna, la promozione attiva e i dati del locale. Non esiste contenuto
demo: se un dato non è nella fonte, il campo resta vuoto.

La pipeline ha tre passi. Nessuno ricontatta l'API della piattaforma precedente: le risposte
catturate in `data/brenvo/raw/` sono la fonte.

1. **Foto originali.** `npm run catalog:photos -w @dimsum/db` scarica in
   `data/brenvo/originals/<id>.jpg` le foto a piena risoluzione indicate in
   `raw/dish-pics.json`. Sono URL pubblici del CDN delle immagini, senza il parametro che chiede
   la miniatura. I file già presenti vengono saltati.
2. **Normalizzazione.** `npm run catalog:normalize -w @dimsum/db` scrive `data/brenvo/catalog.json`
   e genera le foto ottimizzate in `apps/web/public/menu/*.webp`, con segnaposto sfocato e
   riconoscimento dello sfondo. Le correzioni editoriali (codice cassa separato dal nome, nomi
   in maiuscolo, spazi nelle unità di misura) conservano accanto i valori originali
   (`sourceName`, `sourceName2`, `sourceDescription`). Il link per le recensioni puntava allo
   shortener della vecchia piattaforma: viene sostituito dal link diretto di Google per lo stesso
   `googlePlaceId`.
3. **Import.** `npm run catalog:import` (dalla radice) carica il catalogo nel database. Categorie
   e prodotti sono identificati da `(sourceProvider, sourceId)`, quindi un nuovo import non crea
   doppioni. Senza opzioni aggiunge solo ciò che manca e non tocca le modifiche fatte
   dall'admin; con `-- --sync` riallinea anche nomi, prezzi e descrizioni alla fonte.

Dalla fonte vengono conservati, tra gli altri: identificativi originali, codice cassa, prezzo,
aliquota IVA, allergeni, livello di piccantezza, indicazioni (coloranti, vegetariano, alcolici),
nome e descrizione in cinese, il gruppo di aggiunte dei noodles in brodo, le tre fasce di
consegna con minimo d'ordine e costo, la promozione "Sconto 20% per ordini sopra i 30€", gli
orari e i tempi di preparazione.
