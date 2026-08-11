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
        <Link className="demo-brand" to="/" aria-label="MagPollo custom commerce home">
          <img src="/assets/magpollo-logo.svg" alt="MagPollo" />
          <small>Custom commerce</small>
        </Link>
        <nav className="demo-nav" aria-label="Custom commerce navigation">
          <a href="#how-it-works">How it works</a>
          <Link className="demo-nav-cta" to="/configurator">
            Configure a sample <ArrowRight size={15} />
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
            <h1>Sell custom products without the back-and-forth.</h1>
            <p>
              Give customers a guided way to configure, visualize, price, and
              order complex products online.
            </p>
            <div className="demo-hero-actions">
              <Link className="demo-primary-cta" to="/configurator">
                Configure a sample product <ArrowRight size={17} />
              </Link>
              <a className="demo-secondary-cta" href="#how-it-works">See how it works</a>
            </div>
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

        <section className="demo-product-band">
          <div className="demo-product-copy">
            <h2>See custom commerce in action.</h2>
            <p>
              Select the teeth, compare finishes, add stones, and watch the model
              and estimated price respond to every decision.
            </p>
            <Link className="demo-text-link" to="/configurator">
              Configure the sample product <ArrowRight size={16} />
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
          <img src="/assets/magpollo-logo.svg" alt="MagPollo" />
          <span>Custom commerce systems for products that are difficult to sell online.</span>
        </div>
        <a href="mailto:salesteam@magpollo.com">salesteam@magpollo.com</a>
      </footer>
    </div>
  );
}
