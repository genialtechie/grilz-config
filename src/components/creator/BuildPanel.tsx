import type { ReactNode } from 'react';
import { CUTS, ENAMELS, ICED_FINISHES, INSCRIPTION_FONTS, INSCRIPTION_MAX, INSCRIPTION_PER_TOOTH, METALS, OPALS, SETTINGS, STYLES, isGold, type CharmId, type EnamelId, type InscriptionFontId, type ToothDesign } from '../../lib/renderSpec';
import { charmPrice } from '../../lib/pricing';
import { SetPicture } from './SetPicture';
import {
  PARTS,
  SETS,
  apply,
  centredRun,
  charmList,
  counts,
  current,
  delta,
  initialsRun,
  inscriptionsOf,
  lineOf,
  takenRow,
  isCentred,
  lettersNeed,
  livePicks,
  money,
  partValue,
  rowsOf,
  runRow,
  setOptions,
  toothName,
  type Choice,
  type Design,
  type Line,
  type PartId,
  type Shop,
} from './model';

export type BuildAct =
  | { type: 'open'; part: PartId }
  | { type: 'choice'; choice: Choice }
  | { type: 'set'; top: number; bottom: number }
  | { type: 'count'; row: 'top' | 'bottom'; by: 1 | -1 }
  | { type: 'fangs' }
  | { type: 'perm' }
  | { type: 'ins-toggle' }
  /** `line`: which line of letters (0 the first, 1 the one on the other row). */
  | { type: 'ins-text'; line: Line; text: string }
  | { type: 'ins-style'; line: Line; style: Design['initials']['style'] }
  | { type: 'ins-font'; line: Line; font: InscriptionFontId }
  | { type: 'ins-enamel'; line: Line; enamel: EnamelId | null }
  /** The letters across `count` teeth of `row`, centred. */
  | { type: 'ins-place'; line: Line; row: number; count: number }
  /** Choose the letters' teeth by tapping the first and the last on the 3D. */
  | { type: 'ins-pick'; line: Line }
  /** Add or take off the second line, on the other row. */
  | { type: 'ins2-toggle' }
  | { type: 'charm-toggle' }
  | { type: 'charm'; id: CharmId }
  | { type: 'idea-toggle' }
  | { type: 'idea'; text: string }
  | { type: 'photo'; file: File | null }
  | { type: 'inspo'; file: File | null }
  | { type: 'back' }
  | { type: 'next' }
  | { type: 'done' };

const INTRO: Record<PartId, string> = {
  teeth: 'Pick a set, or tap teeth on the 3D to add or remove them one by one.',
  metal: 'The metal for your teeth. To change only some, tap them on the 3D or pick a group.',
  finish: 'How the metal looks. To change only some teeth, tap them on the 3D or pick a group.',
  stones: 'Set stones into the metal: pick a setting, then the stone. Works on a group or single teeth too.',
  extras: 'Optional touches. Turn on the ones you want.',
};

const SWATCH = Object.fromEntries(METALS.map((m) => [m.id, m.swatch])) as Record<ToothDesign['metal'], string>;
const imageOf = (list: readonly { id: string; image?: string }[], id: string) => list.find((x) => x.id === id)?.image ?? '';
const PLAIN_IMAGE = '/assets/options/grillz/type-plain.webp';
const PHOTO_IMAGE = '/assets/options/grillz/type-photo.webp';
const charmImage = (id: CharmId) => `/assets/options/grillz/charm-${id}.webp`;
/** How many teeth the letters can go across, as chips. */
const SPANS = [1, 2, 3, 4, 6, 8];
const FONT_HINT: Record<InscriptionFontId, string> = { block: 'Bold capitals', script: 'Joined, flowing' };

type Props = {
  shop: Shop;
  design: Design;
  picks: number[];
  part: PartId;
  visited: Partial<Record<PartId, boolean>>;
  /** Extras rows opened without a value yet (initials, the second line, charms, your idea). */
  open: { ins: boolean; ins2: boolean; idea: boolean; charm: boolean };
  /** Choosing a line's teeth on the 3D: on, which line, and the first tooth tapped (waiting for the last). */
  insPick: { on: boolean; line: Line; anchor: number | null };
  photo: string | null;
  inspo: string | null;
  showPrices: boolean;
  totalText: string;
  grab: ReactNode;
  onHeadPointerDown?: (event: React.PointerEvent) => void;
  act: (a: BuildAct) => void;
};

function Tile({ title, sub, on, picture, disabled, onClick }: { title: string; sub?: string; on: boolean; picture: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="tile" aria-pressed={on} disabled={disabled} onClick={onClick}>
      <span className="pic">{picture}</span>
      <b>{title}</b>
      <span>{sub || ' '}</span>
    </button>
  );
}

function Chip({ label, em, on, disabled, onClick }: { label: ReactNode; em?: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={on} disabled={disabled} onClick={onClick}>
      {label}
      {em && <em>{em}</em>}
    </button>
  );
}

const Img = ({ src }: { src: string }) => (src ? <img alt="" src={src} loading="lazy" decoding="async" /> : <i />);

/** Round pictures that overlap like coins when teeth differ (at most three). */
function Stack({ items }: { items: ReactNode[] }) {
  if (items.length === 1) return <>{items[0]}</>;
  return (
    <span className={`stack n${Math.min(3, items.length)}`}>
      {items.slice(0, 3).map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </span>
  );
}

function firstWith(d: Design, list: number[], f: (t: ToothDesign) => string) {
  const seen = new Set<string>();
  return list.flatMap((k) => {
    const v = f(d.designs[k]);
    if (seen.has(v)) return [];
    seen.add(v);
    return [d.designs[k]];
  });
}

/** The round picture of a part in the strip. */
function Preview({ d, part }: { d: Design; part: PartId }) {
  if (part === 'teeth') {
    const [t, b] = counts(d);
    return <SetPicture top={t} bottom={b} />;
  }
  if (!d.teeth.length) return <span className="dash">—</span>;
  if (part === 'metal') return <Stack items={firstWith(d, d.teeth, (t) => t.metal).map((t) => <i className="swatch" style={{ background: SWATCH[t.metal] }} />)} />;
  if (part === 'finish')
    return <Stack items={firstWith(d, d.teeth, (t) => (t.type === 'photo' ? 'photo' : t.style)).map((t) => <Img src={t.type === 'photo' ? PHOTO_IMAGE : imageOf(STYLES, t.style)} />)} />;
  if (part === 'stones') {
    const st = firstWith(d, d.teeth, (t) => (t.type === 'iced' ? t.setting : 'none'));
    if (st.length === 1 && st[0].type !== 'iced') return <span className="dash">None</span>;
    return <Stack items={st.map((t) => (t.type === 'iced' ? <Img src={imageOf(SETTINGS, t.setting)} /> : <span className="dash">None</span>))} />;
  }
  const n = (setOptions(d).fangs ? 1 : 0) + (inscriptionsOf(d).length ? 1 : 0) + (charmList(d).length ? 1 : 0) + (d.cut === 'permanent' ? 1 : 0) + (d.idea.trim() ? 1 : 0);
  return <span className="dash">{n ? `+${n}` : '—'}</span>;
}

/** The lab's row: words on the left, a round picture on the right; picked like a radio. */
function MRow({ title, hint, on, picture, onClick }: { title: string; hint: string; on: boolean; picture: ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} className="mrow" onClick={onClick}>
      <span className="txt">
        <b>{title}</b>
        <span className="ins">{hint}</span>
      </span>
      <span className="prev">{picture}</span>
    </button>
  );
}

function Switch({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return <button type="button" className="sw" role="switch" aria-checked={on} aria-label={label} onClick={onClick} />;
}

function XRow({ title, sub, on, label, onToggle, children }: { title: string; sub: string; on: boolean; label?: string; onToggle: () => void; children?: ReactNode }) {
  return (
    <div className="xrow">
      <div className="top">
        <div>
          <b>{title}</b>
          <br />
          <span>{sub}</span>
        </div>
        <Switch label={label ?? title} on={on} onClick={onToggle} />
      </div>
      {on && children}
    </div>
  );
}

function Upload({ picture, empty, change, onFile }: { picture: string | null; empty: string; change: string; onFile: (file: File | null) => void }) {
  return (
    <label className="up">
      {picture && <img alt="" src={picture} />}
      <span>{picture ? change : empty}</span>
      <input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0] ?? null)} />
    </label>
  );
}

/** One line of letters: the text, lettering, finish, enamel and where it goes (the old builder's options). */
function Letters(props: Props & { line: Line }) {
  const { design: d, line, catalog, config, showPrices, act } = { ...props, catalog: props.shop.catalog, config: props.shop.config };
  const l = lineOf(d, line);
  const hints = config.pricing;
  const text = l.text.trim();
  const run = initialsRun(d, line);
  const taken = takenRow(d, line);
  const row = runRow(run) ?? rowsOf(d).find((r) => r !== taken) ?? 0;
  const need = lettersNeed(text);
  const rowSize = centredRun(d, row, 16).length;
  const spans = SPANS.filter((n) => n <= rowSize);
  const fits = text.length <= INSCRIPTION_PER_TOOTH * Math.max(1, run.length);
  const picking = props.insPick.on && props.insPick.line === line;
  const placeWords = run.length ? `${run.length === 1 ? `On the ${toothName(run[0])}` : `Across ${run.length} ${row ? 'bottom' : 'top'} teeth`}` : 'Pick your teeth first';
  const pickWords = picking ? (props.insPick.anchor === null ? `Tap the first tooth on the 3D${taken === null ? '' : `, on the ${taken ? 'top' : 'bottom'} row`}.` : 'Now tap the last tooth (or the same one again).') : `${placeWords}.`;
  const glyphs = (font: InscriptionFontId) => (text ? text.slice(0, 2) : font === 'block' ? 'AB' : 'Ab');
  const id = `ins-where-${line}`;
  const name = line ? 'second line' : 'letters';
  return (
    <>
      <div className="field">
        <input
          type="text"
          maxLength={INSCRIPTION_MAX}
          placeholder={line ? 'More letters, on this row' : 'Initials or a name'}
          value={l.text}
          autoComplete="off"
          autoCapitalize={l.font === 'block' ? 'characters' : 'words'}
          spellCheck={false}
          aria-label={line ? 'Letters on the other row' : 'Letters'}
          aria-describedby={id}
          className={l.font === 'script' ? 'script' : 'block'}
          onChange={(event) => act({ type: 'ins-text', line, text: event.target.value })}
        />
      </div>
      <p className="lab">Lettering</p>
      <div className="rows" role="radiogroup" aria-label={`Lettering of the ${name}`}>
        {INSCRIPTION_FONTS.map((f) => (
          <MRow key={f.id} title={f.label} hint={FONT_HINT[f.id]} on={l.font === f.id} picture={<span className={`glyph ${f.id}`}>{glyphs(f.id)}</span>} onClick={() => act({ type: 'ins-font', line, font: f.id })} />
        ))}
      </div>
      <p className="lab">Finish</p>
      <div className="chips" role="group" aria-label={`Finish of the ${name}`}>
        {catalog.inscriptionStyles.map((s) => (
          <Chip key={s.id} label={s.label} on={l.style === s.id} em={showPrices ? `${money(hints.inscription[s.id] ?? 0)} a tooth` : ''} onClick={() => act({ type: 'ins-style', line, style: s.id })} />
        ))}
      </div>
      {l.style === 'engraved' ? (
        <>
          <p className="lab">Enamel</p>
          <div className="chips" role="group" aria-label={`Enamel in the ${name}`}>
            <Chip label="None" on={l.enamel === null} onClick={() => act({ type: 'ins-enamel', line, enamel: null })} />
            {ENAMELS.map((e) => (
              <Chip
                key={e.id}
                label={
                  <>
                    <i className="dot" style={{ background: e.swatch }} />
                    {e.label}
                  </>
                }
                on={l.enamel === e.id}
                onClick={() => act({ type: 'ins-enamel', line, enamel: e.id })}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="locked">Engraved letters can be filled with coloured enamel.</p>
      )}
      <p className="lab">Where</p>
      {line === 0 && rowsOf(d).length > 1 && (
        <div className="chips" role="group" aria-label="Which row">
          {rowsOf(d).map((r) => (
            <Chip key={r} label={r ? 'Bottom row' : 'Top row'} on={row === r} onClick={() => act({ type: 'ins-place', line, row: r, count: Math.max(need, run.length || 1) })} />
          ))}
        </div>
      )}
      <div className="chips" role="group" aria-label={`How many teeth the ${name} go across`}>
        {spans.map((n) => (
          <Chip key={n} label={`${n} ${n === 1 ? 'tooth' : 'teeth'}`} on={!picking && run.length === n} disabled={n < need} onClick={() => act({ type: 'ins-place', line, row, count: n })} />
        ))}
        <Chip label="Tap teeth on the 3D" on={picking} onClick={() => act({ type: 'ins-pick', line })} />
      </div>
      <p className="note" id={id} aria-live="polite">
        {pickWords}
        {text && !fits ? ` ${text.length} letters need ${need} teeth or more: up to ${INSCRIPTION_PER_TOOTH} a tooth.` : ''}
      </p>
    </>
  );
}

export function PartBody(props: Props) {
  const { shop, design: d, picks, part, open, photo, inspo, showPrices, act } = props;
  const { catalog, config } = shop;
  const pk = livePicks(d, picks);
  const targets = pk.length ? pk : d.teeth;
  const whole = !pk.length;
  const cc = current(d, picks);
  const cost = (c: Choice) => (showPrices ? delta(shop, d, apply(shop, d, targets, c, whole)) : '');
  const choose = (choice: Choice) => act({ type: 'choice', choice });
  const [top, bottom] = counts(d);

  if (part === 'teeth') {
    return (
      <>
        <div className="tiles">
          {SETS.map((s, i) => (
            <Tile
              key={s.label}
              title={s.label}
              sub={`${s.top + s.bottom} ${s.top + s.bottom === 1 ? 'tooth' : 'teeth'}`}
              on={s.top === top && s.bottom === bottom && isCentred(d)}
              picture={<SetPicture top={s.top} bottom={s.bottom} />}
              onClick={() => act({ type: 'set', top: SETS[i].top, bottom: SETS[i].bottom })}
            />
          ))}
        </div>
        <div className="counts">
          {(['top', 'bottom'] as const).map((row) => (
            <span className="cnt" key={row}>
              <span className="lab">{row === 'top' ? 'Top' : 'Bottom'}</span>
              <button type="button" aria-label={`One fewer ${row} tooth`} disabled={(row === 'top' ? top : bottom) === 0} onClick={() => act({ type: 'count', row, by: -1 })}>
                −
              </button>
              <b aria-live="polite">{row === 'top' ? top : bottom}</b>
              <button type="button" aria-label={`One more ${row} tooth`} disabled={(row === 'top' ? top : bottom) === 16} onClick={() => act({ type: 'count', row, by: 1 })}>
                +
              </button>
            </span>
          ))}
        </div>
      </>
    );
  }
  if (!d.teeth.length) {
    return (
      <>
        <p className="note">Pick your teeth first, then everything else opens up.</p>
        <button type="button" className="cta ghost" style={{ flex: 'none' }} onClick={() => act({ type: 'open', part: 'teeth' })}>
          Pick teeth
        </button>
      </>
    );
  }
  if (part === 'metal') {
    const gold = isGold(cc.metal);
    return (
      <>
        <div className="tiles">
          {catalog.metals.map((m) => (
            <Tile key={m.id} title={m.label} sub={cc.metal === m.id ? 'Selected' : cost({ g: 'metal', k: m.id })} on={cc.metal === m.id} picture={<Img src={m.image} />} onClick={() => choose({ g: 'metal', k: m.id })} />
          ))}
        </div>
        {catalog.karats.length > 0 && (
          <>
            <p className="lab">Karat</p>
            <div className="chips">
              {catalog.karats.map((k) => (
                <Chip
                  key={k.id}
                  label={k.label}
                  on={gold && cc.karat === k.id}
                  em={gold ? (cc.karat === k.id ? k.detail : cost({ g: 'karat', k: k.id })) : ''}
                  disabled={!gold}
                  onClick={() => choose({ g: 'karat', k: k.id })}
                />
              ))}
            </div>
            {!gold && <p className="locked">Karats are for gold. {METALS.find((m) => m.id === cc.metal)?.label} comes in one grade.</p>}
          </>
        )}
      </>
    );
  }
  if (part === 'finish') {
    const iced = cc.type === 'iced';
    const photoOffered = catalog.types.some((t) => t.id === 'photo');
    const opalOffered = catalog.styles.some((s) => s.id === 'opals');
    const opalOn = cc.type !== 'photo' && cc.style === 'opals';
    return (
      <>
        {iced && (
          <p className="note">
            {opalOffered
              ? 'With stones set, the finish is the frame around them: solid, open face, or an opal in the middle.'
              : 'With stones set, the finish is the frame around them: solid or open face.'}
          </p>
        )}
        <div className="tiles">
          {catalog.styles.map((s) => {
            const on = cc.type !== 'photo' && cc.style === s.id;
            return (
              <Tile
                key={s.id}
                title={s.label}
                sub={on ? s.detail : cost({ g: 'style', k: s.id }) || s.detail}
                on={on}
                disabled={iced && s.id !== 'solid' && !ICED_FINISHES.includes(s.id)}
                picture={<Img src={s.image} />}
                onClick={() => choose({ g: 'style', k: s.id })}
              />
            );
          })}
          {photoOffered && (
            <Tile title="Photo" sub={showPrices ? `+${money(config.pricing.extras.photo)} an order` : ''} on={cc.type === 'photo'} disabled={iced} picture={<Img src={PHOTO_IMAGE} />} onClick={() => choose({ g: 'photo' })} />
          )}
        </div>
        {opalOffered && (
          <>
            <p className="lab">Opal colour</p>
            <div className="chips">
              {OPALS.map((o) => (
                <Chip
                  key={o.id}
                  label={
                    <>
                      <i className="dot" style={{ background: o.swatch }} />
                      {o.label}
                    </>
                  }
                  on={opalOn && (cc.opal ?? 'white') === o.id}
                  disabled={!opalOn}
                  onClick={() => choose({ g: 'opal', k: o.id })}
                />
              ))}
            </div>
            {!opalOn && <p className="locked">Pick Opals to choose a colour.</p>}
          </>
        )}
        {photoOffered && (
          <>
            <p className="lab">Your photo</p>
            {cc.type === 'photo' ? (
              <Upload picture={photo} empty="Add your photo" change="Change the photo" onFile={(file) => act({ type: 'photo', file })} />
            ) : (
              <p className="locked">Pick Photo to put your own image on the teeth.</p>
            )}
          </>
        )}
      </>
    );
  }
  if (part === 'stones') {
    if (!catalog.types.some((t) => t.id === 'iced')) return <p className="note">{config.brand.name} doesn’t set stones in grillz.</p>;
    const on = cc.type === 'iced';
    return (
      <>
        <div className="tiles">
          <Tile title="No stones" sub={on ? cost({ g: 'setting', k: 'none' }) : 'Selected'} on={!on} picture={<Img src={PLAIN_IMAGE} />} onClick={() => choose({ g: 'setting', k: 'none' })} />
          {catalog.settings.map((s) => (
            <Tile key={s.id} title={s.label} sub={on && cc.setting === s.id ? s.detail : cost({ g: 'setting', k: s.id })} on={on && cc.setting === s.id} picture={<Img src={s.image} />} onClick={() => choose({ g: 'setting', k: s.id })} />
          ))}
        </div>
        <p className="lab">Stone</p>
        <div className="chips">
          {catalog.stones.map((s) => (
            <Chip key={s.id} label={s.label} on={on && cc.stone === s.id} em={on ? (cc.stone === s.id ? s.detail : cost({ g: 'stone', k: s.id })) : ''} disabled={!on} onClick={() => choose({ g: 'stone', k: s.id })} />
          ))}
        </div>
        {!on && <p className="locked">Pick a setting first.</p>}
      </>
    );
  }
  // Extras
  const hints = config.pricing;
  const set = setOptions(d);
  const insStyles = catalog.inscriptionStyles;
  const ins = inscriptionsOf(d);
  const cheapest = insStyles.length ? Math.min(...insStyles.map((s) => hints.inscription[s.id] ?? 0)) : 0;
  const permOffered = catalog.cuts.some((c) => c.id === 'permanent');
  const price = (n: number) => (showPrices && n ? `+${money(n)}` : '');
  // Letters: the first line's words for the row, and the row the second line would take.
  const text = d.initials.text.trim();
  const run = initialsRun(d, 0);
  const otherRow = rowsOf(d).find((r) => r !== runRow(run));
  const row2 = runRow(initialsRun(d, 1)) ?? otherRow ?? 1;
  const where = (teeth: number[]) => (teeth.length === 1 ? `on the ${toothName(teeth[0])}` : `across ${teeth.length} ${teeth[0] >= 16 ? 'bottom' : 'top'} teeth`);
  // Charms: on the picked teeth, else the first front tooth without one.
  const charms = catalog.charms;
  const charmCount = charmList(d).length;
  const quote = `Quoted by ${config.brand.name}`;
  const charmCost = (id: CharmId) => {
    const n = charmPrice(hints, id);
    return n === undefined ? 'Quoted' : showPrices ? `+${money(n)}` : '';
  };
  const each = charms.length ? charmPrice(hints, charms[0].id) : undefined;
  const charmSub = charmCount
    ? `${charmCount} added · ${each === undefined ? `quoted by ${config.brand.name}` : `${price(each)} each`}`
    : each === undefined || !showPrices
      ? quote
      : `${price(each)} each`;
  const charmTargets = pk.length ? pk : [];
  return (
    <>
      {catalog.fangs && (
        <XRow title="Fangs" sub={set.fangs ? 'On the upper canines' : price(hints.extras.fangs) || 'On the upper canines'} on={d.fangs} onToggle={() => act({ type: 'fangs' })} />
      )}
      {permOffered && (
        <XRow
          title={CUTS[1].label}
          sub={d.cut === 'permanent' ? CUTS[1].detail : [price(hints.cuts?.permanent?.amount ?? hints.extras.permanent), CUTS[1].detail.toLowerCase()].filter(Boolean).join(' · ')}
          on={d.cut === 'permanent'}
          onToggle={() => act({ type: 'perm' })}
        />
      )}
      {insStyles.length > 0 && (
        <XRow
          title="Initials or a name"
          sub={ins.length ? ins.map((x) => `"${x.text}" ${where(x.teeth)}`).join(' · ') : showPrices ? `From ${money(cheapest)} a tooth` : 'On one tooth or across several'}
          label="Initials or a name"
          on={open.ins || Boolean(d.initials.text) || Boolean(d.second.text)}
          onToggle={() => act({ type: 'ins-toggle' })}
        >
          <Letters {...props} line={0} />
          {props.open.ins2 || d.second.text ? (
            <>
              <div className="line2">
                <p className="sec">Letters on the {row2 ? 'bottom' : 'top'} row</p>
                <Chip label="Remove" on={false} onClick={() => act({ type: 'ins2-toggle' })} />
              </div>
              <Letters {...props} line={1} />
            </>
          ) : (
            otherRow !== undefined &&
            text && (
              <button type="button" className="mrow addline" onClick={() => act({ type: 'ins2-toggle' })}>
                <span className="txt">
                  <b>Add letters on the other row</b>
                  <span className="ins">
                    {otherRow ? 'Bottom' : 'Top'} row{showPrices ? ` · from ${money(cheapest)} a tooth` : ''}
                  </span>
                </span>
                <span className="prev">
                  <span className="glyph">+</span>
                </span>
              </button>
            )
          )}
        </XRow>
      )}
      {charms.length > 0 && (
        <XRow title="One-of-one charms" sub={charmSub} on={open.charm || charmCount > 0} onToggle={() => act({ type: 'charm-toggle' })}>
          <div className="strip" role="group" aria-label="Charms">
            {charms.map((c) => (
              <Tile
                key={c.id}
                title={c.label}
                sub={charmCost(c.id)}
                on={charmTargets.length > 0 && charmTargets.every((k) => d.charms[k] === c.id)}
                picture={<Img src={charmImage(c.id)} />}
                onClick={() => act({ type: 'charm', id: c.id })}
              />
            ))}
          </div>
          <p className="note" aria-live="polite">
            {pk.length ? `Goes on ${pk.length === 1 ? `the ${toothName(pk[0])}` : `the ${pk.length} teeth you picked`}. Tap it again to take it off.` : 'Tap a tooth on the 3D, then a charm. One charm a tooth.'}
          </p>
        </XRow>
      )}
      {catalog.vision && (
        <XRow title="Your idea" sub={d.idea.trim() || inspo ? 'Added' : 'Describe it, or add a photo'} on={open.idea || Boolean(d.idea.trim() || inspo)} onToggle={() => act({ type: 'idea-toggle' })}>
          <div className="field">
            <textarea placeholder="Describe a piece you have in mind." aria-label="Your idea" maxLength={400} value={d.idea} onChange={(event) => act({ type: 'idea', text: event.target.value })} />
          </div>
          <Upload picture={inspo} empty="Add an inspiration photo" change="Change the photo" onFile={(file) => act({ type: 'inspo', file })} />
        </XRow>
      )}
    </>
  );
}

/** The build strip (chosen Nov 17): the five parts pinned on top, the open part below, Back and Next or Done under it. */
export function BuildPanel(props: Props) {
  const { design: d, part, visited, totalText, act, picks } = props;
  const i = PARTS.findIndex((p) => p.id === part);
  const next = PARTS[i + 1];
  const seen = PARTS.filter((p) => visited[p.id]).length;
  return (
    <>
      {props.grab}
      <div className="strip5" role="tablist" aria-label="Your build">
        {PARTS.map((p) => {
          const fresh = !visited[p.id];
          return (
            <button
              type="button"
              key={p.id}
              className={fresh ? 'sitem fresh' : 'sitem'}
              role="tab"
              aria-selected={part === p.id}
              aria-label={`${p.label}: ${partValue(d, p.id, picks)}${fresh ? ', not opened yet' : ''}`}
              onClick={() => act({ type: 'open', part: p.id })}
            >
              <span className="prev">
                <Preview d={d} part={p.id} />
              </span>
              <b>{p.label}</b>
              <span className="sv">{partValue(d, p.id, picks)}</span>
            </button>
          );
        })}
      </div>
      <div className="thead" onPointerDown={props.onHeadPointerDown}>
        <h2>{PARTS[i].label}</h2>
      </div>
      <div className="tbody" role="tabpanel" aria-label={PARTS[i].label}>
        <p className="intro">{INTRO[part]}</p>
        <PartBody {...props} />
      </div>
      <div className="tfoot col">
        <div className="btns">
          <button type="button" className="cta ghost second" onClick={() => act({ type: 'back' })}>
            Back
          </button>
          {next ? (
            <button type="button" className="cta" disabled={!d.teeth.length} onClick={() => act({ type: 'next' })}>
              Next
            </button>
          ) : (
            <button type="button" className="cta" disabled={!d.teeth.length} onClick={() => act({ type: 'done' })}>
              Done <small>{totalText}</small>
            </button>
          )}
        </div>
        <p className="free">{seen === PARTS.length ? 'Everything explored' : `${seen} of ${PARTS.length} explored`}</p>
      </div>
    </>
  );
}

