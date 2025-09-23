import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './style.css';

export default function LandingPage() {
  useEffect(() => {
    // Header scroll effect
    const header = document.querySelector('.site-header');
    const handleScroll = () => {
      if (window.scrollY > 50) {
        header?.classList.add('scrolled');
      } else {
        header?.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', handleScroll);

    // Basic Scroll Animations
    const animatedElements = document.querySelectorAll(
      '.showcase, .feature-card, .cta-final, .feature-column, .unified-cta'
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '-50px 0px -50px 0px' }
    );

    animatedElements.forEach((el) => observer.observe(el));

    // Hero Text Animation Trigger
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const heroCta = document.querySelector('.hero-cta');
    const scrollIndicator = document.querySelector('.scroll-indicator');

    const t1 = setTimeout(() => heroTitle?.classList.add('visible'), 100);
    const t2 = setTimeout(() => heroSubtitle?.classList.add('visible'), 300);
    const t3 = setTimeout(() => heroCta?.classList.add('visible'), 500);
    const t4 = setTimeout(() => scrollIndicator?.classList.add('visible'), 700);

    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav a');

    const handleToggle = () => {
      mobileMenuToggle?.classList.toggle('active');
      mobileNavOverlay?.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    };

    const closeMenu = () => {
      mobileMenuToggle?.classList.remove('active');
      mobileNavOverlay?.classList.remove('active');
      document.body.classList.remove('menu-open');
    };

    if (mobileMenuToggle) {
      mobileMenuToggle.addEventListener('click', handleToggle);
      mobileNavLinks.forEach((link) => {
        link.addEventListener('click', closeMenu);
      });
    }

    // Cleanup function
    return () => {
      window.removeEventListener('scroll', handleScroll);
      animatedElements.forEach((el) => observer.unobserve(el));
      if (mobileMenuToggle) {
        mobileMenuToggle.removeEventListener('click', handleToggle);
        mobileNavLinks.forEach((link) => {
          link.removeEventListener('click', closeMenu);
        });
      }
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <>
      {/* Floating Header */}
      <header className="site-header">
        <div className="header-container">
          <div className="brand-logo">3DGRILLZ</div>
          <div className="mobile-menu-toggle">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <nav className="main-nav">
            <Link to="/configurator">Design Studio</Link>
            <a href="#features">Craft</a>
          </nav>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <div className="mobile-nav-overlay">
        <nav className="mobile-nav">
          <Link to="/configurator">Design Studio</Link>
          <a href="#features">Craft</a>
          <a href="#contact">Connect</a>
        </nav>
      </div>

      <main className="site-content">
        {/* Hero Section: Fluid Video & Sculpted Text */}
        <section
          className="hero"
          id="hero"
        >
          <div className="video-background">
            <video
              autoPlay
              muted
              loop
              playsInline
            >
              <source
                src="/assets/grillz-video.mp4"
                type="video/mp4"
              />
            </video>
            <div className="video-overlay"></div>
          </div>
          {/* Abstract Sculpted Shapes (Placeholder for CSS/JS enhancement) */}
          <div className="sculpted-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
          </div>
          <div className="hero-content-wrapper">
            <h1 className="hero-title">
              <span className="line line-1">DIGITAL</span>
              <span className="line line-2">ALCHEMY</span>
              <span className="line line-3 whitespace-nowrap">
                & DENTAL ARTISTRY
              </span>
            </h1>
            <p className="hero-subtitle">
              Shape the future of adornment. Forge hyper-realistic grillz in our
              intuitive 3D studio.
            </p>
            <a href="#features" className="cta-button hero-cta">
              Read More
            </a>
          </div>
          <div className="scroll-indicator">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="arrow"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"
              />
            </svg>
          </div>
        </section>

        {/* Unified Feature Showcase: Combining Configurator and AR Try-On */}
        <section
          className="feature-showcase alt-bg"
          id="configurator"
        >
          <div className="showcase-container">
            <div className="showcase-header">
              <h2 className="section-title centered">
                Precision Design & Visualization
              </h2>
              <p className="section-subtitle force-center-text">
                A complete solution for custom grillz: Design with accuracy,
                visualize with confidence.
              </p>
            </div>

            <div className="dual-feature-grid">
              {/* Configurator Feature */}
              <div className="feature-column text-center">
                <div className="feature-image-container">
                  <img
                    src="/assets/Customize-your-grillz.png"
                    alt="3DGRILLZ Configurator Interface"
                    className="feature-image shadow-lift mx-auto"
                  />
                </div>
                <div className="feature-content">
                  <h3>The Alchemist's Bench</h3>
                  <p>
                    Our intuitive design studio where polygons meet precious
                    metals. Mold materials, set stones, and define finishes with
                    surgical precision.
                  </p>
                  <ul className="highlight-list centered-list">
                    <li>Real-time 3D Visualization</li>
                    <li>Material & Stone Selection</li>
                    <li>Dynamic Pricing Updates</li>
                  </ul>
                </div>
              </div>

              {/* AR Try-On Feature */}
              <div className="feature-column text-center">
                <div className="feature-image-container">
                  <img
                    src="/assets/Try-on-grillz.png"
                    alt="AR Try-On Feature for 3DGRILLZ"
                    className="feature-image shadow-lift mx-auto"
                  />
                </div>
                <div className="feature-content">
                  <h3>Digital Reflection</h3>
                  <p>
                    Bridge the gap between screen and reality. Our AR feature
                    lets you or your clients instantly visualize custom
                    creations with startling accuracy.
                  </p>
                  <ul className="highlight-list centered-list">
                    <li>Accurate On-Face Visualization</li>
                    <li>Client Consultation Tool</li>
                    <li>Shareable AR Previews</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="unified-cta">
              <Link to="/configurator" className="cta-button large">
                Enter the Studio
              </Link>
            </div>
          </div>
        </section>

        {/* Core Features: Sculpted Cards */}
        <section
          className="features-section content-section"
          id="features"
        >
          <h2 className="section-title centered">Powered by Precision Craft</h2>
          <p className="section-subtitle centered force-center-text">
            The core elements defining the 3DGRILLZ experience.
          </p>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💎</div>
              <h3>Photorealistic Fidelity</h3>
              <p>
                Unparalleled detail in every render, capturing the nuance of
                light on metal and stone.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔗</div>
              <h3>Seamless Integration</h3>
              <p>
                Embed the power of 3DGRILLZ directly into your existing digital
                storefront or workflow.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">⏱️</div>
              <h3>Instantaneous Pricing</h3>
              <p>
                Transparent, dynamic cost calculation that reflects every design
                choice in real-time.
              </p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Scalable Platform</h3>
              <p>
                Built for growth, ready to handle complexity and volume as your
                business expands.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA: Dramatic & Focused */}
        <section
          className="cta-final"
          id="contact"
        >
          <div className="cta-content">
            <h2 className="cta-title">Transcend Convention.</h2>
            <p className="cta-text">
              Elevate your jewelry business with a next-generation customization
              experience. Offer your customers the power to create personalized
              grillz with precision and ease. Request early access to the
              3DGRILLZ platform today.
            </p>
            <a
              href="mailto:salesteam@magpollo.com?subject=Request%20Early%20Access&body=Hello%2C%0D%0AI'm%20interested%20in%20requesting%20early%20access%20to%20the%203DGRILLZ%20platform.%0D%0AThank%20you!"
              className="cta-button large"
            >
              Request Early Access
            </a>
            <p className="contact-info force-center-text">
              Direct inquiries:{' '}
              <a href="mailto:salesteam@magpollo.com?subject=General%20Inquiry&body=Hello%2C%0D%0AI%20have%20a%20question%20regarding%20your%20services.%0D%0AThank%20you!">
                salesteam@magpollo.com
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* Sculpted Footer */}
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">3DGRILLZ</div>
          <div className="footer-links">
            <Link to="/configurator">Design Studio</Link>
            <a href="#features">Craft</a>
            <a href="#contact">Connect</a>
          </div>
          <div className="footer-copy">
            &copy; 2025 3DGRILLZ. Magpollo. All Rights Reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
