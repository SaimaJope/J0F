import Image from "next/image";
import { ContactForm } from "../components/contact-form";

type Service = {
  index: string;
  title: string;
  description: string;
  scope: string[];
};

type PhotoSlotProps = {
  src?: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  position?: string;
};

const services: Service[] = [
  {
    index: "01",
    title: "Sähkösuunnittelu",
    description:
      "Uudis- ja saneerauskohteiden sähkösuunnittelu pientaloista toimitiloihin. Toteutamme piirustukset, valaistus-, ryhmitys- ja maadoitussuunnitelmat sekä kustannusarviot.",
    scope: ["Sähköpiirustukset", "Valaistus ja ryhmitys", "Kustannusarviot"]
  },
  {
    index: "02",
    title: "Sähkökonsultaatio",
    description:
      "Riippumaton tekninen arvio sähköjärjestelmistä ja energiankäytöstä. Käytännöllistä tukea hankkeen alkuvaiheeseen, modernisointiin ja teknisiin vertailuihin.",
    scope: ["Hankesuunnittelu", "Tekninen vertailu", "Energiatehokkuus"]
  },
  {
    index: "03",
    title: "Sähkötöiden valvonta",
    description:
      "Työmaavalvonta tilaajan puolesta. Seuraamme aikataulua, kustannuksia ja laatua sekä huolehdimme dokumentoinnista urakan loppuun asti.",
    scope: ["Työmaakatselmukset", "Laadunvarmistus", "Dokumentointi"]
  },
  {
    index: "04",
    title: "Tarkastukset ja kuntoarviot",
    description:
      "Sähkölaitteistojen määräaikais- ja käyttöönottotarkastukset sekä kuntoarviot. Tunnistamme korjaustarpeet ennen kuin niistä tulee ongelma.",
    scope: ["Määräaikaistarkastus", "Käyttöönottotarkastus", "Kuntoarvio"]
  }
];

const meta = [
  { label: "Toimiala", value: "Sähkösuunnittelu, konsultointi ja valvonta" },
  { label: "Sijainti", value: "Myllärintie 5, 71470 Oravikoski" },
  { label: "Puhelin", value: "044 572 3200", href: "tel:+358445723200" },
  { label: "Sähköposti", value: "info@jobfuture.fi", href: "mailto:info@jobfuture.fi" },
  { label: "Y-tunnus", value: "2650982-5" }
];

const heroFacts = [
  { label: "Sijainti", value: "Oravikoski, Pohjois-Savo" },
  { label: "Y-tunnus", value: "2650982-5" },
  { label: "Puhelin", value: "044 572 3200", href: "tel:+358445723200" },
  { label: "Vastaus", value: "Yleensä saman arkipäivän aikana" }
];

const omakotitaloScope = [
  "Sähkösuunnitelma kohteen lähtötietojen pohjalta",
  "Kustannusarvio ja materiaalilista ennen aloitusta",
  "Työmaavalvonta ja laadunvarmistus",
  "Käyttöönottotarkastus ja luovutusdokumentit"
];

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <SiteHeader />

      <main>
        <Hero />
        <ServicesSection />
        <OmakotitaloSection />
        <ContactSection />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-rule-muted bg-surface/90 shadow-[0_1px_18px_rgba(16,21,23,0.05)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-5 sm:px-6 lg:px-10">
        <a href="#top" className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="truncate text-[14px] font-semibold">JobFuture Oy</span>
        </a>

        <nav className="hidden items-center gap-8 text-[13px] font-medium text-ink-muted md:flex">
          <a href="#palvelut" className="transition hover:text-accent-ink">
            Palvelut
          </a>
          <a href="#omakotitalo" className="transition hover:text-accent-ink">
            Omakotitalot
          </a>
          <a href="#yhteys" className="transition hover:text-accent-ink">
            Yhteys
          </a>
        </nav>

        <div className="flex items-center gap-5 text-[13px]">
          <a
            href="tel:+358445723200"
            className="hidden tabular-nums text-ink-muted transition hover:text-accent-ink sm:inline"
          >
            044 572 3200
          </a>
          <a
            href="#yhteys"
            className="inline-flex items-center justify-center border border-accent bg-accent px-4 py-2.5 font-semibold text-white shadow-[0_10px_24px_rgba(23,111,125,0.22)] transition hover:border-accent-ink hover:bg-accent-ink"
          >
            Ota yhteyttä
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate min-h-[calc(100svh-64px)] overflow-hidden bg-night text-ink-inverse"
    >
      <div className="absolute inset-0 -z-10">
        <PhotoSlot className="h-full w-full" priority />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,31,36,0.94)_0%,rgba(7,31,36,0.80)_46%,rgba(7,31,36,0.34)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(7,31,36,0.94),rgba(7,31,36,0))]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-page flex-col justify-end px-5 pb-8 pt-20 sm:px-6 lg:px-10 lg:pb-10 lg:pt-24">
        <div className="max-w-[760px] pb-10 lg:pb-16">
          <SectionLabel index="001" name="JobFuture Oy" tone="dark" />

          <h1 className="mt-8 font-display text-[46px] leading-[0.98] tracking-display text-white sm:text-[70px] lg:text-[92px]">
            Sähkösuunnittelua,
            <br />
            valvontaa ja
            <br />
            <span className="italic text-accent-soft">tarkastuksia.</span>
          </h1>

          <p className="mt-8 max-w-[58ch] text-[16px] leading-[1.75] text-white/80 lg:text-[18px]">
            JobFuture Oy on sähköalan suunnittelu- ja konsultointiyritys
            Pohjois-Savosta. Vastaamme kohteen sähköteknisestä laadusta
            suunnittelupöydältä käyttöönottoon. Rakennuttajille, taloyhtiöille
            ja omakotitaloille.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 text-[14px]">
            <a
              href="#yhteys"
              className="group inline-flex items-center gap-3 border border-white bg-surface px-6 py-4 font-semibold text-night shadow-[0_20px_44px_rgba(0,0,0,0.24)] transition hover:border-accent-soft hover:bg-accent-soft"
            >
              Ota yhteyttä
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
            <a
              href="tel:+358445723200"
              className="border-b border-white/30 py-1 text-white/80 transition hover:border-white hover:text-white"
            >
              Soita 044 572 3200
            </a>
          </div>
        </div>

        <dl className="grid overflow-hidden border border-white/10 bg-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-md sm:grid-cols-2 lg:grid-cols-4">
          {heroFacts.map((row) => (
            <div
              key={row.label}
              className="border-b border-white/10 p-4 last:border-b-0 sm:border-r sm:last:border-r-0 lg:border-b-0"
            >
              <dt className="text-[10px] uppercase tracking-label text-white/50">
                {row.label}
              </dt>
              <dd className="mt-2 text-[14px] leading-snug text-white">
                {row.href ? (
                  <a className="transition hover:text-accent-soft" href={row.href}>
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function SectionLabel({
  index,
  name,
  tone = "light"
}: {
  index: string;
  name: string;
  tone?: "light" | "dark";
}) {
  const isDark = tone === "dark";

  return (
    <p
      className={`text-[11px] uppercase tracking-label ${
        isDark ? "text-white/60" : "text-ink-muted"
      }`}
    >
      <span className={`tabular-nums ${isDark ? "text-accent-soft" : "text-accent"}`}>
        {index}
      </span>
      <span className={`mx-3 ${isDark ? "text-white/25" : "text-rule-strong/30"}`}>
        /
      </span>
      {name}
    </p>
  );
}

function ServicesSection() {
  return (
    <section id="palvelut" className="border-b border-rule-muted bg-surface">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12">
          <header className="lg:col-span-5">
            <SectionLabel index="002" name="Palvelut" />
            <h2 className="mt-6 max-w-[10ch] font-display text-[38px] leading-[1.02] tracking-display text-ink sm:text-[48px] lg:text-[58px]">
              Suunnittelusta käyttöönottoon, yhden vastuullisen alla.
            </h2>
            <p className="mt-6 max-w-[44ch] text-[15px] leading-[1.75] text-ink-muted">
              Toimeksiannot räätälöidään kohteen mukaan. Kerro tarpeesi, niin
              ehdotamme sopivan laajuuden ja aikataulun.
            </p>

          </header>

          <ol className="space-y-4 lg:col-span-7">
            {services.map((service) => (
              <li
                key={service.index}
                className="group border border-rule-muted bg-surface p-5 shadow-[0_14px_42px_rgba(16,21,23,0.05)] transition hover:border-accent hover:shadow-[0_18px_50px_rgba(16,21,23,0.08)] sm:p-7"
              >
                <div className="grid gap-6 sm:grid-cols-[56px_1fr]">
                  <span className="flex h-11 w-11 items-center justify-center border border-accent-soft bg-accent-mist text-[11px] uppercase tracking-label text-accent-ink tabular-nums">
                    {service.index}
                  </span>
                  <div>
                    <h3 className="font-display text-[29px] leading-tight tracking-display text-ink lg:text-[34px]">
                      {service.title}
                    </h3>
                    <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.7] text-ink-muted">
                      {service.description}
                    </p>
                    <ul className="mt-6 flex flex-wrap gap-2 text-[11px] uppercase tracking-label text-ink-muted">
                      {service.scope.map((item) => (
                        <li
                          key={item}
                          className="border border-rule bg-surface px-3 py-1.5"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function OmakotitaloSection() {
  return (
    <section id="omakotitalo" className="bg-night text-ink-inverse">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionLabel index="003" name="Omakotitalot" tone="dark" />
            <h2 className="mt-6 font-display text-[38px] leading-[1.03] tracking-display text-white sm:text-[48px] lg:text-[58px]">
              Omakotitalon sähkötyöt, suunniteltuna alusta loppuun.
            </h2>
            <p className="mt-6 max-w-[46ch] text-[15px] leading-[1.75] text-white/70">
              Olipa kyseessä uudiskohde, peruskorjaus tai pelkkä sähkösuunnitelma,
              tarjoamme selkeän kokonaisuuden. Saat yhden hinnan ja yhden
              yhteyshenkilön projektin alusta käyttöönottoon.
            </p>
            <a
              href="#yhteys"
              className="group mt-9 inline-flex items-center gap-3 border-b border-accent-soft py-1 text-[14px] font-semibold text-white transition hover:gap-4 hover:text-accent-soft"
            >
              Pyydä tarjous omakotitaloon
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </a>
          </div>

          <div className="lg:col-span-7">
            <div className="grid gap-3 sm:grid-cols-2">
              {omakotitaloScope.map((item, idx) => (
                <div
                  key={item}
                  className="border border-white/10 bg-white/[0.07] p-6 shadow-[0_18px_52px_rgba(0,0,0,0.16)]"
                >
                  <span className="text-[11px] uppercase tracking-label text-accent-soft tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-4 text-[15px] leading-[1.6] text-white/80">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactSection() {
  return (
    <section id="yhteys" className="border-y border-rule-muted bg-canvas">
      <div className="mx-auto max-w-page px-5 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12">
          <header className="lg:col-span-5">
            <SectionLabel index="004" name="Ota yhteyttä" />
            <h2 className="mt-6 font-display text-[40px] leading-[1.02] tracking-display text-ink sm:text-[52px] lg:text-[64px]">
              Lyhyt viesti
              <br />
              <span className="italic text-accent-ink">riittää.</span>
            </h2>
            <p className="mt-6 max-w-[44ch] text-[15px] leading-[1.75] text-ink-muted">
              Vastaamme yhteydenottoihin yleensä saman arkipäivän aikana.
              Voit jättää viestin lomakkeella tai pyytää, että soitamme takaisin.
            </p>

            <dl className="mt-10 divide-y divide-rule border-y border-rule">
              {meta
                .filter((row) => row.label !== "Toimiala")
                .map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[108px_1fr] items-baseline gap-4 py-4"
                  >
                    <dt className="text-[11px] uppercase tracking-label text-accent">
                      {row.label}
                    </dt>
                    <dd className="text-[15px] leading-snug text-ink">
                      {row.href ? (
                        <a className="transition hover:text-accent" href={row.href}>
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </header>

          <div className="lg:col-span-7">
            <div className="border border-rule-muted bg-surface p-5 shadow-[0_24px_70px_rgba(16,21,23,0.08)] sm:p-8 lg:p-10">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="bg-night text-white/70">
      <div className="mx-auto grid max-w-page grid-cols-2 gap-x-10 gap-y-10 px-5 py-12 text-[13px] md:grid-cols-12 sm:px-6 lg:px-10">
        <div className="col-span-2 md:col-span-5">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt=""
              width={30}
              height={30}
              className="h-[30px] w-[30px] object-contain"
            />
            <span className="text-[13px] font-semibold text-white">JobFuture Oy</span>
          </div>
          <p className="mt-4 max-w-[36ch] text-[13px] leading-[1.65] text-white/60">
            Sähköalan suunnittelu, konsultointi, valvonta ja tarkastukset.
            Oravikoski, Pohjois-Savo.
          </p>
        </div>

        <div className="md:col-span-3">
          <p className="text-[11px] uppercase tracking-label text-accent-soft">Yhteys</p>
          <ul className="mt-4 space-y-1.5">
            <li>
              <a
                href="tel:+358445723200"
                className="tabular-nums transition hover:text-white"
              >
                044 572 3200
              </a>
            </li>
            <li>
              <a href="mailto:info@jobfuture.fi" className="transition hover:text-white">
                info@jobfuture.fi
              </a>
            </li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <p className="text-[11px] uppercase tracking-label text-accent-soft">
            Toimisto
          </p>
          <address className="mt-4 not-italic">
            Myllärintie 5
            <br />
            71470 Oravikoski
          </address>
        </div>

        <div className="md:col-span-2 md:text-right">
          <p className="text-[11px] uppercase tracking-label text-accent-soft">Yritys</p>
          <p className="mt-4 tabular-nums">Y-tunnus 2650982-5</p>
          <p className="mt-1 text-white/40">© {new Date().getFullYear()} JobFuture Oy</p>
        </div>
      </div>
    </footer>
  );
}

function PhotoSlot({
  src,
  alt = "",
  className = "",
  imageClassName = "",
  priority = false,
  position = "center"
}: PhotoSlotProps) {
  if (src) {
    return (
      <div className={`relative isolate overflow-hidden bg-night ${className}`}>
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className={`object-cover ${imageClassName}`}
          style={{ objectPosition: position }}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden bg-night ${className}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#071f24_0%,#0d3036_44%,#176f7d_100%)]" />
      <div
        className="absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
          backgroundSize: "46px 46px"
        }}
      />
      <div className="absolute left-[8%] top-[14%] h-[22%] w-[38%] border border-white/20" />
      <div className="absolute bottom-[12%] right-[8%] h-[34%] w-[46%] border border-white/20" />
      <div className="absolute left-[18%] top-[54%] h-px w-[58%] bg-white/25" />
      <div className="absolute left-[26%] top-[45%] h-[28%] w-px bg-white/20" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(7,31,36,0.76),rgba(7,31,36,0))]" />
    </div>
  );
}
