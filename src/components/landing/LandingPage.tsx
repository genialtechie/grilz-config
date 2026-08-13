import { Link } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import {
  ArrowRight,
  Box,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Repeat2,
  Settings2,
  ShoppingBag,
} from 'lucide-react';
import './style.css';

const COMMERCE_STEPS = [
  {
    icon: Settings2,
    title: 'Guided configuration',
    copy: 'Turn complex product choices into a clear, controlled buying flow.',
  },
  {
    icon: Box,
    title: 'Real-time visualization',
    copy: 'Let buyers see materials, finishes, and details before they commit.',
  },
  {
    icon: CircleDollarSign,
    title: 'Dynamic pricing',
    copy: 'Update the quote as options change, without manual back-and-forth.',
  },
  {
    icon: ShoppingBag,
    title: 'Cart-ready orders',
    copy: 'Carry the final configuration into checkout and production workflows.',
  },
];

const PRODUCT_EXPERIENCES = [
  {
    title: 'Let buyers see the room before they order.',
    copy: 'Turn fabrics, colors, dimensions, and finishes into a visual buying flow that makes considered purchases easier to understand.',
    neutral: '/assets/options/sofa-neutral.avif',
    selected: '/assets/options/sofa-rose.avif',
    alt: 'A configurable sofa shown in a neutral finish',
  },
  {
    title: 'Make every material choice feel tangible.',
    copy: 'Customers can compare metals, stones, settings, and price changes without waiting for another mockup or quote.',
    neutral: '/assets/options/ring-neutral.avif',
    selected: '/assets/options/ring-rose.avif',
    alt: 'A configurable ring shown in silver',
  },
  {
    title: 'Help customers choose with confidence.',
    copy: 'Bring frames, lenses, colors, and fit options into one guided experience instead of a wall of disconnected variants.',
    neutral: '/assets/options/eyewear-neutral.avif',
    selected: '/assets/options/eyewear-rose.avif',
    alt: 'Configurable eyewear shown in a neutral finish',
  },
  {
    title: 'Sell detail without another photoshoot.',
    copy: 'Show combinations of cases, bands, faces, and finishes while preserving the rules behind what can actually be made.',
    neutral: '/assets/options/watch-neutral.avif',
    selected: '/assets/options/watch-rose.avif',
    alt: 'A configurable watch shown in silver',
  },
];

const OPERATIONS = [
  {
    icon: FileText,
    title: 'Accurate order details',
    copy: 'Every approved choice becomes a clean specification your team can use.',
  },
  {
    icon: CircleDollarSign,
    title: 'Pricing that keeps up',
    copy: 'Rules update the price as customers change materials, sizes, and add-ons.',
  },
  {
    icon: Repeat2,
    title: 'Connected handoff',
    copy: 'Send the final order into checkout, production, or the tools you already use.',
  },
];

export default function LandingPage() {
  const posthog = usePostHog();

  const captureSampleClick = (placement: 'header' | 'hero' | 'final') => {
    posthog.capture('sample_configurator_cta_clicked', { placement });
  };

  const captureContactClick = (placement: 'final' | 'footer') => {
    posthog.capture('contact_clicked', {
      placement,
      channel: 'email',
    });
  };

  return (
    <div className="demo-store-page">
      <header className="demo-header">
        <Link className="demo-brand" to="/" aria-label="MagPollo custom commerce home">
          <img src="/assets/magpollo-logo.svg" alt="MagPollo" />
          <small>Custom commerce</small>
        </Link>
        <nav className="demo-nav" aria-label="Custom commerce navigation">
          <a href="#how-it-works">How it works</a>
          <Link
            className="demo-nav-cta"
            to="/configurator"
            onClick={() => captureSampleClick('header')}
          >
            Configure a sample <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="demo-hero">
          <div className="demo-hero-content">
            <h1>Sell custom products without the back-and-forth.</h1>
            <p>
              Give customers a guided way to configure, visualize, price, and
              order complex products online.
            </p>
            <div className="demo-hero-actions">
              <Link
                className="demo-primary-cta"
                to="/configurator"
                onClick={() => captureSampleClick('hero')}
              >
                Configure a sample product <ArrowRight size={17} />
              </Link>
              <a className="demo-secondary-cta" href="#how-it-works">See how it works</a>
            </div>
          </div>
          <div className="demo-hero-media" aria-hidden="true">
            <video
              className="demo-hero-product-video"
              autoPlay
              muted
              loop
              playsInline
              poster="/assets/mobile-hero.webp"
            >
              <source src="/assets/hero-video.mp4" type="video/mp4" />
            </video>
            <img
              className="demo-hero-product-image"
              src="/assets/mobile-hero.webp"
              alt=""
            />
          </div>
        </section>

        <section className="demo-use-cases" aria-labelledby="product-range-title">
          <div className="demo-use-case-intro">
            <h2 id="product-range-title">Custom products should still be easy to buy.</h2>
            <p>
              We shape the experience around the decisions your customers need
              to make and the rules your team needs to preserve.
            </p>
          </div>
          <div className="demo-use-case-list">
            {PRODUCT_EXPERIENCES.map(({ title, copy, neutral, selected, alt }, index) => (
              <article className="demo-use-case" key={title}>
                <div className="demo-use-case-copy">
                  <span aria-hidden="true">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <div className="demo-use-case-visual">
                  <img
                    className="demo-use-case-neutral"
                    src={neutral}
                    alt={alt}
                    width="909"
                    height="822"
                  />
                  <img
                    className="demo-use-case-selected"
                    src={selected}
                    alt=""
                    width="909"
                    height="822"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-flow" id="how-it-works">
          <div className="demo-section-heading">
            <h2>Turn every choice into an order your team can fulfill.</h2>
            <p>
              Replace scattered messages, manual quotes, and unclear build notes
              with one connected buying and fulfillment flow.
            </p>
          </div>
          <div className="demo-step-grid">
            {COMMERCE_STEPS.map(({ icon: Icon, title, copy }, index) => (
              <article className="demo-step" key={title}>
                <div className="demo-step-topline">
                  <Icon size={19} strokeWidth={1.7} />
                  <span>0{index + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-operations" aria-labelledby="operations-title">
          <div className="demo-operations-heading">
            <h2 id="operations-title">The experience does not stop at the product page.</h2>
            <p>
              The same system that helps a customer decide can give your team a
              complete, order-ready handoff.
            </p>
          </div>
          <div className="demo-operation-list">
            {OPERATIONS.map(({ icon: Icon, title, copy }) => (
              <article className="demo-operation" key={title}>
                <Icon size={21} strokeWidth={1.7} />
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="demo-final-cta">
          <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden="true" />
          <h2>Make your hardest product easier to buy.</h2>
          <p>
            Show us how you sell it today. We will find the clearest path from
            customer choices to an order your team can fulfill.
          </p>
          <div className="demo-final-actions">
            <a
              className="demo-primary-cta"
              href="mailto:salesteam@magpollo.com"
              onClick={() => captureContactClick('final')}
            >
              Talk to MagPollo <ArrowRight size={17} />
            </a>
            <Link
              className="demo-secondary-cta"
              to="/configurator"
              onClick={() => captureSampleClick('final')}
            >
              Configure a sample
            </Link>
          </div>
        </section>
      </main>

      <footer className="demo-footer">
        <div>
          <img src="/assets/magpollo-logo.svg" alt="MagPollo" />
          <span>Custom commerce systems for products that are difficult to sell online.</span>
        </div>
        <a
          href="mailto:salesteam@magpollo.com"
          onClick={() => captureContactClick('footer')}
        >
          salesteam@magpollo.com
        </a>
      </footer>
    </div>
  );
}
