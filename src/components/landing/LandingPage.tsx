import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Box,
  CircleDollarSign,
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

export default function LandingPage() {
  return (
    <div className="demo-store-page">
      <header className="demo-header">
        <Link className="demo-brand" to="/" aria-label="MagPollo Demo Store home">
          <span className="demo-brand-mark">M</span>
          <span>
            <strong>MAGPOLLO</strong>
            <small>Demo store</small>
          </span>
        </Link>
        <nav className="demo-nav" aria-label="Demo store navigation">
          <a href="#how-it-works">How it works</a>
          <Link className="demo-nav-cta" to="/configurator">
            Open demo <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="demo-hero">
          <video
            className="demo-hero-video"
            autoPlay
            muted
            loop
            playsInline
            poster="/assets/og-image.png"
            aria-hidden="true"
          >
            <source src="/assets/grillz-video.mp4" type="video/mp4" />
          </video>
          <div className="demo-hero-veil" />
          <div className="demo-hero-content">
            <span className="demo-eyebrow">Interactive commerce, in practice</span>
            <h1>Custom products, brought to life.</h1>
            <p>
              Explore how a guided 3D buying experience can move a custom order
              from product choices to a complete, priced configuration.
            </p>
            <div className="demo-hero-actions">
              <Link className="demo-primary-cta" to="/configurator">
                Try the live configurator <ArrowRight size={17} />
              </Link>
              <a className="demo-secondary-cta" href="#how-it-works">See how it works</a>
            </div>
          </div>
          <div className="demo-hero-caption">
            <span>Current demo</span>
            <strong>Custom grillz</strong>
          </div>
        </section>

        <section className="demo-flow" id="how-it-works">
          <div className="demo-section-heading">
            <span className="demo-eyebrow">One connected journey</span>
            <h2>From product idea to order-ready configuration.</h2>
            <p>
              This demo uses grillz as the product. The same system pattern can
              support jewelry, furniture, equipment, and other configurable goods.
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

        <section className="demo-product-band">
          <div className="demo-product-copy">
            <span className="demo-eyebrow">Try the experience</span>
            <h2>Build a custom set in real time.</h2>
            <p>
              Select the teeth, compare finishes, add stones, and watch the model
              and estimated price respond to every decision.
            </p>
            <Link className="demo-text-link" to="/configurator">
              Launch the grillz builder <ArrowRight size={16} />
            </Link>
          </div>
          <div className="demo-product-visual">
            <img
              src="/assets/Customize-your-grillz.png"
              alt="MagPollo 3D custom product configurator shown on a phone"
            />
          </div>
        </section>
      </main>

      <footer className="demo-footer">
        <div>
          <strong>MAGPOLLO</strong>
          <span>Systems that make custom commerce easier to buy and operate.</span>
        </div>
        <a href="mailto:salesteam@magpollo.com">salesteam@magpollo.com</a>
      </footer>
    </div>
  );
}
