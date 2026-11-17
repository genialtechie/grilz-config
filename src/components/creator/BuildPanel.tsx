import type { ReactNode } from 'react';
import { CUTS, METALS, OPALS, SETTINGS, STYLES, isGold, type ToothDesign } from '../../lib/renderSpec';
import { SetPicture } from './SetPicture';
import {
  PARTS,
  SETS,
  apply,
  counts,
  current,
  delta,
  initialsOn,
  isCentred,
  livePicks,
  money,
  partValue,
  setOptions,
  toothName,
  type Choice,
  type Design,
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
  | { type: 'ins-text'; text: string }
  | { type: 'ins-style'; style: Design['initials']['style'] }
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

type Props = {
  shop: Shop;
  design: Design;
  picks: number[];
  part: PartId;
  visited: Partial<Record<PartId, boolean>>;
  /** Extras rows opened without a value yet (initials, your idea). */
  open: { ins: boolean; idea: boolean };
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
  const n = (setOptions(d).fangs ? 1 : 0) + (initialsOn(d) ? 1 : 0) + (d.cut === 'permanent' ? 1 : 0) + (d.idea.trim() ? 1 : 0);
  return <span className="dash">{n ? `+${n}` : '—'}</span>;
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
    const opalOn = cc.type !== 'photo' && cc.style === 'opals' && !iced;
    return (
      <>
        {iced && <p className="note">With stones set, the finish is the frame around them: solid or open face.</p>}
        <div className="tiles">
          {catalog.styles.map((s) => {
            const on = cc.type !== 'photo' && cc.style === s.id;
            return (
              <Tile
                key={s.id}
                title={s.label}
                sub={on ? s.detail : cost({ g: 'style', k: s.id }) || s.detail}
                on={on}
                disabled={iced && s.id !== 'solid' && s.id !== 'open-face'}
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
  const insOn = initialsOn(d);
  const where = insOn ? `the ${toothName(d.initials.tooth!)}` : 'a front tooth';
  const cheapest = insStyles.length ? Math.min(...insStyles.map((s) => hints.inscription[s.id] ?? 0)) : 0;
  const permOffered = catalog.cuts.some((c) => c.id === 'permanent');
  const price = (n: number) => (showPrices && n ? `+${money(n)}` : '');
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
        <XRow title="Initials" sub={insOn ? `On ${where}. Tap a tooth to move them.` : showPrices ? `From ${money(cheapest)}` : 'On a tooth you pick'} on={open.ins || Boolean(d.initials.text)} onToggle={() => act({ type: 'ins-toggle' })}>
          <div className="field">
            <input
              type="text"
              maxLength={6}
              placeholder="Up to 6 letters"
              value={d.initials.text}
              autoComplete="off"
              aria-label="Initials"
              onChange={(event) => act({ type: 'ins-text', text: event.target.value })}
            />
          </div>
          <div className="chips">
            {insStyles.map((s) => (
              <Chip key={s.id} label={s.label} on={d.initials.style === s.id} em={showPrices ? money(hints.inscription[s.id] ?? 0) : ''} onClick={() => act({ type: 'ins-style', style: s.id })} />
            ))}
          </div>
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

