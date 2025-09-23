import '../index.css';
import Scene from './three/Scene';
import { useGrillzCustomization } from '../lib/hooks/useGrillzCustomization';
import CustomizationStepper from './ui/CustomizationStepper';
import { useState, useMemo } from 'react';
import { pricingConfig } from '../lib/pricingConfig';
import SummaryPage from './ui/SummaryPage';
import ARView from './ui/ARView';
import { Link } from 'react-router-dom';

function Configurator() {
  const [panelOpen, setPanelOpen] = useState(true);
  const [showSummary, setShowSummary] = useState(false);
  const [showAR, setShowAR] = useState(false);
  const {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
    resetCustomizationForSelection,
    clearAllTeeth,
  } = useGrillzCustomization();

  // Calculate total price based on customizations
  const totalCost = useMemo(() => {
    let cost = pricingConfig.baseCost;
    customizations.forEach(({ material, hasDiamonds }) => {
      if (material !== 'default') {
        cost += pricingConfig.materials[material].costPerTooth;
      }
      if (hasDiamonds) {
        cost += pricingConfig.diamonds.costPerTooth;
      }
    });
    return cost;
  }, [customizations]);

  // Show AR view
  if (showAR) {
    return (
      <ARView
        onBack={() => {
          setShowAR(false);
          setShowSummary(true);
        }}
        customizations={customizations}
      />
    );
  }

  // Show summary page when done
  if (showSummary) {
    return (
      <SummaryPage
        totalCost={totalCost}
        customizations={customizations}
        onBack={() => {
          setShowSummary(false);
          setIsSelectionMode(true);
          setPanelOpen(true);
        }}
        onAR={() => {
          setShowSummary(false);
          setShowAR(true);
        }}
      />
    );
  }

  return (
    <div className="relative h-screen overflow-hidden bg-gray-100">
      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow-md hover:bg-gray-200 transition-colors"
        aria-label="Back to homepage"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-800"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Link>
      {/* 3D Canvas Area */}
      <div
        className={`w-full flex items-center justify-center p-4 box-border transition-all duration-300 ease-in-out ${
          panelOpen ? 'h-[calc(100vh_-_50vh_-_1.5rem)]' : 'h-full'
        }`}
      >
        <Scene
          customizations={customizations}
          selectedTeeth={selectedTeeth}
          isSelectionMode={isSelectionMode}
          toggleToothSelection={toggleToothSelection}
        />
      </div>
      {/* Panel Container (fixed bottom-center) */}
      <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full z-40 flex justify-center">
        <div className="w-full max-w-[380px]">
          {/* Panel Content (collapses) */}
          <div
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              panelOpen ? 'max-h-[50vh]' : 'max-h-0'
            }`}
          >
            <CustomizationStepper
              selectedTeeth={selectedTeeth}
              selectAllTeeth={selectAllTeeth}
              setIsSelectionMode={setIsSelectionMode}
              customizations={customizations}
              updateSelectedTeethCustomization={
                updateSelectedTeethCustomization
              }
              resetCustomizationForSelection={resetCustomizationForSelection}
              clearAllTeeth={clearAllTeeth}
            />
          </div>
          {/* Toggle Handle Bar */}
          <div className="relative w-full">
            <button
              className={`w-full py-2 text-center cursor-pointer bg-white transition-all duration-300 ease-in-out ${
                panelOpen
                  ? 'border-t border-gray-200 rounded-b-2xl'
                  : 'rounded-lg shadow-lg'
              }`}
              onClick={() => setPanelOpen(!panelOpen)}
              aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}
            >
              <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-sm font-semibold">
                ${totalCost}
              </span>
              <span className="inline-block w-8 h-1 bg-gray-400 rounded-full"></span>
            </button>
            <button
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-sm font-semibold"
              onClick={() => setShowSummary(true)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Configurator;
