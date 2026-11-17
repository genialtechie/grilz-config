import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import { useTenant } from '../../lib/tenant/useTenant';
import { GETS, Q_GET, Q_SELL, WORDS } from './content';
import { showcaseBuilds } from './showcase';
import './style.css';

// VVS Lab's front door: the page the owner signed off in the Creator Lab
// (docs/redesign/creator-lab, "the front door, final look", Nov 17). The hero sits
// over the live 3D piece, which turns through popular builds; below it, the strip
// of grillz words, what the jeweler receives, the price, questions and the close.

const HeroPiece = lazy(() => import('./HeroPiece'));

const BUILDER = '/configurator';
const SIGN_UP = '/signup';
const SIGN_IN = '/dashboard';
const INSTAGRAM_DM = 'https://ig.me/m/vvslab.ai';
const INSTAGRAM_PROFILE = 'https://www.instagram.com/vvslab.ai/';
/** How long each build stays on the piece (the prototype's pace). */
const SHOW_MS = 3800;
const PAGE_BG = '#f8f7f4';

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Text rises in as it scrolls into view. Without motion (or an observer) it is simply there. */
function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || reducedMotion() || !('IntersectionObserver' in window)) return;
    const items = el.querySelectorAll<HTMLElement>('.vl-band h2, .vl-lede, .vl-gets li, .vl-phone, .vl-pcard, .vl-qcol, .vl-final > .vl-in > *');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          // The question lists rise together: on a phone one is behind a tab and never scrolls into view.
          const group = entry.target.classList.contains('vl-qcol') ? el.querySelectorAll('.vl-qcol') : [entry.target];
          group.forEach((item) => {
            item.classList.add('vl-risen');
            io.unobserve(item);
          });
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    let last: Element | null = null;
    let k = 0;
    items.forEach((item) => {
      // Siblings follow each other in, a beat apart.
      k = item.parentElement === last ? k + 1 : 0;
      last = item.parentElement;
      item.style.setProperty('--d', `${Math.min(k, 5) * 0.07}s`);
      item.classList.add('vl-rv');
      io.observe(item);
    });
    return () => {
      io.disconnect();
      items.forEach((item) => item.classList.remove('vl-rv', 'vl-risen'));
    };
  }, [root]);
}

function Faq({ list }: { list: [string, string][] }) {
  return (
    <div className="vl-faq">
      {list.map(([q, a]) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const posthog = usePostHog();
  const tenant = useTenant();
  const builds = useMemo(() => showcaseBuilds(tenant), [tenant]);
  const [shown, setShown] = useState(0);
  const [pieceOn, setPieceOn] = useState(false);
  const [pieceReady, setPieceReady] = useState(false);
  const [qtab, setQtab] = useState<'get' | 'sell'>('get');
  const hero = useRef<HTMLElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const viewed = useRef(false);
  useReveal(page);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    posthog.capture('commerce_landing_viewed', { page_path: window.location.pathname, landing_version: 'vvs_lab_front_door' });
  }, [posthog]);

  // One background from the top bar to the footer, overscroll included.
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.backgroundColor;
    html.style.backgroundColor = PAGE_BG;
    return () => {
      html.style.backgroundColor = before;
    };
  }, []);

  // The 3D loads once the words have painted, so first paint never waits on three.js.
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = idle(() => setPieceOn(true), { timeout: 1200 });
    return () => cancel(id);
  }, []);

  // The piece turns through the builds while the hero is on screen and the tab is visible.
  useEffect(() => {
    if (!pieceReady || builds.length < 2) return;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    if (hero.current) io.observe(hero.current);
    const timer = window.setInterval(() => {
      if (visible && !document.hidden) setShown((i) => (i + 1) % builds.length);
    }, SHOW_MS);
    return () => {
      window.clearInterval(timer);
      io.disconnect();
    };
  }, [pieceReady, builds.length]);

  const onPieceReady = useCallback(() => setPieceReady(true), []);
  const build = builds[shown];

  const signup = (placement: string) => () => posthog.capture('signup_cta_clicked', { placement });
  const design = (placement: string) => () => posthog.capture('sample_configurator_cta_clicked', { placement });
  const dm = (placement: string) => () => posthog.capture('contact_clicked', { placement, channel: 'instagram_dm' });

  return (
    <div className="vl" ref={page}>
      <header className="vl-bar vl-gut">
        <Link to="/" className="vl-mark" aria-label="VVS Lab home">
          <img src="/assets/email/vvs-mark-3d.png" alt="" width={54} height={24} />
          <span>Lab</span>
        </Link>
        <nav className="vl-bar-r" aria-label="Account">
          <Link className="vl-pill" to={SIGN_IN} onClick={() => posthog.capture('sign_in_clicked', { placement: 'header' })}>
            Sign in
          </Link>
          <Link className="vl-pill vl-ink" to={SIGN_UP} onClick={signup('header')}>
            Start free
          </Link>
        </nav>
      </header>

      <main>
        <section className="vl-hero" ref={hero} aria-labelledby="vl-h1">
          <div className={pieceReady ? 'vl-piece vl-piece--on' : 'vl-piece'} aria-hidden="true">
            {pieceOn && build && (
              <Suspense fallback={null}>
                <HeroPiece design={build.design} onReady={onPieceReady} />
              </Suspense>
            )}
          </div>
          <div className="vl-home vl-gut">
            {build && (
              <p className="vl-nowshow">
                <b aria-hidden="true" />
                <span>{build.caption}</span>
              </p>
            )}
            <h1 id="vl-h1">Design your grillz in 3D.</h1>
            <div className="vl-two">
              <p>
                See the price as you build.
                <br />
                Jewelers get orders with a deposit.
              </p>
            </div>
            <div className="vl-hcta">
              <Link className="vl-btn vl-ink" to={BUILDER} onClick={design('hero')}>
                Design your grillz
              </Link>
              <Link className="vl-btn" to={SIGN_UP} onClick={signup('hero')}>
                Start free as a jeweler
              </Link>
            </div>
            <p className="vl-fine">Free to design · Shops: 14 days free, then $199/mo</p>
          </div>
        </section>

        <div className="vl-more">
          <div className="vl-words">
            <ul className="vl-sr" aria-label="Options in the builder">
              {WORDS.map((word) => (
                <li key={word}>{word}</li>
              ))}
            </ul>
            <div className="vl-track" aria-hidden="true">
              {[...WORDS, ...WORDS].map((word, i) => (
                <span key={i}>{word}</span>
              ))}
            </div>
          </div>

          <section className="vl-band" aria-labelledby="vl-send">
            <div className="vl-in vl-split">
              <div>
                <h2 id="vl-send">What happens when you hit send</h2>
                <p className="vl-lede">Your design reaches the jeweler exactly as you built it. Shops: this is every request.</p>
                <ul className="vl-gets">
                  {GETS.map(([title, note]) => (
                    <li key={title}>
                      <b>{title}</b>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <figure className="vl-phone" aria-label="Example of a new request on a jeweler’s phone">
                <div className="vl-scr">
                  <div className="vl-clock">
                    9:41<small>Monday, November 17</small>
                  </div>
                  <div className="vl-leadcard">
                    <div className="vl-top">
                      <i aria-hidden="true">VV</i>
                      <span>VVS Lab · now</span>
                    </div>
                    <div className="vl-mid">
                      <img src="/assets/options/grillz/look-iced-fangs.webp" alt="The customer’s design" width={84} height={84} loading="lazy" decoding="async" />
                      <div>
                        <b>New request from Dre</b>
                        <p>6 × 6 · 14K yellow gold · iced canines</p>
                      </div>
                    </div>
                    <div className="vl-tags">
                      <span>$3,840 quoted</span>
                      <span className="vl-paid">$960 deposit paid</span>
                      <span>Mold kit by mail</span>
                    </div>
                  </div>
                  <figcaption className="vl-exl">Example request</figcaption>
                </div>
              </figure>
            </div>
          </section>

          <section className="vl-band" aria-labelledby="vl-price">
            <div className="vl-in">
              <h2 id="vl-price">The price</h2>
              <div className="vl-pcards">
                <div className="vl-pcard">
                  <p className="vl-eyebrow">Designing</p>
                  <p className="vl-pbig">Free</p>
                  <p>You see your price as you build. Sending is free. A deposit starts your order and counts toward your grill.</p>
                  <Link className="vl-btn2 vl-ink" to={BUILDER} onClick={design('price_card')}>
                    Design your grillz
                  </Link>
                </div>
                <div className="vl-pcard">
                  <p className="vl-eyebrow">Shops</p>
                  <p className="vl-pbig">
                    $199<span> a month</span>
                  </p>
                  <p>14 days free, no card. Your builder link, your prices, and requests and deposits sent straight to you.</p>
                  <div className="vl-btns2">
                    <Link className="vl-btn2 vl-ink" to={SIGN_UP} onClick={signup('price_card')}>
                      Start free
                    </Link>
                    <a className="vl-btn2" href={INSTAGRAM_DM} target="_blank" rel="noreferrer" onClick={dm('price_card')}>
                      DM “BUILD” for a demo
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="vl-band" aria-labelledby="vl-questions">
            <div className="vl-in">
              <h2 id="vl-questions">Questions</h2>
              <div className="vl-qtabs" role="tablist" aria-label="Questions for">
                <button type="button" role="tab" id="vl-tab-get" aria-controls="vl-q-get" aria-selected={qtab === 'get'} onClick={() => setQtab('get')}>
                  Getting grillz
                </button>
                <button type="button" role="tab" id="vl-tab-sell" aria-controls="vl-q-sell" aria-selected={qtab === 'sell'} onClick={() => setQtab('sell')}>
                  Selling grillz
                </button>
              </div>
              <div className="vl-qcols" data-tab={qtab}>
                <div className="vl-qcol vl-get" id="vl-q-get" role="tabpanel" aria-labelledby="vl-h3-get">
                  <h3 id="vl-h3-get">Getting grillz</h3>
                  <Faq list={Q_GET} />
                </div>
                <div className="vl-qcol vl-sell" id="vl-q-sell" role="tabpanel" aria-labelledby="vl-h3-sell">
                  <h3 id="vl-h3-sell">Selling grillz</h3>
                  <Faq list={Q_SELL} />
                </div>
              </div>
            </div>
          </section>

          <section className="vl-band vl-final" aria-labelledby="vl-close">
            <div className="vl-in">
              <h2 id="vl-close">Put it in your bio tonight.</h2>
              <p>14 days free, no card needed. Or DM “BUILD” and we’ll walk you through it.</p>
              <div className="vl-btns2">
                <Link className="vl-btn2 vl-ink" to={SIGN_UP} onClick={signup('final_cta')}>
                  Start free trial
                </Link>
                <a className="vl-btn2" href={INSTAGRAM_DM} target="_blank" rel="noreferrer" onClick={dm('final_cta')}>
                  DM “BUILD” for a demo
                </a>
              </div>
              <Link className="vl-shopline" to={BUILDER} onClick={design('final_cta')}>
                Or design your own grillz, free
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="vl-foot">
        <div className="vl-in">
          <span>VVS Lab</span>
          <a href={INSTAGRAM_PROFILE} target="_blank" rel="noreferrer" onClick={dm('footer_profile')}>
            @vvslab.ai
          </a>
          <span className="vl-fnote">Prices in the builder are the demo shop’s example prices.</span>
        </div>
      </footer>
    </div>
  );
}
