import './index.css';
import Scene from './components/three/Scene';
import ColorPicker from './components/ui/ColorPicker';
import MaterialSelector from './components/ui/MaterialSelector';
import { useGrillzCustomization } from './lib/hooks/useGrillzCustomization';
import { Material } from './lib/types';

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

      {isSelectionMode ? (
        <div className="flex flex-col items-center space-y-4">
          <p className="text-lg">
            Select teeth to customize by clicking on them
          </p>
          <div className="flex space-x-4">
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={selectAllTeeth}
            >
              Select All Teeth
            </button>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded"
              onClick={() => setIsSelectionMode(false)}
              disabled={selectedTeeth.length === 0}
            >
              Customize Selected ({selectedTeeth.length})
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <h3>Customizing {selectedTeeth.length} teeth</h3>
          <ColorPicker
            selectedColor={customizations[selectedTeeth[0]]?.color}
            onChange={(color) => {
              console.log('Updating color:', color);
              updateSelectedTeethCustomization({ color });
            }}
          />
          <MaterialSelector
            selectedMaterial={customizations[selectedTeeth[0]]?.material}
            onChange={(material) => {
              console.log('Updating material:', material);
              updateSelectedTeethCustomization({
                material: material as Material,
              });
            }}
          />
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded"
            onClick={() => setIsSelectionMode(true)}
          >
            Back to Selection
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
