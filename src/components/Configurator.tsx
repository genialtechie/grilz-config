import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { usePostHog } from '@posthog/react';
import type { RootState } from '@react-three/fiber';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CreditCard,
  ImagePlus,
  Minus,
  MousePointer2,
  Move3d,
  Package,
  Plus,
  RotateCcw,
  ScanLine,
  ShoppingBag,
  Store,
  X,
} from 'lucide-react';
import Scene from './three/Scene';
import { LeadCapture, RenderOverlay, type Lead } from './AiRender';
import { OptionCard } from './builder/OptionCard';
import { capturePreview } from '../lib/capturePreview';
import { downscaleImage } from '../lib/downscaleImage';
import { useAiRender } from '../lib/hooks/useAiRender';
import { baseToothState, useGrillzCustomization } from '../lib/hooks/useGrillzCustomization';
import {
  CUTS,
  DEFAULT_SET,
  DEFAULT_TOOTH,
  FANG_OPTIONS,
  GRILLZ_TYPES,
  KARATS,
  METALS,
  MOLDS,
  SETTINGS,
  STONES,
  STYLES,
  VISION_MAX,
  isGold,
  priceBreakdown,
  priceHint,
  summarizeDesign,
  type MoldId,
  type RenderSpec,
  type SetOptions,
  type ToothDesign,
} from '../lib/renderSpec';
import type { ToothCustomization } from '../lib/types';

type StepId = 'teeth' | 'metal' | 'style' | 'stones' | 'extras' | 'vision' | 'photo';

const STEP_LABELS: Record<StepId, string> = {
  teeth: 'Teeth',
  metal: 'Metal',
  style: 'Style',
  stones: 'Stones',
  extras: 'Extras',
  vision: 'Make it yours',
  photo: 'Your photo',
};

const STEP_INTROS: Record<StepId, { title: string; text: string }> = {
  teeth: { title: 'Choose your teeth', text: 'Pick a popular set, adjust top and bottom, or tap teeth on the model.' },
  metal: { title: 'Pick your metal', text: 'Every metal and karat updates the model and the price.' },
  style: { title: 'Choose the look', text: 'Plain, iced out or a photo, then the finish.' },
  stones: { title: 'Set the stones', text: 'Choose how the stones are set and what they are.' },
  extras: { title: 'Fangs and fit', text: 'Add fangs and choose how the grillz sit.' },
  vision: { title: 'Make it yours', text: 'Describe your idea or upload a reference. Both shape your AI photo.' },
  photo: { title: 'See it for real', text: 'Your price and a studio photo of your design.' },
};

const POPULAR = [
  { id: '6x6', label: '6 × 6', top: 6, bottom: 6 },
  { id: '8x8', label: '8 × 8', top: 8, bottom: 8 },
  { id: 'top6', label: '6 top', top: 6, bottom: 0 },
  { id: 'top8', label: '8 top', top: 8, bottom: 0 },
  { id: 'two', label: '2 piece', top: 2, bottom: 0 },
  { id: 'single', label: 'Single', top: 1, bottom: 0 },
  { id: '10x10', label: '10 × 10', top: 10, bottom: 10 },
  { id: 'full', label: 'Full set', top: 16, bottom: 16 },
] as const;

const MOLD_ICONS = { kit: Package, own: ScanLine, store: Store } as const;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatPrice = (value: number) => currencyFormatter.format(value);

const depositFor = (total: number) => Math.max(100, Math.round((total * 0.25) / 10) * 10);

function Configurator() {
  const posthog = usePostHog();
  const hasCapturedOpen = useRef(false);
  const [step, setStep] = useState<StepId>('teeth');
  const [panelOpen, setPanelOpen] = useState(true);
  const [base, setBase] = useState<ToothDesign>(DEFAULT_TOOTH);
  const [overrides, setOverrides] = useState<Record<number, ToothDesign>>({});
  const [pickMode, setPickMode] = useState(false);
  const [pickedTeeth, setPickedTeeth] = useState<number[]>([]);
  const [setOptions, setSetOptions] = useState<SetOptions>(DEFAULT_SET);
  const [inspiration, setInspiration] = useState<string | null>(null);
  const [inspirationError, setInspirationError] = useState<string | null>(null);
  const [mold, setMold] = useState<MoldId>('kit');
  const [depositReached, setDepositReached] = useState(false);
  const threeState = useRef<RootState | null>(null);
  const panelScroll = useRef<HTMLDivElement | null>(null);
  const render = useAiRender();
  const [lead, setLead] = useState<Lead | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const {
    selectedTeeth,
    toggleToothSelection,
    setRowCount,
    clearAllTeeth,
    resetAll,
  } = useGrillzCustomization();

  const selectedSet = useMemo(() => new Set(selectedTeeth), [selectedTeeth]);
  const upperCount = selectedTeeth.filter((index) => index < 16).length;
  const lowerCount = selectedTeeth.length - upperCount;
  const designFor = (index: number) => overrides[index] ?? base;

  const teethDesigns = useMemo(
    () => selectedTeeth.map((index) => ({ index, ...(overrides[index] ?? base) })),
    [selectedTeeth, overrides, base],
  );
  const anyIced = teethDesigns.some((tooth) => tooth.type === 'iced');
  const isMixed = new Set(teethDesigns.map((tooth) => JSON.stringify({ ...tooth, index: 0 }))).size > 1;

  // When picking teeth, the cards reflect the first picked tooth; otherwise the shared design.
  const activePicked = pickedTeeth.filter((index) => selectedSet.has(index));
  const shown: ToothDesign = pickMode && activePicked.length ? designFor(activePicked[0]) : base;
  const pickingNothing = pickMode && activePicked.length === 0;

  const steps: StepId[] = ['teeth', 'metal', 'style', ...(anyIced ? (['stones'] as const) : []), 'extras', 'vision', 'photo'];
  const stepIndex = Math.max(0, steps.indexOf(step));
  const nextStep = steps.at(stepIndex + 1);
  const prevStep = stepIndex > 0 ? steps.at(stepIndex - 1) : undefined;

  const pricing = priceBreakdown(teethDesigns, setOptions);
  const totalCost = pricing.total;

  // What the 3D model shows: the selection while choosing teeth or picking,
  // otherwise each tooth's own metal and stones.
  const isSelectionMode = step === 'teeth' || pickMode;
  const highlighted = step === 'teeth' ? selectedTeeth : activePicked;
  const customizations = useMemo<ToothCustomization[]>(
    () =>
      Array.from({ length: 32 }, (_, index) => {
        if (step === 'teeth' || !selectedSet.has(index)) return { ...baseToothState };
        const design = overrides[index] ?? base;
        const metal = METALS.find((item) => item.id === design.metal)!;
        return {
          material: isGold(design.metal) ? 'gold' : 'silver',
          color: metal.swatch,
          hasDiamonds: design.type === 'iced',
          diamondType: design.stone === 'moissanite' ? 'moissanite' : 'lab',
        };
      }),
    [base, overrides, selectedSet, step],
  );

  const handleToothClick = (index: number) => {
    if (step === 'teeth') {
      toggleToothSelection(index);
      return;
    }
    if (!pickMode || !selectedSet.has(index)) return;
    setPickedTeeth((previous) =>
      previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index],
    );
  };

  // Applies a design change to every tooth, or only to the picked teeth.
  const applyDesign = (patch: Partial<ToothDesign>) => {
    if (pickMode) {
      if (!activePicked.length) return;
      setOverrides((previous) => {
        const next = { ...previous };
        activePicked.forEach((index) => {
          next[index] = { ...(previous[index] ?? base), ...patch };
        });
        return next;
      });
      return;
    }
    setBase((previous) => ({ ...previous, ...patch }));
    setOverrides((previous) =>
      Object.fromEntries(Object.entries(previous).map(([index, design]) => [index, { ...design, ...patch }])),
    );
  };

  const updateSet = (patch: Partial<SetOptions>) => setSetOptions((previous) => ({ ...previous, ...patch }));

  const renderSpec = useMemo<RenderSpec | null>(
    () => (teethDesigns.length ? { ...setOptions, teeth: teethDesigns } : null),
    [setOptions, teethDesigns],
  );
  const designLines = renderSpec ? summarizeDesign(renderSpec) : [];

  const designProperties = () => ({
    selected_teeth: selectedTeeth.length,
    upper_teeth: upperCount,
    lower_teeth: lowerCount,
    mixed_design: isMixed,
    metal: base.metal,
    karat: isGold(base.metal) ? base.karat : 'none',
    grillz_type: base.type,
    style: base.style,
    any_iced: anyIced,
    fangs: setOptions.fangs,
    cut: setOptions.cut,
    has_vision: setOptions.vision.trim().length > 0,
    has_inspiration: Boolean(inspiration),
    estimated_total: totalCost,
  });

  const startRender = () => {
    if (!threeState.current || !renderSpec) return;
    const state = threeState.current;
    const spec = renderSpec;
    const reference = inspiration;
    // Let the focus/keyboard paint first; the high-res capture takes a frame.
    window.requestAnimationFrame(() => {
      let preview: string;
      try {
        preview = capturePreview(state);
      } catch {
        return;
      }
      posthog.capture('sample_render_started', designProperties());
      void render.start(preview, spec, reference).then((result) => {
        if (result.ok) {
          posthog.capture('sample_render_completed', { ...designProperties(), render_seconds: result.seconds });
        } else if (result.reason !== 'aborted') {
          posthog.capture('sample_render_failed', { ...designProperties(), reason: result.reason });
        }
      });
    });
  };

  const handleRenderIntent = () => {
    if (render.status === 'idle' && render.rendersLeft > 0) startRender();
  };

  const handleLeadSubmit = (submitted: Lead) => {
    setLead(submitted);
    setShowPhoto(true);
    posthog.capture('sample_lead_submitted', {
      ...designProperties(),
      lead_name: submitted.name,
      lead_contact: submitted.contact,
      lead_note: submitted.note || undefined,
      render_status_at_submit: render.status,
      $set: { name: submitted.name, contact: submitted.contact },
    });
    posthog.capture('sample_configuration_completed', designProperties());
    if (render.status === 'idle') startRender();
  };

  const regenerate = () => {
    setShowPhoto(true);
    startRender();
  };

  useEffect(() => {
    if (hasCapturedOpen.current) return;
    hasCapturedOpen.current = true;
    posthog.capture('sample_configurator_opened');
  }, [posthog]);

  const goTo = (target: StepId) => {
    if (target !== 'teeth' && selectedTeeth.length === 0) return;
    if (step === 'teeth' && target !== 'teeth') {
      posthog.capture('sample_design_started', { selected_teeth: selectedTeeth.length });
    }
    if (target === 'photo' && step !== 'photo') {
      posthog.capture('sample_design_reviewed', { placement: 'stepper', ...designProperties() });
    }
    if (step === 'photo' && target !== 'photo') {
      // The design may change, so the next photo is generated fresh.
      render.reset();
      setShowPhoto(false);
      setDepositReached(false);
    }
    posthog.capture('sample_step_viewed', { step: target });
    setPickMode(false);
    setPickedTeeth([]);
    setStep(target);
    setPanelOpen(true);
    panelScroll.current?.scrollTo({ top: 0 });
  };

  const handleReset = () => {
    render.reset();
    setLead(null);
    setShowPhoto(false);
    setDepositReached(false);
    resetAll();
    setBase(DEFAULT_TOOTH);
    setOverrides({});
    setPickMode(false);
    setPickedTeeth([]);
    setSetOptions(DEFAULT_SET);
    setInspiration(null);
    setMold('kit');
    setStep('teeth');
    setPanelOpen(true);
  };

  const reserveDeposit = () => {
    posthog.capture('sample_deposit_clicked', { ...designProperties(), deposit: depositFor(totalCost), mold });
    setDepositReached(true);
  };

  const handleInspiration = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setInspirationError('Choose an image file.');
      return;
    }
    try {
      setInspiration(await downscaleImage(file, 1024));
      setInspirationError(null);
    } catch {
      setInspirationError('That image could not be read. Try a JPG or PNG.');
    }
  };

  const scopeBar = (
    <div className="scope-bar">
      <div className="segmented-control">
        <button
          className={!pickMode ? 'segment segment--selected' : 'segment'}
          type="button"
          onClick={() => {
            setPickMode(false);
            setPickedTeeth([]);
          }}
        >
          All {selectedTeeth.length} teeth
        </button>
        <button className={pickMode ? 'segment segment--selected' : 'segment'} type="button" onClick={() => setPickMode(true)}>
          <MousePointer2 size={14} /> Pick teeth
        </button>
      </div>
      {pickMode && (
        <small className="scope-note">
          {activePicked.length
            ? `Changes apply to ${activePicked.length} picked ${activePicked.length === 1 ? 'tooth' : 'teeth'}.`
            : 'Tap teeth on the model, then choose an option for just those.'}
        </small>
      )}
      {!pickMode && isMixed && <small className="scope-note">Mixed design: changes here apply to every tooth.</small>}
    </div>
  );

  const intro = STEP_INTROS[step];

  return (
    <main className="configurator-shell">
      <header className="builder-header">
        <Link className="brand-lockup" to="/" aria-label="Back to MagPollo custom commerce">
          <img className="brand-logo" src="/assets/magpollo-logo.svg" alt="MagPollo" />
          <small>Custom commerce</small>
        </Link>
        <div className="header-actions">
          <button className="icon-button" type="button" onClick={handleReset} aria-label="Start over" title="Start over">
            <RotateCcw size={18} strokeWidth={1.8} />
          </button>
          <div className="header-total">
            <small>Estimated total</small>
            <strong>{formatPrice(totalCost)}</strong>
          </div>
          <button className="cart-button" type="button" onClick={() => goTo('photo')} disabled={!selectedTeeth.length}>
            <ShoppingBag size={17} />
            <span>Review</span>
          </button>
        </div>
      </header>

      <div className="builder-workspace">
        <section className="visualizer" aria-label="Interactive 3D grillz preview">
          <Scene
            customizations={customizations}
            selectedTeeth={highlighted}
            isSelectionMode={isSelectionMode}
            toggleToothSelection={handleToothClick}
            onReady={(state) => {
              threeState.current = state;
            }}
          />

          {showPhoto && (
            <RenderOverlay
              status={render.status}
              image={render.image}
              error={render.error}
              startedAt={render.startedAt}
              canRetry={render.rendersLeft > 0}
              onRetry={startRender}
              onClose={() => setShowPhoto(false)}
            />
          )}

          <div className="viewer-status">
            <span className="status-dot" />
            <span>{upperCount} top · {lowerCount} bottom</span>
          </div>

          <div className="viewer-instructions" aria-hidden="true">
            {isSelectionMode ? <MousePointer2 size={16} /> : <Move3d size={16} />}
            <span>{isSelectionMode ? 'Tap a tooth to select it' : 'Drag to rotate · Scroll to zoom'}</span>
          </div>

          <button
            className="panel-toggle"
            type="button"
            onClick={() => setPanelOpen((open) => !open)}
            aria-label={panelOpen ? 'Hide customization panel' : 'Show customization panel'}
            title={panelOpen ? 'Hide controls' : 'Show controls'}
          >
            {panelOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            <span>{panelOpen ? 'Hide controls' : 'Show controls'}</span>
          </button>
        </section>

        <aside className={`builder-panel${panelOpen ? '' : ' builder-panel--closed'}`} aria-label="Product configuration controls">
          <nav className="step-pills" aria-label="Builder steps">
            {steps.map((id, index) => (
              <button
                key={id}
                type="button"
                className={`step-pill${id === step ? ' step-pill--active' : ''}${index < stepIndex ? ' step-pill--done' : ''}`}
                onClick={() => goTo(id)}
                disabled={id !== 'teeth' && selectedTeeth.length === 0}
                aria-current={id === step ? 'step' : undefined}
              >
                <span className="step-pill__number">{index < stepIndex ? <Check size={11} strokeWidth={3} /> : index + 1}</span>
                <span className="step-pill__label">{STEP_LABELS[id]}</span>
              </button>
            ))}
          </nav>

          <div className="panel-scroll" ref={panelScroll}>
            <div className="panel-view" key={step}>
              <div className="panel-heading panel-heading--compact">
                <h1>{intro.title}</h1>
                <p>{intro.text}</p>
              </div>

              {step === 'teeth' && (
                <>
                  <fieldset className="control-group">
                    <legend>Popular sets</legend>
                    <div className="preset-grid preset-grid--four">
                      {POPULAR.map((preset) => (
                        <button
                          key={preset.id}
                          className={upperCount === preset.top && lowerCount === preset.bottom ? 'option-button option-button--selected' : 'option-button'}
                          type="button"
                          onClick={() => {
                            setRowCount('top', preset.top);
                            setRowCount('bottom', preset.bottom);
                          }}
                        >
                          <strong>{preset.label}</strong>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="control-group">
                    <legend>Fine-tune</legend>
                    {([['top', 'Top teeth', upperCount], ['bottom', 'Bottom teeth', lowerCount]] as const).map(([row, title, count]) => (
                      <div className="row-counter" key={row}>
                        <span>{title}</span>
                        <div>
                          <button type="button" onClick={() => setRowCount(row, count - (count > 2 ? 2 : 1))} disabled={count === 0} aria-label={`Fewer ${title.toLowerCase()}`}>
                            <Minus size={15} />
                          </button>
                          <strong>{count === 16 ? 'All' : count}</strong>
                          <button type="button" onClick={() => setRowCount(row, count + (count >= 2 ? 2 : 1))} disabled={count === 16} aria-label={`More ${title.toLowerCase()}`}>
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button className="text-button text-button--left" type="button" onClick={clearAllTeeth} disabled={!selectedTeeth.length}>
                      Clear selection
                    </button>
                  </fieldset>
                </>
              )}

              {step === 'metal' && (
                <>
                  {scopeBar}
                  <div className="option-grid">
                    {METALS.map((metal) => (
                      <OptionCard
                        key={metal.id}
                        label={metal.label}
                        hint={priceHint.metal(metal.id, shown.karat)}
                        image={metal.image}
                        swatch={metal.swatch}
                        selected={shown.metal === metal.id}
                        disabled={pickingNothing}
                        onSelect={() => applyDesign({ metal: metal.id })}
                      />
                    ))}
                  </div>
                  {isGold(shown.metal) && (
                    <fieldset className="control-group control-group--revealed">
                      <legend>Karat</legend>
                      <div className="segmented-control segmented-control--three">
                        {KARATS.map((karat) => (
                          <button
                            key={karat.id}
                            className={shown.karat === karat.id ? 'segment segment--selected' : 'segment'}
                            type="button"
                            disabled={pickingNothing}
                            onClick={() => applyDesign({ karat: karat.id })}
                          >
                            {karat.label}
                            <small>{priceHint.metal(shown.metal, karat.id)}</small>
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  )}
                </>
              )}

              {step === 'style' && (
                <>
                  {scopeBar}
                  <fieldset className="control-group">
                    <legend>Type</legend>
                    <div className="option-grid option-grid--three">
                      {GRILLZ_TYPES.map((type) => (
                        <OptionCard
                          key={type.id}
                          label={type.label}
                          hint={priceHint.type(type.id)}
                          image={type.image}
                          selected={shown.type === type.id}
                          disabled={pickingNothing}
                          onSelect={() => applyDesign({ type: type.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="control-group">
                    <legend>Finish</legend>
                    <div className="option-grid option-grid--three">
                      {STYLES.map((style) => (
                        <OptionCard
                          key={style.id}
                          label={style.label}
                          detail={style.detail}
                          hint={priceHint.style(style.id)}
                          image={style.image}
                          selected={shown.style === style.id}
                          disabled={pickingNothing}
                          onSelect={() => applyDesign({ style: style.id })}
                        />
                      ))}
                    </div>
                    {shown.style !== 'solid' && <small className="field-hint">Finish details show in your AI photo.</small>}
                  </fieldset>
                </>
              )}

              {step === 'stones' && (
                <>
                  {scopeBar}
                  <fieldset className="control-group">
                    <legend>Setting</legend>
                    <div className="option-grid option-grid--three">
                      {SETTINGS.map((setting) => (
                        <OptionCard
                          key={setting.id}
                          label={setting.label}
                          detail={setting.detail}
                          hint={priceHint.setting(setting.id)}
                          image={setting.image}
                          selected={shown.setting === setting.id}
                          disabled={pickingNothing}
                          onSelect={() => applyDesign({ setting: setting.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="control-group">
                    <legend>Stones</legend>
                    <div className="option-grid option-grid--three">
                      {STONES.map((stone) => (
                        <OptionCard
                          key={stone.id}
                          label={stone.label}
                          detail={stone.detail}
                          hint={priceHint.stone(stone.id)}
                          image={stone.image}
                          selected={shown.stone === stone.id}
                          disabled={pickingNothing}
                          onSelect={() => applyDesign({ stone: stone.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  {pickMode && activePicked.length > 0 && designFor(activePicked[0]).type !== 'iced' && (
                    <div className="inline-note">These teeth aren&apos;t iced. Set them to Iced out in Style first.</div>
                  )}
                </>
              )}

              {step === 'extras' && (
                <>
                  <fieldset className="control-group">
                    <legend>Fangs</legend>
                    <div className="option-grid option-grid--two">
                      {FANG_OPTIONS.map((option) => (
                        <OptionCard
                          key={option.id}
                          label={option.label}
                          detail={option.detail}
                          hint={option.id === 'yes' ? '+$150' : 'Included'}
                          image={option.image}
                          selected={setOptions.fangs === (option.id === 'yes')}
                          onSelect={() => updateSet({ fangs: option.id === 'yes' })}
                        />
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="control-group">
                    <legend>Fit</legend>
                    <div className="option-grid option-grid--two">
                      {CUTS.map((cut) => (
                        <OptionCard
                          key={cut.id}
                          label={cut.label}
                          detail={cut.detail}
                          hint={cut.id === 'permanent' ? '+$100' : 'Included'}
                          image={cut.image}
                          selected={setOptions.cut === cut.id}
                          onSelect={() => updateSet({ cut: cut.id })}
                        />
                      ))}
                    </div>
                  </fieldset>
                </>
              )}

              {step === 'vision' && (
                <fieldset className="control-group">
                  <legend>Your idea <em className="legend-optional">Optional</em></legend>
                  <textarea
                    className="vision-input"
                    value={setOptions.vision}
                    onChange={(event) => updateSet({ vision: event.target.value.slice(0, VISION_MAX) })}
                    placeholder={teethDesigns.some((tooth) => tooth.type === 'photo')
                      ? "Describe the photo placement, e.g. my daughter's portrait across the front two"
                      : 'Initials, a skyline, a pattern, a vibe…'}
                    rows={4}
                    maxLength={VISION_MAX}
                  />
                  <small className="field-hint">{setOptions.vision.length}/{VISION_MAX}</small>
                  {inspiration ? (
                    <div className="inspiration-preview">
                      <img src={inspiration} alt="Your reference upload" />
                      <span>{teethDesigns.some((tooth) => tooth.type === 'photo') ? 'Photo for your grillz' : 'Inspiration image'}</span>
                      <button type="button" onClick={() => setInspiration(null)} aria-label="Remove image"><X size={15} /></button>
                    </div>
                  ) : (
                    <label className="upload-button">
                      <ImagePlus size={16} />
                      {teethDesigns.some((tooth) => tooth.type === 'photo') ? 'Upload the photo for your grillz' : 'Upload inspiration (photo or screenshot)'}
                      <input type="file" accept="image/*" onChange={handleInspiration} />
                    </label>
                  )}
                  {inspirationError && <div className="inline-note" role="alert">{inspirationError}</div>}
                </fieldset>
              )}

              {step === 'photo' && (
                <>
                  <div className="review-hero">
                    <div>
                      <strong>Custom {selectedTeeth.length}-tooth set</strong>
                      <span>{designLines.join(' · ')}</span>
                    </div>
                  </div>

                  <dl className="review-list">
                    {pricing.lines.map((line) => (
                      <div key={line.label}><dt>{line.label}</dt><dd>{formatPrice(line.amount)}</dd></div>
                    ))}
                  </dl>
                  <div className="total-row"><span>Estimated total</span><strong>{formatPrice(totalCost)}</strong></div>

                  <LeadCapture
                    rendersLeft={render.rendersLeft}
                    renderStatus={render.status}
                    renderImage={render.image}
                    lead={lead}
                    designLines={designLines}
                    total={formatPrice(totalCost)}
                    onIntent={handleRenderIntent}
                    onSubmit={handleLeadSubmit}
                    onShowPhoto={() => setShowPhoto(true)}
                  />

                  {lead && render.status === 'idle' && (
                    <button className="secondary-button" type="button" onClick={regenerate} disabled={render.rendersLeft === 0}>
                      Get a photo of this version
                    </button>
                  )}

                  {lead && !depositReached && (
                    <>
                      <fieldset className="control-group">
                        <legend>How we get your fit</legend>
                        <div className="choice-list">
                          {MOLDS.map((option) => {
                            const Icon = MOLD_ICONS[option.id];
                            return (
                            <button
                              key={option.id}
                              className={mold === option.id ? 'choice-row choice-row--selected' : 'choice-row'}
                              type="button"
                              onClick={() => setMold(option.id)}
                            >
                              <Icon size={17} />
                              <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                              <span className="radio-indicator">{mold === option.id && <span />}</span>
                            </button>
                            );
                          })}
                        </div>
                      </fieldset>
                      <button className="primary-button" type="button" onClick={reserveDeposit}>
                        <CreditCard size={17} />
                        Reserve with deposit
                        <span>{formatPrice(depositFor(totalCost))}</span>
                      </button>
                    </>
                  )}

                  {depositReached && (
                    <div className="deposit-note" role="status">
                      <Check size={18} />
                      <p>
                        Demo: on a live store this opens the jeweler&apos;s own checkout (Stripe or Shopify) for the{' '}
                        {formatPrice(depositFor(totalCost))} deposit, with the design, photo and fit choice attached to the order.
                      </p>
                    </div>
                  )}

                  <p className="fine-print">Sample pricing shown. A jeweler sets their own prices, options and deposit.</p>
                </>
              )}
            </div>
          </div>

          <footer className="panel-footer">
            <div className="panel-footer__total">
              <small>Total</small>
              <strong>{formatPrice(totalCost)}</strong>
            </div>
            {prevStep && (
              <button className="icon-button" type="button" onClick={() => goTo(prevStep)} aria-label={`Back to ${STEP_LABELS[prevStep]}`}>
                <ChevronLeft size={18} />
              </button>
            )}
            {nextStep && (
              <button className="primary-button panel-footer__next" type="button" onClick={() => goTo(nextStep)} disabled={!selectedTeeth.length}>
                Next: {STEP_LABELS[nextStep]}
                <ChevronRight size={17} />
              </button>
            )}
          </footer>
        </aside>
      </div>
    </main>
  );
}

export default Configurator;
