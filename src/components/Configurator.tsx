import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Gem,
  MousePointer2,
  Move3d,
  RotateCcw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import Scene from './three/Scene';
import { useGrillzCustomization } from '../lib/hooks/useGrillzCustomization';
import { pricingConfig } from '../lib/pricingConfig';
import type { CutStyle, DiamondType, Material } from '../lib/types';

type BuilderStep = 'select' | 'design' | 'review' | 'added';

type FinishOption = {
  id: string;
  label: string;
  detail: string;
  material: Exclude<Material, 'default'>;
  color: string;
};

const FINISHES: FinishOption[] = [
  { id: 'yellow-gold', label: 'Yellow gold', detail: '10K', material: 'gold', color: '#d9ad45' },
  { id: 'rose-gold', label: 'Rose gold', detail: '10K', material: 'gold', color: '#c28b83' },
  { id: 'white-gold', label: 'White gold', detail: '10K', material: 'gold', color: '#e4e2da' },
  { id: 'platinum', label: 'Platinum', detail: 'Bright finish', material: 'silver', color: '#bec5c9' },
];

const PRESETS = [6, 8, 10, 12] as const;

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const formatPrice = (value: number) => currencyFormatter.format(value);

function Configurator() {
  const [step, setStep] = useState<BuilderStep>('select');
  const [panelOpen, setPanelOpen] = useState(true);
  const [cutStyle, setCutStyle] = useState<CutStyle>('deep');
  const {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectPreset,
    selectAllTeeth,
    clearAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
    resetCustomizationForSelection,
    resetAll,
  } = useGrillzCustomization();

  const firstSelected = selectedTeeth[0];
  const currentCustomization =
    firstSelected === undefined ? undefined : customizations[firstSelected];
  const selectedFinish = FINISHES.find(
    (finish) =>
      finish.material === currentCustomization?.material &&
      finish.color === currentCustomization.color,
  );
  const configuredCount = selectedTeeth.filter(
    (index) => customizations[index].material !== 'default',
  ).length;
  const isComplete =
    selectedTeeth.length > 0 && configuredCount === selectedTeeth.length;

  const totalCost = useMemo(() => {
    const customizationCost = customizations.reduce((total, customization) => {
      if (customization.material === 'default') return total;
      const materialCost = pricingConfig.materials[customization.material].costPerTooth;
      const diamondCost = customization.hasDiamonds
        ? pricingConfig.diamonds[customization.diamondType ?? 'moissanite'].costPerTooth
        : 0;
      return total + materialCost + diamondCost;
    }, 0);

    return pricingConfig.baseCost + customizationCost + pricingConfig.cuts[cutStyle];
  }, [customizations, cutStyle]);

  const goToSelection = () => {
    setStep('select');
    setIsSelectionMode(true);
    setPanelOpen(true);
  };

  const goToDesign = () => {
    if (selectedTeeth.length === 0) return;
    setStep('design');
    setIsSelectionMode(false);
    setPanelOpen(true);
  };

  const handleFinish = (finish: FinishOption) => {
    updateSelectedTeethCustomization({
      material: finish.material,
      color: finish.color,
      variant: finish.label,
    });
  };

  const handleStyle = (hasDiamonds: boolean) => {
    updateSelectedTeethCustomization({
      hasDiamonds,
      diamondType: hasDiamonds
        ? currentCustomization?.diamondType ?? 'moissanite'
        : undefined,
    });
  };

  const handleDiamond = (diamondType: DiamondType) => {
    updateSelectedTeethCustomization({ hasDiamonds: true, diamondType });
  };

  const handleReset = () => {
    resetAll();
    setStep('select');
    setCutStyle('deep');
    setPanelOpen(true);
  };

  const stepNumber = step === 'select' ? 1 : step === 'design' ? 2 : 3;

  return (
    <main className="configurator-shell">
      <header className="builder-header">
        <Link className="brand-lockup" to="/" aria-label="Back to MagPollo demo store">
          <span className="brand-mark">M</span>
          <span className="brand-copy">
            <strong>MAGPOLLO</strong>
            <small>Demo store</small>
          </span>
        </Link>
        <div className="header-actions">
          <button className="icon-button" type="button" onClick={handleReset} aria-label="Start over" title="Start over">
            <RotateCcw size={18} strokeWidth={1.8} />
          </button>
          <div className="header-total">
            <small>Estimated total</small>
            <strong>{formatPrice(totalCost)}</strong>
          </div>
          <button className="cart-button" type="button" onClick={() => isComplete && setStep('review')} disabled={!isComplete}>
            <ShoppingBag size={17} />
            <span>Review</span>
          </button>
        </div>
      </header>

      <div className="builder-workspace">
        <section className="visualizer" aria-label="Interactive 3D grillz preview">
          <Scene
            customizations={customizations}
            selectedTeeth={selectedTeeth}
            isSelectionMode={isSelectionMode}
            toggleToothSelection={toggleToothSelection}
          />

          <div className="viewer-status">
            <span className="status-dot" />
            <span>{selectedTeeth.length} teeth selected</span>
          </div>

          <div className="viewer-instructions" aria-hidden="true">
            {isSelectionMode ? <MousePointer2 size={16} /> : <Move3d size={16} />}
            <span>{isSelectionMode ? 'Click a tooth to select it' : 'Drag to rotate · Scroll to zoom'}</span>
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
          <div className="panel-scroll">
            <div className="progress-row" aria-label={`Step ${stepNumber} of 3`}>
              {[1, 2, 3].map((number) => (
                <span key={number} className={number <= stepNumber ? 'progress-bar progress-bar--active' : 'progress-bar'} />
              ))}
            </div>

            {step === 'select' && (
              <div className="panel-view">
                <div className="panel-heading">
                  <span className="eyebrow">Step 1 of 3</span>
                  <h1>Choose your set</h1>
                  <p>Start with a popular layout, then click individual teeth in the 3D model to refine it.</p>
                </div>

                <fieldset className="control-group">
                  <legend>Quick select</legend>
                  <div className="preset-grid">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset}
                        className={selectedTeeth.length === preset * 2 ? 'option-button option-button--selected' : 'option-button'}
                        type="button"
                        onClick={() => selectPreset(preset)}
                      >
                        <strong>{preset} × {preset}</strong>
                        <small>{preset * 2} teeth</small>
                      </button>
                    ))}
                    <button
                      className={selectedTeeth.length === 32 ? 'option-button option-button--selected' : 'option-button'}
                      type="button"
                      onClick={selectAllTeeth}
                    >
                      <strong>Full set</strong>
                      <small>32 teeth</small>
                    </button>
                  </div>
                </fieldset>

                <div className="selection-summary">
                  <div>
                    <strong>{selectedTeeth.length || 'No'} teeth selected</strong>
                    <span>{selectedTeeth.length ? 'Upper and lower set' : 'Choose a preset or click the model'}</span>
                  </div>
                  <button type="button" onClick={clearAllTeeth} disabled={!selectedTeeth.length}>Clear</button>
                </div>

                <button className="primary-button" type="button" onClick={goToDesign} disabled={!selectedTeeth.length}>
                  Customize selected
                  <span>{selectedTeeth.length}</span>
                </button>
              </div>
            )}

            {step === 'design' && (
              <div className="panel-view">
                <button className="back-button" type="button" onClick={goToSelection}>
                  <ChevronLeft size={17} />
                  Change teeth
                </button>
                <div className="panel-heading panel-heading--compact">
                  <span className="eyebrow">Step 2 of 3</span>
                  <h1>Design your set</h1>
                  <p>Changes apply to all {selectedTeeth.length} selected teeth.</p>
                </div>

                <fieldset className="control-group">
                  <legend>Metal and finish</legend>
                  <div className="finish-grid">
                    {FINISHES.map((finish) => (
                      <button
                        key={finish.id}
                        className={selectedFinish?.id === finish.id ? 'finish-button finish-button--selected' : 'finish-button'}
                        type="button"
                        onClick={() => handleFinish(finish)}
                      >
                        <span className="finish-swatch" style={{ backgroundColor: finish.color }} />
                        <span>
                          <strong>{finish.label}</strong>
                          <small>{finish.detail}</small>
                        </span>
                        {selectedFinish?.id === finish.id && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="control-group">
                  <legend>Surface</legend>
                  <div className="segmented-control">
                    <button
                      className={!currentCustomization?.hasDiamonds ? 'segment segment--selected' : 'segment'}
                      type="button"
                      onClick={() => handleStyle(false)}
                    >
                      Plain
                    </button>
                    <button
                      className={currentCustomization?.hasDiamonds ? 'segment segment--selected' : 'segment'}
                      type="button"
                      onClick={() => handleStyle(true)}
                    >
                      <Sparkles size={15} /> Iced out
                    </button>
                  </div>
                </fieldset>

                {currentCustomization?.hasDiamonds && (
                  <fieldset className="control-group control-group--revealed">
                    <legend>Stone</legend>
                    <div className="choice-list">
                      {([
                        ['moissanite', 'Moissanite', '+$75 / tooth'],
                        ['lab', 'Lab-grown diamond', '+$160 / tooth'],
                      ] as const).map(([value, label, price]) => (
                        <button
                          key={value}
                          className={currentCustomization.diamondType === value ? 'choice-row choice-row--selected' : 'choice-row'}
                          type="button"
                          onClick={() => handleDiamond(value)}
                        >
                          <Gem size={17} />
                          <span><strong>{label}</strong><small>{price}</small></span>
                          <span className="radio-indicator">{currentCustomization.diamondType === value && <span />}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                <fieldset className="control-group">
                  <legend>Cut</legend>
                  <div className="segmented-control">
                    <button className={cutStyle === 'deep' ? 'segment segment--selected' : 'segment'} type="button" onClick={() => setCutStyle('deep')}>Deep cut</button>
                    <button className={cutStyle === 'permanent' ? 'segment segment--selected' : 'segment'} type="button" onClick={() => setCutStyle('permanent')}>Permanent +$100</button>
                  </div>
                </fieldset>

                {!isComplete && (
                  <div className="inline-note">Choose a metal and finish to continue.</div>
                )}

                <div className="panel-actions">
                  <button className="secondary-button" type="button" onClick={resetCustomizationForSelection}>Clear design</button>
                  <button className="primary-button" type="button" onClick={() => setStep('review')} disabled={!isComplete}>
                    Review design
                    <span>{formatPrice(totalCost)}</span>
                  </button>
                </div>
              </div>
            )}

            {step === 'review' && (
              <div className="panel-view">
                <button className="back-button" type="button" onClick={() => setStep('design')}>
                  <ChevronLeft size={17} />
                  Edit design
                </button>
                <div className="panel-heading panel-heading--compact">
                  <span className="eyebrow">Step 3 of 3</span>
                  <h1>Review your set</h1>
                  <p>Everything below updates from your selections.</p>
                </div>

                <div className="review-hero">
                  <div className="review-icon"><Gem size={23} /></div>
                  <div><strong>Custom {selectedTeeth.length}-tooth set</strong><span>Made to your configuration</span></div>
                </div>

                <dl className="review-list">
                  <div><dt>Finish</dt><dd>{selectedFinish?.label ?? 'Custom mix'}</dd></div>
                  <div><dt>Surface</dt><dd>{currentCustomization?.hasDiamonds ? 'Iced out' : 'Plain'}</dd></div>
                  {currentCustomization?.hasDiamonds && <div><dt>Stone</dt><dd>{currentCustomization.diamondType === 'lab' ? 'Lab-grown diamond' : 'Moissanite'}</dd></div>}
                  <div><dt>Cut</dt><dd>{cutStyle === 'deep' ? 'Deep cut' : 'Permanent cut'}</dd></div>
                  <div><dt>Service fee</dt><dd>{formatPrice(pricingConfig.baseCost)}</dd></div>
                </dl>

                <div className="total-row"><span>Estimated total</span><strong>{formatPrice(totalCost)}</strong></div>
                <p className="fine-print">Mock pricing for demonstration. A production build can connect live inventory, pricing, checkout, and order management.</p>

                <button className="primary-button primary-button--cart" type="button" onClick={() => setStep('added')}>
                  <ShoppingBag size={17} />
                  Add custom set
                  <span>{formatPrice(totalCost)}</span>
                </button>
              </div>
            )}

            {step === 'added' && (
              <div className="panel-view success-view">
                <div className="success-mark"><Check size={30} /></div>
                <span className="eyebrow">Added to mock cart</span>
                <h1>Your custom set is ready.</h1>
                <p>The complete configuration, product preview, and price would now travel with the order.</p>
                <div className="order-reference">
                  <span>Design reference</span>
                  <strong>MP-{selectedTeeth.length}482</strong>
                </div>
                <button className="primary-button" type="button" onClick={handleReset}>Build another set</button>
                <button className="text-button" type="button" onClick={() => setStep('review')}>Back to design summary</button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

export default Configurator;
