import './index.css';
import Scene from './components/three/Scene';
import { useGrillzCustomization } from './lib/hooks/useGrillzCustomization';
import CustomizationStepper from './components/ui/CustomizationStepper';

function App() {
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
    <div className="h-screen bg-gray-100 px-4 py-4 md:py-8 md:px-6 lg:px-8 flex items-center">
      <div className="max-w-7xl w-full mx-auto flex flex-col items-center gap-2 md:gap-6">
        <div className="w-full max-w-xl h-[50vh] md:h-[60vh]">
          <Scene
            customizations={customizations}
            selectedTeeth={selectedTeeth}
            isSelectionMode={isSelectionMode}
            toggleToothSelection={toggleToothSelection}
          />
        </div>

        <div className="w-full max-w-xl h-[40vh] md:h-[30vh] flex flex-col">
          <CustomizationStepper
            selectedTeeth={selectedTeeth}
            selectAllTeeth={selectAllTeeth}
            setIsSelectionMode={setIsSelectionMode}
            customizations={customizations}
            updateSelectedTeethCustomization={updateSelectedTeethCustomization}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
