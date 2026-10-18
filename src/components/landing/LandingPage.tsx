import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { ArrowRight } from 'lucide-react';
import './style.css';

const INSTAGRAM_DM = 'https://ig.me/m/vvslab.ai';
const INSTAGRAM_PROFILE = 'https://www.instagram.com/vvslab.ai/';

const PROBLEMS = [
  { title: 'They can’t picture it.', note: 'So they ask for photos of pieces you haven’t made yet.' },
  { title: 'The quote takes days.', note: 'Metal, karat, stones, teeth. Interest cools while you calculate.' },
  { title: 'No deposit, no commitment.', note: 'The order never makes it to the bench.' },
];

const STEPS = [
  {
    title: 'They build it in 3D.',
    copy: 'Tap the teeth, pick the metal, style, setting and stones. Every tooth can be different. The price updates with every choice.',
    image: '/assets/vvs/phone-metal.webp',
    alt: 'The builder on a phone, showing metal and karat options',
  },
  {
    title: 'They leave their info.',
    copy: 'Name and Instagram or phone go in before the studio photo unlocks. Every finished design is a lead with contact details.',
    image: '/assets/vvs/phone-photo.webp',
    alt: 'The builder’s last step with a price breakdown and a contact form',
  },
];

const OPTIONS = [
  { label: 'Iced out', image: '/assets/vvs/options/type-iced.webp' },
  { label: 'Open face', image: '/assets/vvs/options/style-open-face.webp' },
  { label: 'Diamond cut', image: '/assets/vvs/options/style-diamond-cut.webp' },
  { label: 'Fangs', image: '/assets/vvs/options/fangs-yes.webp' },
  { label: 'Honeycomb', image: '/assets/vvs/options/setting-honeycomb.webp' },
  { label: 'Moissanite', image: '/assets/vvs/options/stone-moissanite.webp' },
  { label: 'Rose gold', image: '/assets/vvs/options/metal-rose.webp' },
  { label: 'Photo grillz', image: '/assets/vvs/options/type-photo.webp' },
];

const OPTION_LIST =
  'Yellow, white and rose gold from 10K to 18K, silver and platinum. Plain, iced out or photo grillz. Solid, open face, diamond cut, diamond dust, engraving or opals. Honeycomb, mosaic or prong settings. Moissanite, lab or natural stones. Fangs, deep cut or permanent look, initials on a tooth, and an inspiration photo upload.';

const DELIVERABLES = [
  { title: 'The lead', note: 'Name plus Instagram or phone, captured before the photo unlocks.' },
  { title: 'The exact spec', note: 'Every tooth, metal, stone and setting, with the price they saw.' },
  { title: 'The studio photo', note: 'The same image your customer fell for.' },
  { title: 'The mold choice', note: 'In-store fitting, a mailed kit, or their own mold or scan.' },
  { title: 'The deposit', note: 'Through your own Stripe or Shopify checkout. Your money, direct.' },
];

const INCLUDED = [
  'Your own builder link for your site and IG bio',
  'Your prices and options loaded in',
  'AI studio photo for every finished design',
  'Leads, specs and deposits sent to you',
];

const FAQS = [
  {
    q: 'Do I need a website?',
    a: 'No. The builder is its own link, so it works straight from your Instagram bio, your stories or a DM. If you have a site, it can live there too.',
  },
  {
    q: 'Whose prices does it show?',
    a: 'Yours. We load your metal, stone and per-tooth pricing during setup, so the live total matches what you’d quote.',
  },
  {
    q: 'Where does the deposit go?',
    a: 'Through your own Stripe or Shopify checkout, straight to you.',
  },
  {
    q: 'Is the studio photo the final piece?',
    a: 'It’s a photo-real render of the design they built, so they can see it before they pay. The 3D build and the spec you receive are the source of truth for the bench.',
  },
  {
    q: 'Is there a contract?',
    a: 'No. $199 a month, no setup fee, cancel any month.',
  },
];

export default function LandingPage() {
  const posthog = usePostHog();
  const hasCapturedView = useRef(false);

  useEffect(() => {
    if (hasCapturedView.current) return;
    hasCapturedView.current = true;
    posthog.capture('commerce_landing_viewed', {
      page_path: window.location.pathname,
      landing_version: 'vvs_lab_v1',
    });
  }, [posthog]);

  const captureBuilderClick = (placement: string) => {
    posthog.capture('sample_configurator_cta_clicked', { placement });
  };

  const captureDmClick = (placement: string) => {
    posthog.capture('contact_clicked', { placement, channel: 'instagram_dm' });
  };

  const BuilderButton = ({ placement, label = 'Try the builder' }: { placement: string; label?: string }) => (
    <Link className="vvs-btn vvs-btn-gold" to="/configurator" onClick={() => captureBuilderClick(placement)}>
      {label} <ArrowRight size={18} strokeWidth={1.8} />
    </Link>
  );

  const DmButton = ({ placement }: { placement: string }) => (
    <a
      className="vvs-btn vvs-btn-line"
      href={INSTAGRAM_DM}
      target="_blank"
      rel="noreferrer"
      onClick={() => captureDmClick(placement)}
    >
      DM “BUILD” for a demo
    </a>
  );

  return (
    <div className="vvs-page">
      <header className="vvs-header">
        <Link className="vvs-wordmark" to="/" aria-label="VVS Lab home">
          <img src="/assets/vvs/logo-mark.png" alt="VVS" width="640" height="281" />
          <span>LAB</span>
        </Link>
        <nav className="vvs-nav" aria-label="Page navigation">
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <Link className="vvs-nav-cta" to="/configurator" onClick={() => captureBuilderClick('header')}>
            Try the builder
          </Link>
        </nav>
      </header>

      <main>
        <section className="vvs-hero">
          <div className="vvs-hero-photo" role="img" aria-label="Studio photo of gold grillz with fangs, designed in the builder" />
          <div className="vvs-hero-copy">
            <h1 className="vvs-serif">
              Your DMs are losing <em>custom</em> orders.
            </h1>
            <p className="vvs-lede">
              A live 3D grillz builder for your site and IG link. Customers design the piece, see the price,
              and get a studio photo of it. You get the lead, the spec and the deposit.
            </p>
            <div className="vvs-actions">
              <BuilderButton placement="hero" />
              <DmButton placement="hero" />
            </div>
            <p className="vvs-price-line">$199/mo · No setup fee · Month to month</p>
          </div>
        </section>

        <section className="vvs-problem" aria-labelledby="problem-title">
          <div className="vvs-quote">
            <span className="vvs-mark" aria-hidden="true">“</span>
            <h2 id="problem-title" className="vvs-serif">How much for 6 bottom?</h2>
            <p>The most expensive message in your inbox. Then the photos, the back-and-forth, the ghosting.</p>
          </div>
          <ol className="vvs-rows">
            {PROBLEMS.map(({ title, note }, index) => (
              <li key={title}>
                <span className="vvs-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>{title}</p>
                  <small>{note}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="vvs-how" id="how" aria-labelledby="how-title">
          <h2 id="how-title" className="vvs-serif vvs-section-title">
            Let them <em>build it</em> themselves.
          </h2>
          <div className="vvs-steps">
            {STEPS.map(({ title, copy, image, alt }, index) => (
              <article className="vvs-step" key={title}>
                <div className="vvs-device">
                  <img src={image} alt={alt} loading="lazy" />
                </div>
                <span className="vvs-num">{String(index + 1).padStart(2, '0')}</span>
                <h3 className="vvs-serif">{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="vvs-reveal" aria-labelledby="reveal-title">
          <h2 id="reveal-title" className="vvs-serif vvs-section-title">
            Then they see it <em>finished</em>.
          </h2>
          <p className="vvs-reveal-copy">
            <span className="vvs-num">03</span>
            The 3D design turns into a studio photo of their exact piece. That’s the moment they put money down.
          </p>
          <div className="vvs-pair">
            <figure>
              <img src="/assets/vvs/preview-mixed.webp" alt="3D preview of a rose gold open-face set with one iced front tooth" loading="lazy" />
              <figcaption>3D preview</figcaption>
            </figure>
            <figure>
              <img src="/assets/vvs/photo-mixed.webp" alt="Studio photo of the same rose gold set with one iced front tooth" loading="lazy" />
              <figcaption className="vvs-gold-text">AI studio photo</figcaption>
            </figure>
          </div>
          <p className="vvs-caption">Same design, tooth for tooth. One iced front tooth stays one iced front tooth.</p>
        </section>

        <section className="vvs-options" aria-labelledby="options-title">
          <div className="vvs-options-head">
            <h2 id="options-title" className="vvs-serif vvs-section-title">
              Every option you <em>actually</em> sell.
            </h2>
            <p>{OPTION_LIST}</p>
          </div>
          <div className="vvs-option-grid">
            {OPTIONS.map(({ label, image }) => (
              <figure key={label}>
                <img src={image} alt={label} loading="lazy" />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="vvs-get" aria-labelledby="get-title">
          <h2 id="get-title" className="vvs-serif vvs-section-title">
            A lead you can <em>close</em>.
          </h2>
          <ol className="vvs-rows">
            {DELIVERABLES.map(({ title, note }, index) => (
              <li key={title}>
                <span className="vvs-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p>{title}</p>
                  <small>{note}</small>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="vvs-pricing" id="pricing" aria-labelledby="pricing-title">
          <div className="vvs-price-card">
            <h2 id="pricing-title" className="vvs-serif">
              $199<span>/mo</span>
            </h2>
            <p className="vvs-price-sub">No setup fee. Month to month.</p>
            <ul>
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="vvs-actions vvs-actions-center">
              <DmButton placement="pricing" />
            </div>
          </div>
        </section>

        <section className="vvs-faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="vvs-serif vvs-section-title">Questions.</h2>
          <div className="vvs-faq-list">
            {FAQS.map(({ q, a }) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="vvs-final">
          <img className="vvs-logo" src="/assets/vvs/logo-mark.png" alt="" width="640" height="281" />
          <h2 className="vvs-serif">
            DM “<em>BUILD</em>” for a demo.
          </h2>
          <p>Or try the builder your customers would use, right now.</p>
          <div className="vvs-actions vvs-actions-center">
            <BuilderButton placement="final" />
            <DmButton placement="final" />
          </div>
        </section>
      </main>

      <footer className="vvs-footer">
        <span>
          <b>VVS</b> LAB · by Magpollo
        </span>
        <span className="vvs-footer-links">
          <a href={INSTAGRAM_PROFILE} target="_blank" rel="noreferrer" onClick={() => captureDmClick('footer_profile')}>
            @vvslab.ai
          </a>
          <a href="mailto:salesteam@magpollo.com" onClick={() => posthog.capture('contact_clicked', { placement: 'footer', channel: 'email' })}>
            salesteam@magpollo.com
          </a>{' '}
          · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </span>
      </footer>
    </div>
  );
}
