import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Bike, CreditCard, MapPin, ShoppingBag, Store } from "lucide-react";
import { formatEuro } from "@dimsum/domain";
import { Logo } from "@/components/brand/logo";
import { CookieNotice } from "@/components/shop/cookie-notice";
import { FoodImage } from "@/components/shop/food-image";
import { summarizeHours } from "@/lib/hours";
import { getCatalog } from "@/server/services/catalog";
import { getRestaurantConfig, toRestaurantInfo } from "@/server/services/restaurant";
import { DishOrbitCarousel, type OrbitDish } from "./dish-orbit";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Scopri DIMSUM: ravioli, bao e noodles a Palermo",
  description:
    "Un piccolo morso, un grande viaggio. Scopri DIMSUM a Palermo: ravioli, bao e noodles, a domicilio o da ritirare. Paghi in contanti o con POS alla consegna.",
  alternates: { canonical: "/scopri" },
  openGraph: {
    title: "DIMSUM · Un piccolo morso, un grande viaggio.",
    description:
      "Asian street food a Palermo. Scegli dal menu e paga alla consegna, in contanti o con il POS che portiamo noi.",
    url: "/scopri",
  },
};

const SPECIALS = [
  {
    slug: "ravioli-al-vapore",
    title: "Un morso tira l’altro.",
    text: "Tutto il piacere dei ravioli al vapore. Scegli il tuo ripieno preferito.",
  },
  {
    slug: "bao-al-vapore",
    title: "Soffice fuori. Wow dentro.",
    text: "Piccoli panini al vapore, ripieni da scoprire. Fai spazio ai bao.",
  },
  {
    slug: "noodles-in-brodo",
    title: "Il tuo momento noodles.",
    text: "Una ciotola fumante e le tue bacchette. Il comfort food che cercavi.",
  },
];

/** The hero carousel: one signature dish per category, in menu order. */
const ORBIT_CATEGORIES = [
  "ravioli-al-vapore",
  "ravioli-alla-piastra",
  "bao-al-vapore",
  "noodles-in-brodo",
  "noodles-saltati",
  "riso-saltato",
  "piatti-caldi",
  "mochi-e-daifuku",
];
const ORBIT_ACCENTS = [
  "#f2a65a",
  "#e2574c",
  "#e8c547",
  "#c98b5a",
  "#7fb069",
  "#f28c8c",
  "#d9895b",
  "#9bc4cb",
];

function orbitDishesFrom(catalog: Awaited<ReturnType<typeof getCatalog>>): OrbitDish[] {
  const rank = new Map(catalog.bestsellerIds.map((id, i) => [id, i]));
  return ORBIT_CATEGORIES.flatMap((slug, i) => {
    const category = catalog.categories.find((c) => c.slug === slug);
    if (!category) return [];
    const product = category.productIds
      .map((id) => catalog.products[id])
      .filter((p): p is NonNullable<typeof p> => !!p && p.isAvailable && !!p.image)
      .sort(
        (a, b) =>
          (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) || Number(b.isFeatured) - Number(a.isFeatured),
      )[0];
    if (!product?.image) return [];
    // "Ravioli al vapore con maiale e sedano" → thin "Ravioli al vapore", heavy "maiale e sedano".
    const lower = product.name.toLowerCase();
    const rest = lower.startsWith(category.name.toLowerCase())
      ? product.name
          .slice(category.name.length)
          .trim()
          .replace(/^(con|di|al|alla|allo|ai|alle)\s+/i, "")
      : product.name;
    const description =
      product.description ??
      (product.ingredients.length ? product.ingredients.join(", ") + "." : (category.description ?? ""));
    return [
      {
        title: category.name,
        subtitle: rest || product.name,
        image: product.image.url,
        alt: product.image.alt || product.name,
        eyebrow: `#${i + 1} · Da provare`,
        name: product.name,
        nameZh: product.nameZh,
        price: formatEuro(product.priceCents),
        description,
        ingredients: product.ingredients,
        accent: ORBIT_ACCENTS[i % ORBIT_ACCENTS.length]!,
        href: `/product/${product.slug}`,
        menuHref: `/menu#${category.slug}`,
      },
    ];
  });
}

export default async function DiscoverPage() {
  const [catalog, config] = await Promise.all([getCatalog(), getRestaurantConfig()]);
  const info = toRestaurantInfo(config);
  const specials = SPECIALS.flatMap((item) => {
    const category = catalog.categories.find((c) => c.slug === item.slug);
    if (!category) return [];
    const prices = category.productIds
      .map((id) => catalog.products[id])
      .filter((p) => p?.isAvailable)
      .map((p) => p!.priceCents);
    return [{ ...item, category, price: prices.length ? Math.min(...prices) : null }];
  });
  const orbitDishes = orbitDishesFrom(catalog);
  const maps = `https://www.google.com/maps/dir/?api=1&destination=${config.location.lat},${config.location.lng}`;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="DIMSUM, torna alla home">
          <Logo className="h-11 text-fg" />
        </Link>
        <nav aria-label="Navigazione landing" className={styles.nav}>
          <a href="#specialita">Le specialità</a>
          <a href="#come-funziona">Come funziona</a>
          <a href="#dove-siamo">Dove siamo</a>
        </nav>
        <Link href="/menu" className={styles.smallButton}>
          Ordina ora
        </Link>
      </header>
      <CookieNotice />
      <main id="contenuto">
        <section aria-labelledby="hero-title" className="relative">
          <h1 id="hero-title" className="sr-only">
            DIMSUM, Asian street food a {config.address.city}: le nostre specialità
          </h1>
          {orbitDishes.length > 1 ? <DishOrbitCarousel dishes={orbitDishes} /> : null}
        </section>
        <div className={styles.ribbon} aria-hidden>
          <span>RAVIOLI</span>
          <i>✳</i>
          <span>BAO</span>
          <i>✳</i>
          <span>NOODLES</span>
          <i>✳</i>
          <span>DIMSUM</span>
          <i>✳</i>
          <span>PALERMO</span>
        </div>

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-b border-black/10 px-6 py-7">
          <div className="flex items-center gap-4">
            <Image src="/brand/mascot.webp" alt="" width={54} height={60} className="h-15 w-auto" />
            <p className="text-base">
              <strong className="block">Piccola mascotte. Grande personalità.</strong>
              <span className="text-fg-muted">Il nostro raviolo prende vita in tre dimensioni.</span>
            </p>
          </div>
          <Link
            href="/mascotte"
            className="rounded-full border border-current px-6 py-3 text-base font-bold transition-colors hover:bg-black/5"
          >
            Esplora la mascotte in 3D
          </Link>
        </div>

        <section id="specialita" className={styles.section} aria-labelledby="specialita-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Trova il tuo prossimo preferito</p>
              <h2 id="specialita-title">
                Tre buoni motivi
                <br />
                per avere fame.
              </h2>
            </div>
            <Link href="/menu" className={styles.outlineButton}>
              Tutto il menu
            </Link>
          </div>
          <div className={styles.foodGrid}>
            {specials.map(({ category, slug, title, text, price }, index) => (
              <Link href={`/menu#${slug}`} className={styles.foodCard} key={slug}>
                <div className={styles.foodVisual}>
                  <FoodImage
                    image={category.image}
                    sizes="(max-width: 760px) 90vw, 32vw"
                    rounded="rounded-none"
                    className={styles.cardPhoto}
                  />
                  <span className={styles.foodIndex}>0{index + 1}</span>
                  {price !== null && <span className={styles.price}>da {formatEuro(price)}</span>}
                </div>
                <p className={styles.category}>{category.name}</p>
                <h3>{title}</h3>
                <p className={styles.description}>{text}</p>
              </Link>
            ))}
          </div>
          <p className={styles.priceNote}>
            Prezzi IVA inclusa. Nel menu trovi piatti, ingredienti e informazioni sugli allergeni.
          </p>
        </section>

        <section id="come-funziona" className={styles.payment} aria-labelledby="payment-title">
          <div className={styles.paymentInner}>
            <div className={styles.paymentCopy}>
              <p className={styles.eyebrow}>Tu pensa solo alla fame</p>
              <h2 id="payment-title">
                Il POS?
                <br />
                <span>Lo portiamo noi.</span>
              </h2>
              <p>
                Ordina online, paga quando ricevi il tuo ordine. Contanti o carta: il rider arriva con il POS,
                direttamente a casa tua.
              </p>
              <div className={styles.paymentMethods}>
                <span>
                  <CreditCard size={21} aria-hidden /> Carta con POS
                </span>
                <span>€ &nbsp; Contanti</span>
              </div>
              <p className={styles.paymentNote}>
                Anche al ritiro paghi al locale, in contanti o con POS. Nessun pagamento online.
              </p>
            </div>
            <ol className={styles.steps}>
              <li>
                <span>01</span>
                <div>
                  <ShoppingBag aria-hidden />
                  <h3>Scegli quello che ti va.</h3>
                  <p>Apri il menu, scopri i piatti e componi il tuo ordine.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <Bike aria-hidden />
                  <h3>A casa o al locale?</h3>
                  <p>Inserisci l’indirizzo per verificare la consegna, oppure scegli il ritiro.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <CreditCard aria-hidden />
                  <h3>Arriva il gusto. Poi paghi.</h3>
                  <p>Contanti o carta con POS, alla consegna o al ritiro. Semplice.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section
          id="dove-siamo"
          className={`${styles.section} ${styles.location}`}
          aria-labelledby="location-title"
        >
          <div>
            <p className={styles.eyebrow}>Ci vediamo a Palermo</p>
            <h2 id="location-title">
              L’Asia è più
              <br />
              vicina di quanto pensi.
            </h2>
            <p className={styles.locationIntro}>
              Passa da DIMSUM, scegli il ritiro o lascia che il tuo prossimo piatto preferito arrivi a casa.
            </p>
            <a className={styles.darkButton} href={maps} target="_blank" rel="noopener noreferrer">
              <MapPin size={20} aria-hidden /> Come raggiungerci
            </a>
          </div>
          <div className={styles.addressCard}>
            <Store size={30} aria-hidden />
            <h3>{config.name}</h3>
            <p>{config.address.formatted}</p>
            <div className={styles.hours}>
              <h4>Orari del locale</h4>
              <dl>
                {summarizeHours(info.venueHours).map((row) => (
                  <div key={row.days}>
                    <dt>{row.days}</dt>
                    <dd>{row.ranges}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {config.phone && (
              <a className={styles.phone} href={`tel:${config.phone}`}>
                {config.phone}
              </a>
            )}
            <Link className={styles.detailsLink} href="/info">
              Zone di consegna, orari degli ordini e contatti
            </Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
          <div>
            <p className={styles.eyebrow}>Prima del primo morso</p>
            <h2 id="faq-title">
              Ti togliamo
              <br />
              gli ultimi dubbi.
            </h2>
          </div>
          <div className={styles.questions}>
            <details>
              <summary>Come posso pagare?</summary>
              <p>
                In contanti oppure con carta tramite POS quando ricevi l’ordine. Il rider porta il POS a
                domicilio. Se scegli il ritiro, paghi direttamente al locale. Non devi inserire i dati della
                carta sul sito.
              </p>
            </details>
            <details>
              <summary>Consegnate al mio indirizzo?</summary>
              <p>
                Inserisci il tuo indirizzo nel sito per verificare la copertura e le condizioni della consegna
                prima di confermare l’ordine. Puoi anche consultare le{" "}
                <Link href="/info#zone">zone di consegna</Link>.
              </p>
            </details>
            <details>
              <summary>Posso ritirare il mio ordine?</summary>
              <p>
                Certo. Scegli “Ritiro” durante l’ordine e passa al locale nell’orario confermato. Gli orari
                per gli ordini sono disponibili nella pagina <Link href="/info">Il locale</Link>.
              </p>
            </details>
            <details>
              <summary>Dove trovo ingredienti e allergeni?</summary>
              <p>
                Apri la scheda di un piatto nel <Link href="/menu">menu</Link> per consultarli. In caso di
                allergie o esigenze specifiche, contatta il locale prima di ordinare: in cucina possono
                verificarsi contaminazioni crociate.
              </p>
            </details>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-title">
          <p className={styles.eyebrow}>Le bacchette sono pronte</p>
          <h2 id="final-title">
            La prossima fermata?
            <br />
            Il tuo primo morso.
          </h2>
          <Link href="/menu" className={styles.lightButton}>
            Scegli cosa mangiare <ShoppingBag size={20} aria-hidden />
          </Link>
          <p>Consegna a domicilio · Ritiro al locale · Contanti o POS</p>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/" aria-label="DIMSUM, home">
            <Logo className="h-12 text-white" />
          </Link>
          <nav aria-label="Link utili">
            <Link href="/">Home</Link>
            <Link href="/menu">Menu</Link>
            <Link href="/info">Il locale</Link>
            <Link href="/supporto">Assistenza</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookie">Cookie</Link>
            <Link href="/termini">Termini</Link>
          </nav>
        </div>
        <p>
          © {config.name}
          {info.legal.companyName ? ` · ${info.legal.companyName}` : ""}
          {info.legal.vatNumber ? ` · P.IVA ${info.legal.vatNumber}` : ""}
        </p>
      </footer>
    </div>
  );
}
