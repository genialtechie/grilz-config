import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import type { RootState } from '@react-three/fiber';
import { useTenant } from '../../lib/tenant/useTenant';
import { fontPairClass, themeStyle } from '../../lib/tenant/theme';
import { monogram } from '../../lib/tenant/monogram';
import { baseToothState } from '../../lib/hooks/useGrillzCustomization';
import { toothCustomization } from '../../lib/toothCustomization';
import { capturePreview } from '../../lib/capturePreview';
import { downscaleImage } from '../../lib/downscaleImage';
import { depositFor, displayTotal } from '../../lib/pricing';
import { hasDesignHash, saveDesign, startingDesign } from '../../lib/savedDesign';
import { describeBuild } from '../../lib/describe';
import { confirmPhoneCode, rememberedPhone, startPhoneCode } from '../../lib/phoneAuth';
import { METALS, SETTINGS, STYLES, label, type ToothDesign } from '../../lib/renderSpec';
import type { Frame, ToothCustomization, ViewRequest } from '../../lib/types';
import type { CreatorDesign } from './contract';
import { AfterFlow } from './after/AfterFlow';
import { AiPanel, type AiMessage, type AiStep } from './AiPanel';
import { BuildPanel, type BuildAct } from './BuildPanel';
import { JawIcon, SparkIcon, TapIcon, ToothIcon, TurnIcon, UndoIcon } from './icons';
import { QuickQuestion, type Bubble } from './QuickQuestion';
import { StartPanel } from './StartPanel';
import { useGrab } from './useGrab';
import { canUndo, freshHistory, openPart, track, undo as undoStep, back as backStep, type History } from './history';
import { nextQuestion, seemsStuck, QUIET_AFTER_CLOSE_MS, QUIET_AFTER_KEEP_MS, UNDO_MS, type QuestionId } from './guide';
import { contactError, digits } from './phone';
import {
  PARTS,
  apply,
  blankDesign,
  buildPrice,
  canHaveFangs,
  counts,
  firstFront,
  fromSnapshot,
  fromSpec,
  groupTeeth,
  livePicks,
  matchingGroup,
  money,
  offeredDesign,
  offeredGroups,
  price,
  selectionWord,
  setOptions,
  setRange,
  shopBuilds,
  summary,
  toSnapshot,
  toSpec,
  toggleTooth,
  toothName,
  type Design,
  type GroupId,
  type PartId,
} from './model';
import './creator.css';

const CreatorStage = lazy(() => import('./CreatorStage'));

type Mode = 'door' | 'build' | 'ai' | 'after';
type Visited = Partial<Record<PartId, boolean>>;
/** What Undo in the bubble puts back. */
type Snap = { design: Design; visited: Visited; picks: number[] };

const PHONE_WIDTH = 900;
const TOP = 60;
const RESEND_SECONDS = 30;
const AI_LEFT_KEY = 'vvs-ai-left:';

const reduced = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    // no vibration here
  }
};
const readLeft = (phone: string | undefined): number | null => {
  if (!phone) return null;
  try {
    const v = localStorage.getItem(AI_LEFT_KEY + digits(phone));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
};
const writeLeft = (phone: string, left: number) => {
  try {
    localStorage.setItem(AI_LEFT_KEY + digits(phone), String(left));
  } catch {
    // private mode: the count lives on the server anyway
  }
};

/** The top bar's price: it counts to the new total. */
function PriceChip({ total, text, hidden }: { total: number; text: (n: number) => string; hidden: boolean }) {
  const [shown, setShown] = useState(total);
  const from = useRef(total);
  useEffect(() => {
    if (reduced()) {
      setShown(total);
      from.current = total;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let frame = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 380);
      const v = Math.round(a + (total - a) * (1 - Math.pow(1 - k, 3)));
      setShown(v);
      from.current = v;
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [total]);
  if (hidden) return null;
  return (
    <div className="pill price only-build" aria-live="polite" aria-label={`Estimate ${text(total)}`}>
      <span>{text(shown)}</span>
      <small>est.</small>
    </div>
  );
}

/**
 * The Grill Creator Lab, built into the app (signed off by the owner on Nov 17): the start page, the build
 * strip, Select teeth with the amber glow, the quick question, Undo, "Describe it", and the panels that
 * grow by their handles. After Done it hands the design to the after track's AfterFlow.
 */
export default function CreatorApp() {
  const tenant = useTenant();
  const shop = tenant;
  const posthog = usePostHog();
  const { catalog, config } = tenant;
  const showPrices = config.pricing.display !== 'hidden';
  const priceText = useCallback((n: number) => displayTotal(config.pricing, n, money).text, [config.pricing]);
  const shopName = config.brand.name;

  // ---------- the design and where we are ----------
  const [start] = useState(() => startingDesign(tenant));
  const [design, setDesign] = useState<Design>(() => (start ? fromSnapshot(shop, start.snapshot) : blankDesign(shop)));
  const [waiting, setWaiting] = useState(Boolean(start && start.snapshot.teeth.length));
  const [mode, setModeState] = useState<Mode>('door');
  const [part, setPart] = useState<PartId>('teeth');
  const [visited, setVisited] = useState<Visited>({});
  const [picks, setPicks] = useState<number[]>([]);
  const [nav, setNav] = useState<PartId[]>([]);
  const [history, setHistory] = useState<History>(freshHistory);
  const [picked, setPicked] = useState<string | null>(null);
  const [extraOpen, setExtraOpen] = useState({ ins: false, idea: false });
  const [photo, setPhoto] = useState<string | null>(null);
  const [inspo, setInspo] = useState<string | null>(null);
  const [after, setAfter] = useState<CreatorDesign | null>(null);
  const builds = useMemo(() => shopBuilds(shop).map((build) => ({ build, price: showPrices ? buildPrice(shop, build) : '' })), [shop, showPrices]);
  const breakdown = useMemo(() => price(shop, design), [shop, design]);

  // ---------- the stage ----------
  const [startBig, setStartBig] = useState(false);
  const [trayBig, setTrayBig] = useState(false);
  const [selOpen, setSelOpen] = useState(false);
  const [jaw, setJaw] = useState(false);
  const [view, setView] = useState<ViewRequest | null>(null);
  const turnAt = useRef(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [toast, setToast] = useState<{ text: string; at: number } | null>(null);
  const three = useRef<RootState | null>(null);

  // ---------- the guide ----------
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const undoSnap = useRef<{ snap: Snap; back: QuestionId | null; ms: number } | null>(null);
  const qSnap = useRef<Snap | null>(null);
  const qWhere = useRef<'top' | 'bottom' | 'both'>('both');
  const lastTouch = useRef(performance.now());
  const quietUntil = useRef(0);

  // ---------- AI ----------
  const [ai, setAi] = useState<{ step: AiStep; from: 'door' | 'build'; text: string; picture: string | null; messages: AiMessage[]; busy: boolean; error: string }>({
    step: 'talk',
    from: 'door',
    text: '',
    picture: null,
    messages: [],
    busy: false,
    error: '',
  });
  const [verified, setVerified] = useState(() => rememberedPhone());
  const [left, setLeft] = useState<number | null>(() => readLeft(rememberedPhone()?.phone));
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [contactErr, setContactErr] = useState<ReturnType<typeof contactError>>(null);
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [ideaWords, setIdeaWords] = useState<string[]>([]);
  const [ideaPicture, setIdeaPicture] = useState<string | null>(null);

  // ---------- refs to measure ----------
  const root = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLElement | null>(null);
  const tray = useRef<HTMLElement | null>(null);
  const startPanel = useRef<HTMLDivElement | null>(null);
  const bubbleEl = useRef<HTMLDivElement | null>(null);
  const tools = useRef<HTMLDivElement | null>(null);
  const selBar = useRef<HTMLDivElement | null>(null);
  const selBtn = useRef<HTMLButtonElement | null>(null);
  const trayGrab = useGrab(tray, trayBig, setTrayBig, '.tgrab', '.thead');

  const pk = livePicks(design, picks);
  const building = mode === 'build';
  const showSel = building && design.teeth.length > 0 && part !== 'teeth';

  const say = useCallback((text: string) => setToast({ text, at: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(t);
  }, [toast]);

  const touch = useCallback(() => {
    lastTouch.current = performance.now();
  }, []);

  // ---------- opened ----------
  useEffect(() => {
    posthog.capture('creator_opened', { restored: start?.source ?? 'none' });
    // A shared link: take the design out of the address once it is read, so edits aren't confused with it.
    if (typeof window !== 'undefined' && hasDesignHash(window.location.hash)) {
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      } catch {
        // some frames don't allow it
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the design on this device, per shop (the app's saved-design format).
  useEffect(() => {
    if (mode === 'door' && !waiting) return;
    const timer = window.setTimeout(() => saveDesign(tenant.slug, design.teeth.length ? toSnapshot(design) : null), 400);
    return () => window.clearTimeout(timer);
  }, [design, mode, waiting, tenant.slug]);

  // Undo: every change to the design while building is a step to go back to.
  useEffect(() => {
    if (mode !== 'build') return;
    setHistory((h) => track(h, JSON.stringify(design)));
  }, [design, mode]);

  const snap = (): Snap => ({ design, visited, picks });
  const unsnap = (s: Snap) => {
    setDesign(s.design);
    setVisited(s.visited);
    setPicks(s.picks);
  };

  const setMode = (m: Mode) => {
    setModeState(m);
    if (m !== 'build') {
      setPicks([]);
      setBubble(null);
      setSelOpen(false);
    }
  };

  // ---------- moving around ----------
  const startCreator = (d: Design, buildId: string | null) => {
    setDesign(d);
    setPicked(buildId);
    setHistory(freshHistory());
    setPart('teeth');
    setVisited({ teeth: true });
    setPicks([]);
    setNav([]);
    setExtraOpen({ ins: false, idea: false });
    setWaiting(false);
    setStartBig(false);
    touch();
    setMode('build');
    posthog.capture('creator_build_started', { build: buildId ?? 'empty', teeth: d.teeth.length });
  };
  const goDoor = () => {
    setSelOpen(false);
    setBubble(null);
    setWaiting(design.teeth.length > 0);
    setMode('door');
  };
  const open = (p: PartId) => {
    if (bubble && !(bubble.kind === 'question' && (bubble.q === 'where' || bubble.q === 'many'))) setBubble(null);
    setNav((stack) => openPart(stack, part, p));
    setPart(p);
    setVisited((v) => ({ ...v, [p]: true }));
    setExtraOpen({ ins: false, idea: false });
    if (p === 'teeth') setPicks([]);
    setSelOpen(false);
  };
  const goBack = () => {
    const b = backStep(nav);
    if (!b.to) {
      goDoor();
      return;
    }
    setNav(b.stack);
    setPart(b.to);
    setVisited((v) => ({ ...v, [b.to!]: true }));
    if (b.to === 'teeth') setPicks([]);
  };

  const done = () => {
    const spec = toSpec(design);
    if (!spec) return;
    let preview = '';
    try {
      if (three.current) preview = capturePreview(three.current, spec.teeth.map((t) => t.index));
    } catch {
      // no 3D (WebGL off): the design still goes on without a still
    }
    const total = breakdown.total;
    const words = [...ideaWords, design.idea.trim()].filter(Boolean).join(' / ');
    const picture = ideaPicture ?? inspo;
    setAfter({
      spec,
      summary: summary(design),
      total,
      deposit: depositFor(config.deposit, total),
      preview,
      ...(words || picture ? { idea: { ...(words ? { words } : {}), ...(picture ? { picture } : {}) } } : {}),
    });
    posthog.capture('creator_done', { teeth: spec.teeth.length, total, seconds: Math.round(performance.now() / 1000) });
    setMode('after');
  };

  // ---------- choices in the panel ----------
  const fileToUrl = async (file: File | null, max = 900) => (file ? downscaleImage(file, max).catch(() => null) : null);

  const act = (a: BuildAct) => {
    touch();
    if (a.type !== 'open' && a.type !== 'back' && a.type !== 'next' && bubble && !(bubble.kind === 'question' && (bubble.q === 'where' || bubble.q === 'many'))) setBubble(null);
    const targets = pk.length ? pk : design.teeth;
    switch (a.type) {
      case 'open':
        open(a.part);
        return;
      case 'back':
        goBack();
        return;
      case 'next': {
        const i = PARTS.findIndex((p) => p.id === part);
        if (PARTS[i + 1]) open(PARTS[i + 1].id);
        return;
      }
      case 'done':
        done();
        return;
      case 'choice':
        buzz();
        setDesign(apply(shop, design, targets, a.choice, !pk.length));
        return;
      case 'set':
        buzz();
        setDesign(setRange(design, a.top, a.bottom));
        setPicked(null);
        return;
      case 'count': {
        const [t, b] = counts(design);
        const top = a.row === 'top' ? t + a.by : t;
        const bottom = a.row === 'bottom' ? b + a.by : b;
        setDesign(setRange(design, Math.max(0, Math.min(16, top)), Math.max(0, Math.min(16, bottom))));
        setPicked(null);
        return;
      }
      case 'fangs': {
        const on = !design.fangs;
        setDesign({ ...design, fangs: on });
        if (on && !canHaveFangs(design)) say('Fangs sit on the upper canines. Add 6 top teeth or more to see them.');
        return;
      }
      case 'perm': {
        const other = catalog.cuts.find((c) => c.id !== 'permanent')?.id ?? 'deep';
        setDesign({ ...design, cut: design.cut === 'permanent' ? other : 'permanent' });
        return;
      }
      case 'ins-toggle':
        if (extraOpen.ins || design.initials.text) {
          setExtraOpen((o) => ({ ...o, ins: false }));
          setDesign({ ...design, initials: { ...design.initials, text: '' } });
        } else {
          setExtraOpen((o) => ({ ...o, ins: true }));
          if (design.initials.tooth === null || !design.teeth.includes(design.initials.tooth)) setDesign({ ...design, initials: { ...design.initials, tooth: firstFront(design) } });
        }
        return;
      case 'ins-text': {
        const text = a.text.toUpperCase().replace(/[^A-Z0-9&.'\- ]/g, '').slice(0, 6);
        const tooth = design.initials.tooth !== null && design.teeth.includes(design.initials.tooth) ? design.initials.tooth : firstFront(design);
        setDesign({ ...design, initials: { ...design.initials, text, tooth } });
        return;
      }
      case 'ins-style':
        setDesign({ ...design, initials: { ...design.initials, style: a.style, tooth: design.initials.tooth ?? firstFront(design) } });
        return;
      case 'idea-toggle':
        if (extraOpen.idea || design.idea.trim() || inspo) {
          setExtraOpen((o) => ({ ...o, idea: false }));
          setDesign({ ...design, idea: '' });
          setInspo(null);
        } else setExtraOpen((o) => ({ ...o, idea: true }));
        return;
      case 'idea':
        setDesign({ ...design, idea: a.text.slice(0, 400) });
        return;
      case 'photo':
        void fileToUrl(a.file, 1200).then((url) => url && setPhoto(url));
        return;
      case 'inspo':
        void fileToUrl(a.file).then((url) => url && setInspo(url));
        return;
    }
  };

  // A tap on the 3D (the lab's G.tap).
  const onTap = (k: number) => {
    touch();
    if (mode !== 'build') return;
    if (part === 'teeth') {
      const next = toggleTooth(design, k);
      setDesign(next);
      setPicked(null);
      setVisited((v) => ({ ...v, teeth: true }));
      buzz();
      if (bubble?.kind === 'question' && next.teeth.length) setBubble(null);
      return;
    }
    if (!design.teeth.includes(k)) {
      say('That tooth isn’t in your build. Add it in Teeth.');
      return;
    }
    if (part === 'extras' && extraOpen.ins) {
      setDesign({ ...design, initials: { ...design.initials, tooth: k } });
      return;
    }
    buzz();
    setPicks((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...livePicks(design, p), k]));
  };
  const onMissTap = () => {
    touch();
    if (mode === 'build' && part !== 'teeth') setPicks([]);
  };

  const pickGroup = (g: GroupId | 'all') => {
    touch();
    setPicks(g === 'all' ? [] : groupTeeth(design.teeth, g));
    setSelOpen(false);
  };

  const doUndo = () => {
    touch();
    buzz();
    const u = undoStep(history);
    if (!u) return;
    const d = JSON.parse(u.design) as Design;
    setHistory(u.history);
    setDesign(d);
    setPicks((p) => p.filter((k) => d.teeth.includes(k)));
    setPicked(null);
    setBubble(null);
    say('Undone');
  };

  // ---------- the quick question ----------
  const QUESTIONS: Record<QuestionId, { title: string; answers: { id: string; label: string; more?: boolean }[] }> = useMemo(() => {
    const sells = <T extends { id: string }>(list: readonly T[], ids: string[]) => ids.filter((id) => list.some((x) => x.id === id));
    return {
      where: { title: 'Top, bottom or both?', answers: [{ id: 'top', label: 'Top' }, { id: 'bottom', label: 'Bottom' }, { id: 'both', label: 'Both' }] },
      many: { title: 'How many teeth?', answers: ['2', '4', '6', '8'].map((n) => ({ id: n, label: n })).concat([{ id: '16', label: 'All 16' }]) },
      metal: {
        title: 'Which metal?',
        answers: [...sells(catalog.metals, ['yellow', 'white', 'rose']).map((id) => ({ id, label: label(METALS, id) })), { id: 'more', label: 'More metals', more: true }],
      },
      finish: {
        title: 'Which finish?',
        answers: [...sells(catalog.styles, ['solid', 'diamond-cut', 'diamond-dust']).map((id) => ({ id, label: label(STYLES, id) })), { id: 'more', label: 'More finishes', more: true }],
      },
      stones: {
        title: 'Add stones?',
        answers: [
          { id: 'none', label: 'No stones' },
          ...(catalog.types.some((t) => t.id === 'iced') ? sells(catalog.settings, ['honeycomb', 'mosaic']).map((id) => ({ id, label: label(SETTINGS, id) })) : []),
          { id: 'more', label: 'More', more: true },
        ],
      },
      extras: {
        title: 'Anything extra?',
        answers: [...(catalog.fangs ? [{ id: 'fangs', label: 'Fangs' }] : []), ...(catalog.inscriptionStyles.length ? [{ id: 'ins', label: 'Initials' }] : []), { id: 'no', label: 'No extras' }],
      },
      happy: { title: 'Happy with it?', answers: [{ id: 'done', label: 'Done' }, { id: 'keep', label: 'Keep editing' }] },
    };
  }, [catalog]);

  const ask = (q: QuestionId) => setBubble({ kind: 'question', q, ...QUESTIONS[q] });
  const showUndo = (text: string, before: Snap, backTo: QuestionId | null, who = 'Changed', ms = UNDO_MS) => {
    undoSnap.current = { snap: before, back: backTo, ms };
    setBubble({ kind: 'undo', who, text });
  };

  // Seems stuck? Checked every second while building.
  const stuckState = useRef({ mode, bubble, hasTeeth: design.teeth.length > 0, trayBig, visited });
  stuckState.current = { mode, bubble, hasTeeth: design.teeth.length > 0, trayBig, visited };
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = stuckState.current;
      if (seemsStuck({ building: s.mode === 'build', bubbleOpen: Boolean(s.bubble), now: performance.now(), quietUntil: quietUntil.current, lastTouch: lastTouch.current, hasTeeth: s.hasTeeth, panelBig: s.trayBig }))
        setBubble({ kind: 'question', q: nextQuestion(s.hasTeeth, s.visited), ...QUESTIONS[nextQuestion(s.hasTeeth, s.visited)] });
    }, 1000);
    return () => window.clearInterval(id);
  }, [QUESTIONS]);

  // "Changed … Undo" goes after a few seconds.
  useEffect(() => {
    if (bubble?.kind !== 'undo') return;
    const t = window.setTimeout(() => {
      setBubble(null);
      touch();
    }, undoSnap.current?.ms ?? UNDO_MS);
    return () => window.clearTimeout(t);
  }, [bubble, touch]);

  const scopeWords = () => (pk.length ? (pk.length === 1 ? `the ${toothName(pk[0])}` : `the ${pk.length} teeth you picked`) : `all ${design.teeth.length} teeth`);
  const teethWords = (d: Design) => {
    const [t, b] = counts(d);
    return `${t && b ? `${t} top and ${b} bottom teeth` : t ? `${t} top teeth` : `${b} bottom teeth`} picked`;
  };

  const answer = (v: string) => {
    touch();
    buzz();
    if (!bubble || bubble.kind !== 'question') return;
    const q = bubble.q;
    setBubble(null);
    const before = q === 'many' && qSnap.current ? qSnap.current : snap();
    const targets = pk.length ? pk : design.teeth;
    const whole = !pk.length;
    const paintAll = (patch: (t: ToothDesign) => ToothDesign) => {
      const designs = { ...design.designs };
      targets.forEach((k) => {
        designs[k] = offeredDesign(shop, patch(designs[k])) ?? designs[k];
      });
      return { ...design, designs, base: whole ? offeredDesign(shop, patch(design.base)) ?? design.base : design.base };
    };
    if (q === 'where') {
      qSnap.current = before;
      qWhere.current = v as 'top' | 'bottom' | 'both';
      setDesign(setRange(design, v === 'bottom' ? 0 : 6, v === 'top' ? 0 : 6));
      ask('many');
      return;
    }
    if (q === 'many') {
      const n = Number(v);
      const next = setRange(design, qWhere.current === 'bottom' ? 0 : n, qWhere.current === 'top' ? 0 : n);
      setDesign(next);
      setVisited((x) => ({ ...x, teeth: true }));
      setPart('teeth');
      qSnap.current = null;
      showUndo(teethWords(next), before, 'where');
      return;
    }
    if (v === 'more') {
      open(q as PartId);
      return;
    }
    let msg = '';
    let next = design;
    if (q === 'metal') {
      msg = `${label(METALS, v)} on ${scopeWords()}`;
      next = paintAll((t) => ({ ...t, metal: v as ToothDesign['metal'] }));
    }
    if (q === 'finish') {
      msg = `${label(STYLES, v)} on ${scopeWords()}`;
      next = paintAll((t) => ({ ...t, style: v as ToothDesign['style'], type: 'plain' }));
    }
    if (q === 'stones') {
      msg = v === 'none' ? `No stones on ${scopeWords()}` : `${label(SETTINGS, v)} stones on ${scopeWords()}`;
      next = paintAll((t) => (v === 'none' ? { ...t, type: 'plain' } : { ...t, type: 'iced', setting: v as ToothDesign['setting'], style: 'solid' }));
    }
    if (q === 'extras') {
      if (v === 'fangs') {
        next = { ...design, fangs: true };
        msg = 'Fangs added';
      }
      if (v === 'ins') {
        open('extras');
        setExtraOpen({ ins: true, idea: false });
        if (design.initials.tooth === null) setDesign({ ...design, initials: { ...design.initials, tooth: firstFront(design) } });
        return;
      }
    }
    if (q === 'happy') {
      if (v === 'done') {
        done();
        return;
      }
      quietUntil.current = performance.now() + QUIET_AFTER_KEEP_MS;
    }
    if (q !== 'happy') setVisited((x) => ({ ...x, [q]: true }));
    setDesign(next);
    if (msg) showUndo(msg, before, q);
  };
  const closeBubble = () => {
    touch();
    setBubble(null);
    quietUntil.current = performance.now() + QUIET_AFTER_CLOSE_MS;
  };
  const undoBubble = () => {
    touch();
    buzz();
    const u = undoSnap.current;
    setBubble(null);
    if (!u) return;
    unsnap(u.snap);
    // Undoing an answer brings its question back.
    if (u.back) ask(u.back);
  };

  // ---------- AI ----------
  const known = Boolean(verified);
  const openAI = (from: 'door' | 'build', text?: string) => {
    setAi((a) => ({ ...a, from, step: 'talk', error: '', ...(text !== undefined ? { text } : {}) }));
    setBubble(null);
    setSelOpen(false);
    setMode('ai');
  };
  const leaveAI = () => {
    if (ai.from === 'build') setMode('build');
    else goDoor();
  };
  const aiPicture = (file: File | null) => {
    if (!file) {
      setAi((a) => ({ ...a, picture: null }));
      return;
    }
    void fileToUrl(file).then((url) => url && setAi((a) => ({ ...a, picture: url, error: '' })));
  };

  const runAI = async (token: string, phone: string, from: 'door' | 'build') => {
    const text = ai.text.trim();
    const pic = ai.picture;
    const fromStart = from === 'door';
    const before = fromStart ? { design: blankDesign(shop), visited: {}, picks: [] } : snap();
    setAi((a) => ({ ...a, busy: true, error: '', step: 'talk' }));
    const result = await describeBuild({ tenant: tenant.slug, words: text || undefined, picture: pic ?? undefined, phoneToken: token, current: fromStart ? undefined : toSpec(design) ?? undefined });
    if (!result.ok) {
      if (result.code === 'no_builds_left') {
        setLeft(0);
        writeLeft(phone, 0);
      }
      if (result.code === 'unverified') {
        setVerified(null);
        setAi((a) => ({ ...a, busy: false, step: 'contact' }));
        return;
      }
      setAi((a) => ({ ...a, busy: false, error: result.code === 'no_builds_left' ? '' : result.error }));
      posthog.capture('creator_ai_failed', { code: result.code });
      return;
    }
    const next = fromSpec(shop, result.spec, fromStart ? blankDesign(shop) : design);
    const note = result.note.replace(/^Built (it|the closest match)[.:]?\s*/i, '').trim();
    const [t, b] = counts(next);
    const allIced = next.teeth.every((k) => next.designs[k].type === 'iced');
    setLeft(result.buildsLeft);
    writeLeft(phone, result.buildsLeft);
    if (text) setIdeaWords((w) => [...w, text]);
    if (pic) setIdeaPicture(pic);
    if (fromStart) {
      setHistory({ past: [], last: JSON.stringify(blankDesign(shop)) });
      setNav([]);
    }
    setAi((a) => ({
      ...a,
      busy: false,
      text: '',
      picture: null,
      from: 'build',
      messages: [...a.messages, { me: text || 'A picture', picture: pic, title: result.closest ? 'Built the closest match' : 'Built it', hint: [summary(next), ...(note ? [note] : [])], set: { top: t, bottom: b, kind: allIced ? 'iced' : 'gold' } }],
    }));
    setDesign(next);
    setPicked(null);
    setPart('teeth');
    setVisited((v) => ({ ...v, teeth: true }));
    setPicks([]);
    setWaiting(false);
    touch();
    setMode('build');
    showUndo(`${summary(next)}${note ? `. ${note.split(/(?<=\.)\s/)[0]}` : ''}`, before, null, 'AI built it', 10000);
    posthog.capture('creator_ai_built', { closest: result.closest, left: result.buildsLeft, picture: Boolean(pic) });
  };

  const aiSend = (from: 'door' | 'build' = ai.from) => {
    touch();
    if (!ai.text.trim() && !ai.picture) return;
    if (verified) {
      if (left === 0) return;
      void runAI(verified.token, verified.phone, from);
      return;
    }
    setContactErr(null);
    setAi((a) => ({ ...a, from, step: 'contact', error: '' }));
  };
  const sendCode = async (again = false) => {
    const e = contactError(contact.name, contact.phone);
    setContactErr(e);
    if (e) {
      document.getElementById(e.field === 'name' ? 'aname' : 'aphone')?.focus();
      return;
    }
    setAi((a) => ({ ...a, busy: true, error: '' }));
    const r = await startPhoneCode(digits(contact.phone));
    setAi((a) => ({ ...a, busy: false, ...(r.ok ? { step: 'code' as const } : { error: r.error }) }));
    if (r.ok) {
      setCode('');
      setCodeErr('');
      setResendAt(Date.now() + RESEND_SECONDS * 1000);
      if (again) say('A new code is on its way.');
    }
  };
  const enterCode = async (value: string) => {
    setCode(value);
    setCodeErr('');
    if (value.length < 6) return;
    setAi((a) => ({ ...a, busy: true }));
    const r = await confirmPhoneCode(digits(contact.phone), value);
    if (!r.ok) {
      setAi((a) => ({ ...a, busy: false }));
      setCodeErr(r.error);
      return;
    }
    const v = { phone: r.phone, token: r.token };
    setVerified(v);
    setLeft(readLeft(r.phone));
    try {
      sessionStorage.setItem('vvs-first-name', contact.name.trim());
    } catch {
      // the after track asks again
    }
    void runAI(r.token, r.phone, ai.from);
  };
  useEffect(() => {
    if (ai.step !== 'code' || mode !== 'ai') return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [ai.step, mode]);

  // ---------- where the piece goes: the free part of the stage ----------
  const layout = useCallback(() => {
    const st = stage.current?.getBoundingClientRect();
    if (!st) return;
    const W = st.width;
    const H = st.height;
    const phone = W < PHONE_WIDTH;
    let next: Frame;
    if (mode === 'door') {
      const r = startPanel.current?.getBoundingClientRect();
      next = { top: TOP, bottom: Math.max(TOP + 140, (r ? r.top - st.top : H * 0.6) - 6), left: 0, right: W };
    } else {
      const t = tray.current?.getBoundingClientRect();
      // Select teeth: bottom right above the panel on a phone; beside the tools on a computer (above them when there's no room).
      const bar = selBar.current;
      if (bar && showSel && t) {
        if (phone) {
          bar.style.left = '';
          bar.style.bottom = `${Math.round(st.bottom - t.top + 12)}px`;
          root.current?.removeAttribute('data-selrow');
        } else {
          const tl = tools.current?.getBoundingClientRect();
          const w = selBtn.current?.offsetWidth ?? 140;
          if (tl && tl.right + 6 + w <= t.left - 16) {
            bar.style.left = `${Math.round(tl.right - st.left + 6)}px`;
            bar.style.bottom = `${Math.round(st.bottom - tl.bottom)}px`;
          } else if (tl) {
            bar.style.left = `${Math.round(tl.left - st.left)}px`;
            bar.style.bottom = `${Math.round(st.bottom - tl.top + 8)}px`;
          }
        }
      }
      // The bubble sits just above the panel on a phone, never over the piece.
      const bub = bubbleEl.current;
      if (bub && t) bub.style.bottom = phone ? `${Math.round(st.bottom - t.top + 10)}px` : '';
      if (!t) next = { top: TOP, bottom: H * 0.62, left: 0, right: W };
      else if (!phone) next = { top: TOP, bottom: H - (showSel ? 64 : 24), left: 0, right: t.left - st.left - 8 };
      else {
        let limit = t.top;
        if (bub) limit = Math.min(limit, bub.getBoundingClientRect().top);
        if (showSel && selBtn.current) limit = Math.min(limit, selBtn.current.getBoundingClientRect().top);
        next = { top: TOP, bottom: Math.max(TOP + 110, limit - st.top - 6), left: 0, right: W };
      }
    }
    setFrame((f) => (f && Math.abs(f.top - next.top) < 1 && Math.abs(f.bottom - next.bottom) < 1 && Math.abs(f.left - next.left) < 1 && Math.abs(f.right - next.right) < 1 ? f : next));
  }, [mode, showSel]);

  useLayoutEffect(() => {
    layout();
    const raf = requestAnimationFrame(layout);
    const later = window.setTimeout(layout, 450);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(later);
    };
  }, [layout, bubble, trayBig, startBig, part, ai.step, selOpen, design.teeth.length, waiting]);
  useEffect(() => {
    const ro = new ResizeObserver(() => layout());
    [stage.current, tray.current, startPanel.current].forEach((el) => el && ro.observe(el));
    window.addEventListener('resize', layout);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', layout);
    };
  }, [layout, mode]);

  // Select teeth closes on a tap anywhere else.
  useEffect(() => {
    if (!selOpen) return;
    const away = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest('.seltool')) setSelOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [selOpen]);

  // ---------- the 3D's view of the design ----------
  const customizations = useMemo<ToothCustomization[]>(
    () => Array.from({ length: 32 }, (_, k) => (design.designs[k] && design.teeth.includes(k) ? toothCustomization(design.designs[k], { fangs: setOptions(design).fangs, cut: design.cut }, k) : { ...baseToothState })),
    [design],
  );
  const inscriptions = useMemo(() => setOptions(design).inscriptions, [design]);
  const glowing = building && part !== 'teeth';

  const brand = config.brand;
  const own = tenant.demo;
  const hidden = config.pricing.display === 'hidden';
  const groups = offeredGroups(design.teeth);
  const groupHit = matchingGroup(design.teeth, pk);
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const grabButton = (
    <button
      type="button"
      className="grab tgrab"
      aria-label={trayBig ? 'Show less' : 'Show more'}
      aria-expanded={trayBig}
      onClick={(event) => {
        if (event.detail === 0) trayGrab.resize(!trayBig);
      }}
    >
      <i />
    </button>
  );

  return (
    <div
      ref={root}
      className={own ? 'creator' : `creator shop ${fontPairClass(brand)}`}
      style={own ? undefined : themeStyle(brand)}
      data-mode={mode}
      data-empty={design.teeth.length ? undefined : ''}
      data-bub={bubble ? '' : undefined}
      data-change={showSel ? '' : undefined}
      onPointerDownCapture={touch}
      onKeyDownCapture={touch}
    >
      <section className="stage" ref={stage} aria-label="Grill creator">
        <Suspense fallback={<div className="load">Setting the stage…</div>}>
          <CreatorStage
            customizations={customizations}
            selectedTeeth={glowing ? pk : []}
            isSelectionMode
            selectionLook={glowing ? 'glow' : 'none'}
            toggleToothSelection={onTap}
            inscriptions={inscriptions}
            photoImage={photo}
            view={view}
            frame={frame}
            jawOpen={jaw}
            onMissTap={onMissTap}
            onUserControl={touch}
            onReady={(state) => {
              three.current = state;
            }}
            onError={(error) => posthog.capture('creator_3d_failed', { reason: error.message.slice(0, 200) })}
          />
        </Suspense>

        <header className="bar gut">
          {own ? (
            <Link className="mark own" to="/" aria-label="VVS Lab, home">
              <img className="vvs" src="/assets/vvs/logo-mark.png" alt="" width="640" height="281" />
              <span>Lab</span>
            </Link>
          ) : (
            <button type="button" className="mark" aria-label={`${brand.name}, start page`} onClick={goDoor}>
              {brand.logo ? <img className="logo" src={brand.logo} alt="" /> : <i>{monogram(brand.name)}</i>}
              <span>{brand.name}</span>
            </button>
          )}
          <div className="bar-r">
            {(mode === 'build' || mode === 'after' || (mode === 'ai' && design.teeth.length > 0)) && <PriceChip total={breakdown.total} text={priceText} hidden={hidden} />}
          </div>
        </header>
        <div className="pill toast" role="status" style={{ opacity: toast ? 1 : 0 }}>
          {toast?.text}
        </div>

        {building && (
          <div className="tools" ref={tools}>
            <button
              type="button"
              className="tool"
              aria-pressed={jaw}
              aria-label={jaw ? 'Close the mouth' : 'Open the mouth'}
              onClick={() => {
                touch();
                setJaw((o) => !o);
              }}
            >
              <JawIcon />
              <span>{jaw ? 'Close mouth' : 'Open mouth'}</span>
            </button>
            <button
              type="button"
              className="tool"
              aria-label="Turn the piece"
              onClick={() => {
                touch();
                turnAt.current = ((turnAt.current + 2) % 3) - 1;
                setView({ side: turnAt.current === 0 ? 'front' : turnAt.current > 0 ? 'right' : 'left' });
              }}
            >
              <TurnIcon />
              <span>Turn</span>
            </button>
            <button type="button" className="tool" disabled={!canUndo(history)} aria-label="Undo the last change" onClick={doUndo}>
              <UndoIcon />
              <span>Undo</span>
            </button>
            <button type="button" className="tool aibtn" aria-label="Describe it: AI builds the closest version" onClick={() => openAI('build')}>
              <SparkIcon />
              <span>Describe it</span>
            </button>
          </div>
        )}

        {showSel && (
          <div className="seltool" ref={selBar}>
            {selOpen && (
              <div className="selpop" id="selpop" role="group" aria-label="Which teeth your next choice changes">
                <div className="chips">
                  <button type="button" className="chip" aria-pressed={!pk.length} onClick={() => pickGroup('all')}>
                    Whole set
                  </button>
                  {groups.map((g) => (
                    <button type="button" key={g.id} className="chip" aria-pressed={groupHit === g.id} onClick={() => pickGroup(g.id)}>
                      {g.label}
                    </button>
                  ))}
                  {pk.length > 0 && !groupHit && (
                    <button type="button" className="chip" aria-pressed onClick={() => setSelOpen(false)}>
                      {pk.length} {pk.length === 1 ? 'tooth' : 'teeth'} picked
                    </button>
                  )}
                </div>
                <p className="selhint">
                  <TapIcon />
                  Or tap any tooth on the 3D to pick it.
                </p>
              </div>
            )}
            <button
              type="button"
              ref={selBtn}
              className="tool selbtn"
              aria-expanded={selOpen}
              aria-controls="selpop"
              onClick={() => {
                touch();
                setSelOpen((o) => !o);
              }}
            >
              <ToothIcon />
              <span>Select teeth</span>
              {pk.length > 0 && <b>{selectionWord(design.teeth, pk)}</b>}
            </button>
          </div>
        )}

        {bubble && <QuickQuestion ref={bubbleEl} bubble={bubble} onAnswer={answer} onClose={closeBubble} onUndo={undoBubble} />}

        {mode === 'door' && (
          <StartPanel
            ref={startPanel}
            builds={builds}
            picked={picked}
            waiting={waiting && design.teeth.length ? summary(design) : null}
            big={startBig}
            setBig={setStartBig}
            aiText={ai.text}
            aiPicture={ai.picture}
            onAiText={(text) => setAi((a) => ({ ...a, text }))}
            onAiPicture={aiPicture}
            onAiSend={() => {
              openAI('door');
              aiSend('door');
            }}
            onBuild={(id) => {
              const b = builds.find((x) => x.build.id === id);
              if (b) startCreator(b.build.design, id);
            }}
            onEmpty={() => startCreator(blankDesign(shop), null)}
            onContinue={() => {
              setWaiting(false);
              setHistory(freshHistory());
              setVisited((v) => ({ teeth: true, ...v }));
              setMode('build');
            }}
          />
        )}

        {mode !== 'door' && (
          <aside className={trayBig ? 'tray big' : 'tray'} ref={tray} aria-label="Creator" onPointerDown={trayGrab.onPointerDown}>
            {mode === 'build' && (
              <BuildPanel
                shop={shop}
                design={design}
                picks={picks}
                part={part}
                visited={visited}
                open={extraOpen}
                photo={photo}
                inspo={inspo}
                showPrices={showPrices}
                totalText={priceText(breakdown.total)}
                grab={grabButton}
                act={act}
              />
            )}
            {mode === 'ai' && (
              <AiPanel
                step={ai.step}
                messages={ai.messages}
                text={ai.text}
                picture={ai.picture}
                busy={ai.busy}
                error={ai.error}
                known={known}
                left={left}
                shopName={shopName}
                name={contact.name}
                phone={contact.phone}
                contactError={contactErr}
                code={code}
                codeError={codeErr}
                resendIn={resendIn}
                grab={grabButton}
                onText={(text) => setAi((a) => ({ ...a, text }))}
                onPicture={aiPicture}
                onSend={() => aiSend()}
                onBack={() => {
                  if (ai.step === 'talk' || (ai.from === 'door' && ai.step === 'contact')) leaveAI();
                  else setAi((a) => ({ ...a, step: 'talk' }));
                }}
                onHand={() => setMode('build')}
                onName={(name) => {
                  setContact((c) => ({ ...c, name }));
                  if (contactErr && !contactError(name, contact.phone)) setContactErr(null);
                }}
                onPhone={(phone) => {
                  setContact((c) => ({ ...c, phone }));
                  if (contactErr && !contactError(contact.name, phone)) setContactErr(null);
                }}
                onSendCode={() => void sendCode()}
                onCode={(value) => void enterCode(value)}
                onWrongNumber={() => {
                  setCode('');
                  setAi((a) => ({ ...a, step: 'contact' }));
                }}
                onResend={() => void sendCode(true)}
              />
            )}
            {mode === 'after' && after && (
              <AfterFlow
                design={after}
                onKeepEditing={() => setMode('build')}
                onStartOver={() => {
                  setAfter(null);
                  setDesign(blankDesign(shop));
                  setPicked(null);
                  setWaiting(false);
                  setIdeaWords([]);
                  setIdeaPicture(null);
                  setInspo(null);
                  setPhoto(null);
                  saveDesign(tenant.slug, null);
                  setMode('door');
                }}
              />
            )}
          </aside>
        )}
      </section>
    </div>
  );
}
