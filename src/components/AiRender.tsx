import { useEffect, useState, type FormEvent } from 'react';
import { Box, Camera, Check, Download, Inbox, Loader2, RefreshCw, Send } from 'lucide-react';
import { displayContact, isEmail, normaliseContact } from '../lib/contact';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';
import { Turnstile } from './Turnstile';
import type { RenderStatus } from '../lib/hooks/useAiRender';

export type Lead = {
  name: string;
  contact: string;
  email: string;
  note: string;
};

/** Sent alongside the lead: the Turnstile token and the honeypot field. */
export type LeadExtras = { turnstile: string | null; website: string };

type LeadCaptureProps = {
  renderStatus: RenderStatus;
  renderImage: string | null;
  renderPreview: string | null;
  lead: Lead | null;
  designLines: string[];
  total: string;
  /** The public demo shows what a jeweler would receive; a shop shows the customer a receipt. */
  demo: boolean;
  shopName: string;
  /** Resolves to an error message, or null once the lead is stored. */
  onSubmit: (lead: Lead, extras: LeadExtras) => Promise<string | null>;
  onShowPhoto: () => void;
};

// Review-step card. The customer leaves their details, the design goes to the
// shop, and the studio photo is rendered for them right after.
export function LeadCapture({
  renderStatus,
  renderImage,
  renderPreview,
  lead,
  designLines,
  total,
  demo,
  shopName,
  onSubmit,
  onShowPhoto,
}: LeadCaptureProps) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [website, setWebsite] = useState('');
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (lead) {
    const thumb = renderImage || (renderStatus === 'paused' && renderPreview) ? (
      <button className="lead-card__thumb" type="button" onClick={onShowPhoto} aria-label="View photo">
        <img src={renderImage ?? renderPreview!} alt={renderImage ? 'AI render of the requested set' : '3D preview of the requested set'} />
      </button>
    ) : (
      <div className="lead-card__thumb lead-card__thumb--loading">
        {renderStatus === 'error' || renderStatus === 'paused' || renderStatus === 'idle' ? <Camera size={18} /> : <Loader2 className="spin" size={18} />}
      </div>
    );
    if (!demo) {
      return (
        <section className="lead-card lead-card--sent" aria-label="Design sent" role="status">
          <header className="lead-card__header">
            <span className="lead-card__icon lead-card__icon--ok"><Check size={16} /></span>
            <div>
              <strong>Sent to {shopName}</strong>
              <small>They&apos;ll reach out on {displayContact(normaliseContact(lead.contact)?.value ?? lead.contact)}</small>
            </div>
          </header>
          <div className="lead-card__body">
            {thumb}
            <dl>
              <div><dt>Design</dt><dd>{designLines.join(' · ')}</dd></div>
              <div><dt>Estimate</dt><dd>{total}</dd></div>
              {lead.email && <div><dt>Confirmation</dt><dd>{lead.email}</dd></div>}
            </dl>
          </div>
          <p className="fine-print">{shopName} confirms the final price and details with you before anything is made.</p>
        </section>
      );
    }
    return (
      <section className="lead-card" aria-label="Lead preview">
        <header className="lead-card__header">
          <span className="lead-card__icon"><Inbox size={16} /></span>
          <div>
            <strong>New design request</strong>
            <small>What the jeweler receives</small>
          </div>
          <span className="demo-badge">Demo</span>
        </header>
        <div className="lead-card__body">
          {thumb}
          <dl>
            <div><dt>Customer</dt><dd>{lead.name}</dd></div>
            <div><dt>Contact</dt><dd>{lead.contact}</dd></div>
            <div><dt>Design</dt><dd>{designLines.join(' · ')}</dd></div>
            <div><dt>Estimate</dt><dd>{total}</dd></div>
            {lead.note && <div><dt>Note</dt><dd>{lead.note}</dd></div>}
          </dl>
        </div>
        <p className="fine-print">
          On a live store this lands in the jeweler&apos;s inbox with the photo attached, ready to quote.
          In this demo nothing was sent to a jeweler.
        </p>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    if (name.trim().length < 2) return setFormError('Add your name.');
    if (!normaliseContact(contact)) return setFormError('Add your Instagram handle (like @yourname) or a US phone number.');
    if (email.trim() && !isEmail(email.trim())) return setFormError('Check your email address, or leave it blank.');
    if (TURNSTILE_SITE_KEY && !turnstile) return setFormError('One moment, checking you are human…');
    setFormError(null);
    setSending(true);
    const error = await onSubmit({ name: name.trim(), contact: contact.trim(), email: email.trim(), note: note.trim() }, { turnstile, website });
    setSending(false);
    if (error) setFormError(error);
  };

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      <div className="lead-form__heading">
        <Camera size={17} />
        <div>
          <strong>{demo ? 'Get a real photo of this set' : `Send your design to ${shopName}`}</strong>
          <small>
            {demo
              ? 'Leave your details and we\'ll turn your design into a studio photo in about 30 seconds.'
              : `${shopName} gets your design and price, and you get a studio photo of your set in about 30 seconds.`}
          </small>
        </div>
      </div>
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} />
      </label>
      <label>
        <span>Instagram or phone</span>
        <input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="@yourhandle or (555) 555-0100"
          autoComplete="tel"
          maxLength={80}
        />
      </label>
      <label>
        <span>Email <em>Optional, for your confirmation</em></span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" maxLength={120} />
      </label>
      <label>
        <span>Anything {demo ? 'we' : 'they'} should know? <em>Optional</em></span>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Timeline, budget, engraving ideas" maxLength={200} />
      </label>
      {/* Honeypot: hidden from people and screen readers, tempting to bots. */}
      <div className="lead-form__trap" aria-hidden="true">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>
      <Turnstile onToken={setTurnstile} />
      {formError && <div className="inline-note" role="alert">{formError}</div>}
      <button className="primary-button" type="submit" disabled={sending}>
        {sending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
        {sending ? 'Sending…' : demo ? 'Send & get your photo' : `Send to ${shopName}`}
      </button>
      <p className="fine-print">
        {demo
          ? 'Demo: your details go to MagPollo (not a jeweler) so we can follow up about setting this up for your store.'
          : `Your design and contact go only to ${shopName}. Studio photos are AI-generated from your design.`}{' '}
        <a href="https://vvslab.magpollo.com/privacy" target="_blank" rel="noopener">Privacy</a>
      </p>
    </form>
  );
}

type RenderOverlayProps = {
  status: RenderStatus;
  image: string | null;
  preview: string | null;
  error: string | null;
  startedAt: number | null;
  expectedSeconds: number;
  canRetry: boolean;
  onRetry: () => void;
  onClose: () => void;
};

// iOS Safari ignores <a download> on data URLs, so phones get the native share
// sheet ("Save Image"); everything else downloads a real file.
async function savePhoto(image: string) {
  const blob = await (await fetch(image)).blob();
  const file = new File([blob], 'magpollo-grillz.jpg', { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My custom grillz' });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Covers the 3D viewer with the AI photo (or its progress).
export function RenderOverlay({ status, image, preview, error, startedAt, expectedSeconds, canRetry, onRetry, onClose }: RenderOverlayProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== 'rendering') return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  const elapsed = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
  const progress = Math.min(95, (elapsed / expectedSeconds) * 100);

  return (
    <div className="render-overlay">
      {status === 'ready' && image && (
        <img className="render-overlay__image" src={image} alt="Studio photo of your custom grillz, generated from your design" />
      )}

      {status === 'rendering' && (
        <div className="render-overlay__status" role="status">
          <Loader2 className="spin" size={22} />
          <strong>{expectedSeconds > 20 && elapsed > 17 ? 'Placing each tooth exactly…' : 'Finishing your photo…'}</strong>
          <span className="render-progress"><span style={{ width: `${progress}%` }} /></span>
          <small>{elapsed.toFixed(0)}s · usually about {expectedSeconds}s{expectedSeconds > 20 ? ' for a mixed design' : ''}</small>
        </div>
      )}

      {status === 'paused' && (
        <>
          {preview && <img className="render-overlay__image" src={preview} alt="3D preview of your custom grillz" />}
          <div className="render-overlay__status render-overlay__status--note" role="status">
            <Camera size={20} />
            <strong>Studio photos are taking a short break.</strong>
            <small>Your design and details went through. Here&apos;s your 3D design for now.</small>
          </div>
        </>
      )}

      {status === 'error' && (
        <div className="render-overlay__status" role="alert">
          <Camera size={22} />
          <strong>{error ?? 'The render failed.'}</strong>
          {canRetry && (
            <button className="secondary-button" type="button" onClick={onRetry}>
              <RefreshCw size={15} /> Try again
            </button>
          )}
        </div>
      )}

      <div className="render-overlay__actions">
        <button className="overlay-chip" type="button" onClick={onClose}>
          <Box size={15} /> Back to 3D
        </button>
        {status === 'ready' && image && (
          <button className="overlay-chip" type="button" onClick={() => void savePhoto(image)}>
            <Download size={15} /> Save photo
          </button>
        )}
      </div>
      {status === 'ready' && <span className="render-overlay__label">AI studio photo of your design · the finished piece is handmade and may vary</span>}
    </div>
  );
}
