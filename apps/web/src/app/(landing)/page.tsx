import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import { Bike, CreditCard, MapPin, ShoppingBag, Store } from "lucide-react";
import { formatEuro } from "@dimsum/domain";
import { Logo } from "@/components/brand/logo";
import { AssistantWidget } from "@/components/assistant/assistant";
import { FooterMascot } from "@/components/assistant/footer-mascot";
import { MascotIntro } from "@/components/intro/mascot-intro";
import { CookieNotice } from "@/components/shop/cookie-notice";
import { FoodImage } from "@/components/shop/food-image";
import { summarizeHours } from "@/lib/hours";
import { jsonLdScript, restaurantJsonLd } from "@/server/seo";
import { getCatalog } from "@/server/services/catalog";
import { getRestaurantConfig, toRestaurantInfo } from "@/server/services/restaurant";
import { DishOrbitCarousel, type OrbitDish } from "./dish-orbit";
import { FaqList } from "./faq";
import { LandingMotion } from "./landing-motion";
import { StandaloneRedirect } from "./standalone-redirect";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: { absolute: "DIMSUM · Ravioli, bao e noodles a Palermo — Ordina online" },
  description:
    "Un piccolo morso, un grande viaggio. Scopri DIMSUM a Palermo: ravioli, bao e noodles, a domicilio o da ritirare. Paghi in contanti o con POS alla consegna.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "DIMSUM · Un piccolo morso, un grande viaggio.",
    description:
      "Asian street food a Palermo. Scegli dal menu e paga alla consegna, in contanti o con il POS che portiamo noi.",
    url: "/",
  },
};

/** Section titles: a display face with more character than the body font. */
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-landing-display",
  display: "swap",
});

const SPECIALS = [
  {
    slug: "ravioli-al-vapore",
    title: "Un morso tira l’altro",
    text: "Tutto il piacere dei ravioli al vapore. Scegli il tuo ripieno preferito.",
  },
  {
    slug: "bao-al-vapore",
    title: "Soffice fuori, wow dentro",
    text: "Piccoli panini al vapore, ripieni da scoprire. Fai spazio ai bao.",
  },
  {
    slug: "noodles-in-brodo",
    title: "Il tuo momento noodles",
    text: "Una ciotola fumante e le tue bacchette. Il comfort food che cercavi.",
  },
];

/**
 * The hero carousel: one signature dish per category, in menu order, each with its own top-down
 * cutout photo (public/images/hero). `prefer` names the dish that photo shows; otherwise the
 * category's bestseller is used.
 */
const ORBIT_CATEGORIES: { slug: string; image: string; prefer?: string }[] = [
  { slug: "ravioli-al-vapore", image: "/images/hero/ravioli-al-vapore.webp", prefer: "piatto-misto-di-ravioli-al-vapore" },
  { slug: "ravioli-alla-piastra", image: "/images/hero/ravioli-alla-piastra.webp" },
  { slug: "bao-al-vapore", image: "/images/hero/bao-pollo-croccante.webp", prefer: "bao-farcito-con-pollo-croccante" },
  { slug: "noodles-in-brodo", image: "/images/hero/noodles-in-brodo.webp", prefer: "noodles-freschi-con-costine-di-maiale" },
  { slug: "noodles-saltati", image: "/images/hero/noodles-saltati-manzo.webp", prefer: "noodles-saltati-con-manzo" },
  { slug: "riso-saltato", image: "/images/hero/riso-cantonese.webp", prefer: "riso-cantonese" },
  { slug: "piatti-caldi", image: "/images/hero/carne-brasata.webp", prefer: "pancetta-di-maiale-brasata-in-salsa-di-soia" },
  { slug: "mochi-e-daifuku", image: "/images/hero/mochi-fragola.webp", prefer: "mochi-gelato-fragola" },
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
  return ORBIT_CATEGORIES.flatMap(({ slug, image, prefer }, i) => {
    const category = catalog.categories.find((c) => c.slug === slug);
    if (!category) return [];
    const product = category.productIds
      .map((id) => catalog.products[id])
      .filter((p): p is NonNullable<typeof p> => !!p && p.isAvailable)
      .sort(
        (a, b) =>
          Number(b.slug === prefer) - Number(a.slug === prefer) ||
          (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999) ||
          Number(b.isFeatured) - Number(a.isFeatured),
      )[0];
    if (!product) return [];
    // "Ravioli al vapore con maiale e sedano" → thin "Ravioli al vapore", heavy "maiale e sedano".
    const lower = product.name.toLowerCase();
    const catWords = category.name.toLowerCase().split(/\s+/);
    let rest = lower.startsWith(category.name.toLowerCase())
      ? product.name.slice(category.name.length).trim()
      : product.name;
    // Words already in the thin line are not repeated in the heavy one:
    // "Noodles in brodo" + "Noodles freschi con costine di maiale in brodo" → "freschi con costine di maiale".
    const tail = catWords.slice(1).join(" ");
    if (rest.toLowerCase().startsWith(catWords[0]! + " ")) rest = rest.slice(catWords[0]!.length).trim();
    if (tail && rest.toLowerCase().endsWith(" " + tail)) rest = rest.slice(0, -tail.length).trim();
    rest = rest.replace(/^(con|di|al|alla|allo|ai|alle)\s+/i, "");
    // "Piatto misto di ravioli" under "Ravioli al vapore" → "Piatto misto".
    const ofHead = " di " + catWords[0]!;
    if (rest.toLowerCase().endsWith(ofHead)) rest = rest.slice(0, -ofHead.length).trim();
    const description =
      product.description ??
      (product.ingredients.length ? product.ingredients.join(", ") + "." : (category.description ?? ""));
    return [
      {
        title: category.name,
        subtitle: rest || product.name,
        image,
        alt: product.name,
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
    <div id="landing" className={`${styles.page} ${display.variable}`}>
      <StandaloneRedirect />
      <LandingMotion rootId="landing" headerId="landing-header" fromId="specialita" />
      {/* The opening: the mascot pulls the page down like a blanket (once per visit). */}
      <MascotIntro />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(restaurantJsonLd(config, catalog)) }}
      />
      <header id="landing-header" className={styles.header}>
        <Link href="/" aria-label="DIMSUM, home">
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
          {orbitDishes.length > 1 ? <DishOrbitCarousel dishes={orbitDishes} height="calc(100svh - var(--landing-header))" /> : null}
        </section>
        <section id="specialita" className={styles.section} aria-labelledby="specialita-title">
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="specialita-title" data-reveal="title">
                Tre buoni motivi
                <br />
                per avere <span className={styles.accent}>fame</span>
              </h2>
            </div>
            <Link href="/menu" className={styles.outlineButton} data-reveal="up">
              Tutto il menu
            </Link>
          </div>
          <div className={styles.foodGrid} data-stagger>
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
          <p className={styles.priceNote} data-reveal="up">
            Prezzi IVA inclusa. Nel menu trovi piatti, ingredienti e informazioni sugli allergeni.
          </p>
        </section>

        <section id="come-funziona" className={styles.payment} aria-labelledby="payment-title">
          <div className={styles.paymentInner}>
            <div className={styles.paymentCopy} data-stagger>
              <p className={styles.eyebrow}>Tu pensa solo alla fame</p>
              <h2 id="payment-title">
                Il POS?
                <br />
                <span>Lo portiamo noi</span>
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
            <ol className={styles.steps} data-stagger>
              <li>
                <span>01</span>
                <div>
                  <ShoppingBag aria-hidden />
                  <h3>Scegli quello che ti va</h3>
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
                  <h3>Arriva il gusto, poi paghi</h3>
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
          <div data-stagger>
            <p className={styles.eyebrow}>Ci vediamo a Palermo</p>
            <h2 id="location-title">
              L’Asia è più
              <br />
              vicina di quanto pensi
            </h2>
            <p className={styles.locationIntro}>
              Passa da DIMSUM, scegli il ritiro o lascia che il tuo prossimo piatto preferito arrivi a casa.
            </p>
            <a className={styles.darkButton} href={maps} target="_blank" rel="noopener noreferrer">
              <MapPin size={20} aria-hidden /> Come raggiungerci
            </a>
          </div>
          <div className={styles.addressCard} data-reveal="right">
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

        <section id="faq" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
          <div data-stagger>
            <p className={styles.eyebrow}>Prima del primo morso</p>
            <h2 id="faq-title">
              Ti togliamo
              <br />
              gli ultimi dubbi
            </h2>
          </div>
          <FaqList
            className={styles.questions}
            items={[
              {
                question: "Come posso pagare?",
                answer: (
                  <p>
                    In contanti oppure con carta tramite POS quando ricevi l’ordine. Il rider porta il POS a
                    domicilio. Se scegli il ritiro, paghi direttamente al locale. Non devi inserire i dati
                    della carta sul sito.
                  </p>
                ),
              },
              {
                question: "Consegnate al mio indirizzo?",
                answer: (
                  <p>
                    Inserisci il tuo indirizzo nel sito per verificare la copertura e le condizioni della
                    consegna prima di confermare l’ordine. Puoi anche consultare le{" "}
                    <Link href="/info#zone">zone di consegna</Link>.
                  </p>
                ),
              },
              {
                question: "Posso ritirare il mio ordine?",
                answer: (
                  <p>
                    Certo. Scegli “Ritiro” durante l’ordine e passa al locale nell’orario confermato. Gli
                    orari per gli ordini sono disponibili nella pagina <Link href="/info">Il locale</Link>.
                  </p>
                ),
              },
              {
                question: "Posso programmare l’ordine per più tardi?",
                answer: (
                  <p>
                    Sì: al checkout scegli “Programma” e l’orario che preferisci. Lo prepariamo per
                    quell’ora, anche quando il locale è ancora chiuso al momento dell’ordine.
                  </p>
                ),
              },
              {
                question: "Dove trovo ingredienti e allergeni?",
                answer: (
                  <p>
                    Apri la scheda di un piatto nel <Link href="/menu">menu</Link> per consultarli. In caso di
                    allergie o esigenze specifiche, contatta il locale prima di ordinare: in cucina possono
                    verificarsi contaminazioni crociate.
                  </p>
                ),
              },
            ]}
          />
        </section>

        <section className={styles.finalCta} aria-labelledby="final-title" data-stagger>
          <p className={styles.eyebrow}>Le bacchette sono pronte</p>
          <h2 id="final-title">
            La prossima fermata?
            <br />
            Il tuo primo morso
          </h2>
          <Link href="/menu" className={styles.lightButton}>
            Scegli cosa mangiare <ShoppingBag size={20} aria-hidden />
          </Link>
          <p>Consegna a domicilio · Ritiro al locale · Contanti o POS</p>
        </section>
      </main>
      <footer className={styles.footer} data-reveal="up">
        <div className={styles.footerGrid}>
          <div className={styles.footerBrand}>
            <FooterMascot />
            <p>
              Ravioli, bao e noodles a {config.address.city}. A casa tua o da ritirare al locale: paghi quando
              arriva, in contanti o con il POS.
            </p>
            <div className={styles.footerPay} aria-label="Pagamenti accettati">
              <span>
                <CreditCard size={16} aria-hidden /> Carta con POS
              </span>
              <span>€ Contanti</span>
            </div>
            {config.instagramUrl || config.facebookUrl ? (
              <div className={styles.footerSocial}>
                {config.instagramUrl ? (
                  <a href={config.instagramUrl} target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                ) : null}
                {config.facebookUrl ? (
                  <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer">
                    Facebook
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav aria-label="Ordina" className={styles.footerCol}>
            <h3>Ordina</h3>
            <Link href="/menu">Menu</Link>
            <Link href="/offerte">Offerte</Link>
            <Link href="/club">Dimsum Club</Link>
            <Link href="/account">Il mio account</Link>
            <Link href="/account/ordini">I miei ordini</Link>
          </nav>

          <nav aria-label="Aiuto" className={styles.footerCol}>
            <h3>Aiuto</h3>
            <Link href="/supporto">Assistenza</Link>
            <Link href="/info#zone">Zone di consegna</Link>
            <a href="#faq">Domande frequenti</a>
            <Link href="/mascotte">La mascotte in 3D</Link>
          </nav>

          <div className={styles.footerCol}>
            <h3>Il locale</h3>
            <a href={maps} target="_blank" rel="noopener noreferrer">
              {config.address.formatted}
            </a>
            {config.phone ? <a href={`tel:${config.phone}`}>{config.phone}</a> : null}
            <dl className={styles.footerHours}>
              {summarizeHours(info.venueHours).map((row) => (
                <div key={row.days}>
                  <dt>{row.days}</dt>
                  <dd>{row.ranges}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p className={styles.footerLegal}>
            © {config.name}
            {info.legal.companyName ? ` · ${info.legal.companyName}` : ""}
            {info.legal.vatNumber ? ` · P.IVA ${info.legal.vatNumber}` : ""}
          </p>
          <p className={styles.credit}>
            Creato da <strong>Impatto Agency</strong>
          </p>
          <nav aria-label="Note legali" className={styles.footerLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/cookie">Cookie</Link>
            <Link href="/termini">Termini</Link>
          </nav>
        </div>
      </footer>
      <Suspense fallback={null}>
        <AssistantWidget low />
      </Suspense>
    </div>
  );
}
