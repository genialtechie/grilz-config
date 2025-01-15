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
    <div className="App bg-gray-100 min-h-screen flex flex-col items-center justify-center space-y-4">
      <Scene
        customizations={customizations}
        selectedTeeth={selectedTeeth}
        isSelectionMode={isSelectionMode}
        toggleToothSelection={toggleToothSelection}
      />

      <CustomizationStepper
        selectedTeeth={selectedTeeth}
        selectAllTeeth={selectAllTeeth}
        setIsSelectionMode={setIsSelectionMode}
        customizations={customizations}
        updateSelectedTeethCustomization={updateSelectedTeethCustomization}
      />
    </div>
  );
}

export default App;
