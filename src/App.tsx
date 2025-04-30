import './index.css';
import Scene from './components/three/Scene';
import { useGrillzCustomization } from './lib/hooks/useGrillzCustomization';
import CustomizationStepper from './components/ui/CustomizationStepper';
import { useState } from 'react';

function App() {
  const [panelOpen, setPanelOpen] = useState(true);
  const {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
  } = useGrillzCustomization();

  return (
    <div className="relative h-screen overflow-hidden bg-gray-100">
      {/* 3D Canvas Area */}
      <div className={`w-full flex items-center justify-center p-4 box-border transition-all duration-300 ease-in-out ${panelOpen ? 'h-[calc(100vh_-_50vh_-_1.5rem)]' : 'h-full'}`}>
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
            className={`transition-all duration-300 ease-in-out overflow-hidden ${panelOpen ? 'max-h-[50vh]' : 'max-h-0'}`}
          >
            <CustomizationStepper
              selectedTeeth={selectedTeeth}
              selectAllTeeth={selectAllTeeth}
              setIsSelectionMode={setIsSelectionMode}
              customizations={customizations}
              updateSelectedTeethCustomization={updateSelectedTeethCustomization}
            />
          </div>
          {/* Toggle Handle Bar */}
          <button
            className={`w-full py-2 text-center cursor-pointer bg-white transition-all duration-300 ease-in-out ${panelOpen ? 'border-t border-gray-200 rounded-b-2xl' : 'rounded-lg shadow-lg'}`}
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <span className="inline-block w-8 h-1 bg-gray-400 rounded-full"></span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
