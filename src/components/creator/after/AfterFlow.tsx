import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Turnstile } from '../../Turnstile';
import { addToLead, checkPromo, submitLead, type LeadReceipt } from '../../../lib/leads';
import { confirmPhoneCode, rememberedPhone, startPhoneCode } from '../../../lib/phoneAuth';
import { depositFor, priceBreakdown } from '../../../lib/pricing';
import { promoTerms, type Promo } from '../../../lib/promo';
import { VISION_MAX, type MoldId, type RenderSpec } from '../../../lib/renderSpec';
import { useAiRender } from '../../../lib/hooks/useAiRender';
import { useTenant } from '../../../lib/tenant/useTenant';
import type { AfterFlowProps } from '../contract';
import {
  RESEND_SECONDS,
  canTakeDeposit,
  cleanHandle,
  contactError,
  e164,
  fittingsFor,
  followHandle,
  formatPhone,
  isEmail,
  nextScreen,
  pickFitting,
  shopNameFor,
  type ContactError,
  type DepositState,
  type Screen,
} from './afterLogic';
import { CodeScreen } from './CodeScreen';
import { Photo, type PhotoStatus } from './Photo';
import { SentScreen, type FieldState } from './SentScreen';
import { YourGrill } from './YourGrill';
import { PAID_STORAGE_KEY, clearDepositReturn, isDepositReturn, loadSent, markPaid, rememberName, rememberedName, saveSent } from './sentRecord';
import './after.css';

const blank: FieldState = { value: '', status: 'idle', message: '' };
const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * After Done, three screens (owner, Nov 16–17): 1. Your grill (the price, the fitting, where to text) →
 * 2. the 6-digit code (skipped for a phone already verified here) → 3. Sent (the photo develops, the deposit,
 * while it develops, what happens next). Fills its parent: the builder puts it in its panel. If the builder
 * marks part of its stage with `data-after-photo`, the photo develops there, where the piece was; otherwise
 * at the top of Sent.
 */
export function AfterFlow({ design, onKeepEditing, onStartOver }: AfterFlowProps) {
  const tenant = useTenant();
  const ownSite = tenant.slug === 'vvslab';
  const shop = shopNameFor(tenant.slug, tenant.config.brand.name);
  const fittings = useMemo(() => fittingsFor(tenant.config.catalog.molds, ownSite), [tenant.config.catalog.molds, ownSite]);
  const catalogAddOns = useMemo(() => tenant.config.catalog.addOns ?? [], [tenant.config.catalog.addOns]);
  const render = useAiRender(tenant.slug);

  // Back from paying the deposit (?deposit=paid): straight to Sent, with "Order started".
  const [returning] = useState(() => (isDepositReturn() ? loadSent(tenant.slug) : null));
  const [screen, setScreen] = useState<Screen>(returning ? 'sent' : 'grill');

  // ---------- screen 1 ----------
  const [mold, setMold] = useState<MoldId | undefined>(() => pickFitting(fittings, design.spec.mold));
  const [addOns, setAddOns] = useState<string[]>(design.spec.addOns ?? []);
  const [remembered, setRemembered] = useState(rememberedPhone);
  const [changing, setChanging] = useState(false);
  const verified = remembered && !changing ? remembered : null;
  const [name, setName] = useState(() => returning?.name ?? rememberedName());
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<ContactError | null>(null);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<Promo | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [turnstile, setTurnstile] = useState<string | null>(null);
  const [busy, setBusy] = useState<'texting' | 'sending' | 'checking' | null>(null);
  const [sendError, setSendError] = useState('');

  // ---------- screen 2 ----------
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [resent, setResent] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // ---------- screen 3 ----------
  const [receipt, setReceipt] = useState<LeadReceipt | null>(returning?.receipt ?? null);
  const [sentPhone, setSentPhone] = useState(returning?.phone ?? '');
  const [sentAt, setSentAt] = useState(() => (returning ? 0 : Date.now()));
  const [photoAsked, setPhotoAsked] = useState(false);
  const [depositState, setDepositState] = useState<DepositState>(returning ? 'paid' : 'offer');
  const [depositError, setDepositError] = useState('');
  const [depositNote, setDepositNote] = useState('');
  const [instagram, setInstagram] = useState<FieldState>(blank);
  const sentInstagram = useRef('');
  const [email, setEmail] = useState<FieldState>(blank);
  const [saveMessage, setSaveMessage] = useState('');
  const [stage, setStage] = useState<HTMLElement | null>(null);

  const headRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);

  // The design as it goes to the shop: the fitting and add-ons picked here, their own words as "their idea".
  const spec: RenderSpec = useMemo(
    () => ({ ...design.spec, mold, addOns, vision: design.spec.vision || (design.idea?.words ?? '').slice(0, VISION_MAX) }),
    [design.spec, design.idea?.words, mold, addOns],
  );
  const breakdown = useMemo(
    () => (spec.teeth.length ? priceBreakdown(tenant.config.pricing, spec.teeth, spec, catalogAddOns, promo) : null),
    [tenant.config.pricing, spec, catalogAddOns, promo],
  );
  const total = breakdown?.total ?? design.total;
  const depositAmount = spec.teeth.length ? depositFor(tenant.config.deposit, total) : design.deposit;
  const depositOn = canTakeDeposit(depositAmount, tenant.config.deposit.mode, tenant.config.deposit.link, tenant.demo);

  // ---------- focus: the new screen's title (the code screen: its boxes) ----------
  const firstScreen = useRef(true);
  useEffect(() => {
    if (firstScreen.current) {
      firstScreen.current = false;
      return;
    }
    root.current?.querySelector('.after-body')?.scrollTo({ top: 0 });
    if (screen === 'code') codeRef.current?.focus();
    else (root.current?.querySelector<HTMLElement>('.after-head h2'))?.focus();
  }, [screen]);

  // A clock for the resend countdown and the photo developing.
  const developing = screen === 'sent' && photoAsked && render.status === 'rendering';
  useEffect(() => {
    if (screen !== 'code' && !developing) return;
    const timer = window.setInterval(() => setNow(Date.now()), reducedMotion() && screen !== 'code' ? 1000 : 250);
    return () => window.clearInterval(timer);
  }, [screen, developing]);

  // Back from the deposit: say so, and tell the tab they paid from.
  useEffect(() => {
    if (!returning) return;
    markPaid(returning.receipt.leadId);
    clearDepositReturn();
  }, [returning]);

  // Paid in the other tab (Stripe's return lands there): "Order started" here too.
  useEffect(() => {
    if (!receipt) return;
    const listen = (event: StorageEvent) => {
      if (event.key === PAID_STORAGE_KEY && event.newValue === receipt.leadId) {
        setDepositState('paid');
        setDepositNote('');
      }
    };
    window.addEventListener('storage', listen);
    return () => window.removeEventListener('storage', listen);
  }, [receipt]);

  // The builder's stage, if it offers a place for the photo.
  useEffect(() => {
    if (screen === 'sent') setStage(document.querySelector<HTMLElement>('[data-after-photo]'));
  }, [screen]);

  // ---------- sending ----------
  const deliver = async (to: string, phoneToken: string) => {
    if (tenant.preview) {
      setSendError('This is a preview. Publish the shop to take designs.');
      return;
    }
    setBusy('sending');
    setSendError('');
    // A photo is asked for only once the lead is stored: each costs money.
    const photo = render.rendersLeft > 0 && tenant.config.ai.monthlyGenerations > 0;
    const outcome = await submitLead({
      tenant: tenant.slug,
      configVersion: tenant.version,
      name: name.trim(),
      contact: to,
      note: note.trim() || undefined,
      spec,
      preview: design.preview,
      photo,
      turnstile: turnstile ?? undefined,
      promo: promo?.code,
      website: '',
      elapsedMs: Math.round(performance.now()),
      phoneToken,
    });
    setBusy(null);
    if (!outcome.ok) {
      if (outcome.code === 'promo') {
        setPromo(null);
        setPromoMessage('');
      }
      if (outcome.code === 'phone') {
        // The phone's proof expired: verify it again with a code.
        setRemembered(null);
        setPhone(formatPhone(to));
        const next = nextScreen(screen, { type: 'phoneRejected' });
        if (next === 'code') await textCode(to);
        return;
      }
      setSendError(outcome.error);
      if (screen === 'code') setCode('');
      return;
    }
    rememberName(name);
    saveSent({ tenant: tenant.slug, receipt: outcome.receipt, name: name.trim(), phone: to, at: Date.now() });
    setReceipt(outcome.receipt);
    setSentPhone(to);
    setSentAt(Date.now());
    setScreen('sent');
    if (photo) {
      setPhotoAsked(true);
      void render.start(design.preview, spec, design.idea?.picture ?? null, [], outcome.receipt);
    }
  };

  const textCode = async (to: string, again = false) => {
    setBusy('texting');
    const started = await startPhoneCode(e164(to));
    setBusy(null);
    if (!started.ok) {
      if (again) setCodeError(started.error);
      else {
        setFieldError({ field: 'phone', message: started.error });
        phoneRef.current?.focus();
      }
      return;
    }
    setCode('');
    setCodeError('');
    setResent(again);
    setResendAt(Date.now() + RESEND_SECONDS * 1000);
    setNow(Date.now());
    if (!again) setScreen('code');
  };

  const send = () => {
    if (busy) return;
    setSendError('');
    const error = contactError({ name, phone }, Boolean(verified));
    setFieldError(error);
    if (error) {
      const field = error.field === 'name' ? nameRef.current : phoneRef.current;
      field?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      field?.focus({ preventScroll: true });
      return;
    }
    const next = nextScreen('grill', { type: 'send', verified: Boolean(verified) });
    if (next === 'sending' && verified) void deliver(verified.phone, verified.token);
    else void textCode(phone);
  };

  const confirm = async (full: string) => {
    setBusy('checking');
    setCodeError('');
    const result = await confirmPhoneCode(e164(phone), full);
    if (!result.ok) {
      setBusy(null);
      setCode('');
      setCodeError(result.error);
      window.setTimeout(() => codeRef.current?.focus(), 0);
      return;
    }
    setRemembered({ phone: result.phone, token: result.token });
    setChanging(false);
    if (nextScreen('code', { type: 'confirmed' }) === 'sent') await deliver(result.phone, result.token);
  };

  const onCode = useCallback((value: string) => {
    setCode(value);
    if (value) setCodeError('');
  }, []);
  // The 6th digit sends.
  useEffect(() => {
    if (screen === 'code' && code.length === 6 && busy === null && !codeError) void confirm(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, screen]);

  const back = (focusPhone: boolean) => {
    setCode('');
    setCodeError('');
    setResent(false);
    setScreen(nextScreen('code', { type: 'back' }) as Screen);
    if (focusPhone) window.setTimeout(() => phoneRef.current?.focus(), 0);
  };

  const applyPromo = async () => {
    const value = promoCode.trim();
    if (!value || promoBusy) return;
    setPromoBusy(true);
    const result = await checkPromo(tenant.slug, value);
    setPromoBusy(false);
    if (result.ok) {
      setPromo(result.promo);
      setPromoMessage(`${result.promo.code}: ${promoTerms(result.promo)}`);
    } else {
      setPromo(null);
      setPromoMessage(result.error);
    }
  };

  // ---------- the deposit ----------
  const pay = () => {
    if (!receipt || depositState === 'opening') return;
    setDepositError('');
    setDepositNote('');
    const { mode, link } = tenant.config.deposit;
    if (tenant.demo) {
      // The demo charges nothing: it shows what paying looks like.
      setDepositState('opening');
      window.setTimeout(() => setDepositState('paid'), 1400);
      return;
    }
    if (mode === 'link' && link) {
      window.open(link, '_blank', 'noopener');
      setDepositState('opened');
      setDepositNote(`${shop}’s payment page is open in a new tab.`);
      return;
    }
    // The shop's own Stripe. Open the tab first so it isn't blocked as a popup.
    const tab = window.open('', '_blank');
    setDepositState('opening');
    void fetch('/api/deposit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: receipt.leadId, token: receipt.token }) })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { url?: string; message?: string };
        if (!response.ok || !body.url) throw new Error(body.message ?? `Card deposits aren’t available right now. ${shop} will reach out to you.`);
        if (tab) {
          tab.location.href = body.url;
          setDepositState('opened');
          setDepositNote('Secure checkout is open in a new tab.');
        } else window.location.href = body.url;
      })
      .catch((error: Error) => {
        tab?.close();
        setDepositState('skipped');
        setDepositError(error.message);
      });
  };

  // ---------- while the photo develops ----------
  const saveInstagram = async () => {
    const handle = cleanHandle(instagram.value);
    if (!receipt || !handle || handle === sentInstagram.current) return;
    setInstagram((state) => ({ ...state, status: 'busy', message: '' }));
    const result = await addToLead(receipt, { instagram: handle });
    if (result.ok) sentInstagram.current = handle;
    setInstagram((state) => ({ ...state, status: result.ok ? 'done' : 'error', message: result.ok ? '' : result.error }));
  };

  const sendEmail = async () => {
    if (!receipt) return;
    const value = email.value.trim();
    if (!isEmail(value)) {
      setEmail((state) => ({ ...state, status: 'error', message: 'Add an email like name@example.com.' }));
      return;
    }
    setEmail((state) => ({ ...state, status: 'busy', message: '' }));
    const result = await addToLead(receipt, { email: value });
    setEmail((state) => ({ ...state, status: result.ok ? 'done' : 'error', message: result.ok ? `A copy is on its way to ${value}.` : result.error }));
  };

  const photoStatus: PhotoStatus = render.status === 'ready' && render.image ? 'ready' : photoAsked && render.status === 'rendering' ? 'developing' : 'none';
  const save = async () => {
    const image = render.image ?? design.preview;
    try {
      const blob = await (await fetch(image)).blob();
      const file = new File([blob], `my-grillz.${blob.type.includes('png') ? 'png' : 'jpg'}`, { type: blob.type || 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My grillz' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setSaveMessage('Saved to your downloads.');
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') setSaveMessage('Couldn’t save it here. Press and hold the photo to save it.');
    }
  };

  const elapsed = sentAt ? (now - sentAt) / 1000 : 0;
  const photo = <Photo still={design.preview} photo={render.image} status={photoStatus} elapsed={elapsed} />;

  return (
    <div className="after" ref={root}>
      {screen === 'grill' && (
        <YourGrill
          shop={shop}
          headRef={headRef}
          price={tenant.config.pricing.display === 'hidden' || !breakdown ? null : { lines: breakdown.lines, total }}
          fittings={fittings}
          mold={mold}
          onMold={setMold}
          addOns={catalogAddOns}
          picked={addOns}
          onToggleAddOn={(id) => setAddOns((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))}
          verified={verified}
          onChangePhone={() => {
            setChanging(true);
            setPhone(verified ? formatPhone(verified.phone) : '');
            window.setTimeout(() => phoneRef.current?.focus(), 0);
          }}
          name={name}
          phone={phone}
          onName={(value) => {
            setName(value);
            if (fieldError?.field === 'name') setFieldError(null);
          }}
          onPhone={(value) => {
            setPhone(value);
            if (fieldError?.field === 'phone') setFieldError(null);
          }}
          error={fieldError}
          nameRef={nameRef}
          phoneRef={phoneRef}
          more={more}
          onMore={() => setMore(true)}
          note={note}
          onNote={setNote}
          promos={tenant.promos}
          promoCode={promoCode}
          onPromoCode={setPromoCode}
          onApplyPromo={() => void applyPromo()}
          promoMessage={promoMessage}
          promoBusy={promoBusy}
          busy={busy === 'texting' || busy === 'sending' ? busy : null}
          sendError={sendError}
          onKeepEditing={onKeepEditing}
          onSend={send}
        />
      )}
      {screen === 'code' && (
        <CodeScreen
          shop={shop}
          phone={phone}
          code={code}
          onCode={onCode}
          codeRef={codeRef}
          resendIn={Math.max(0, (resendAt - now) / 1000)}
          onResend={() => void textCode(phone, true)}
          resent={resent}
          busy={busy}
          error={codeError || sendError}
          onWrongNumber={() => back(true)}
          onBack={() => back(false)}
        />
      )}
      {screen === 'sent' && (
        <SentScreen
          shop={shop}
          headRef={headRef}
          phone={sentPhone}
          photo={stage ? null : photo}
          still={design.preview}
          finalPhoto={render.image}
          mold={mold}
          deposit={depositOn && depositAmount !== null ? { amount: depositAmount, state: depositState, error: depositError, note: depositNote } : null}
          onSkip={() => setDepositState('skipped')}
          onPay={pay}
          canSave={photoStatus !== 'developing'}
          onSave={() => void save()}
          saveMessage={saveMessage}
          instagram={instagram}
          onInstagram={(value) => setInstagram({ value, status: 'idle', message: '' })}
          onInstagramDone={() => void saveInstagram()}
          follow={followHandle(ownSite, tenant.config.brand.instagram)}
          email={email}
          onEmail={(value) => setEmail({ value, status: 'idle', message: '' })}
          onSendEmail={() => void sendEmail()}
          onStartOver={onStartOver}
        />
      )}
      {screen === 'sent' && stage && createPortal(<div className="after-photo-portal">{photo}</div>, stage)}
      {screen !== 'sent' && <Turnstile onToken={setTurnstile} />}
    </div>
  );
}

export default AfterFlow;
