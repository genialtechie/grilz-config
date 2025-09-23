// src/components/ui/MaterialColorStep.tsx
import React from 'react';
import { Material, ToothCustomization } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

interface MaterialColorStepProps {
  selectedMaterial: Material | null;
  selectedColor: string | null;
  onMaterialChange: (material: Material) => void;
  onColorChange: (color: string) => void;
  updateSelectedTeethCustomization: (
    update: Partial<ToothCustomization>
  ) => void;
  goToStep: (step: number) => void;
}

const MaterialColorStep: React.FC<MaterialColorStepProps> = ({
  selectedMaterial,
  selectedColor,
  onMaterialChange,
  onColorChange,
  updateSelectedTeethCustomization,
  goToStep,
}) => {
  const materials: Material[] = ['gold', 'silver'];
  const variants = selectedMaterial && selectedMaterial !== 'default'
    ? materialConfigs[selectedMaterial].variants
    : [];

  const handleMaterialSelect = (material: Material) => {
    if (material === 'default') return;
    const defaultColor = materialConfigs[material].defaultColor;
    onMaterialChange(material);
    onColorChange(defaultColor);
    updateSelectedTeethCustomization({
      material: material,
      color: defaultColor,
    });
    // Don't automatically go to next step here
  };

  const handleColorSelect = (color: string) => {
    onColorChange(color);
    updateSelectedTeethCustomization({ color });
    goToStep(3); // Go to Diamonds step (which will be step 3)
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {/* Material Selection */}
      <div className="flex flex-col items-center gap-2 w-full">
        <span className="text-sm font-medium text-gray-600">
          Select Material
        </span>
        <div className="flex gap-4">
          {materials.map((material) => (
            <button
              key={material}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-black ${
                selectedMaterial === material
                  ? 'bg-white text-black border-black scale-105 focus:ring-black'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 focus:ring-gray-400'
              }`}
              onClick={() => handleMaterialSelect(material)}
              aria-label={`Select ${material}`}
            >
              <div
                className="w-full h-full rounded-full border border-gray-300 shadow-inner"
                style={{
                  background:
                    material.toLowerCase() === 'gold'
                      ? 'linear-gradient(135deg, #FFD700 0%, #FFFACD 100%)'
                      : 'linear-gradient(135deg, #C0C0C0 0%, #F8F8FF 100%)',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Color Variant Selection */}
      {selectedMaterial && (
        <div className="flex flex-col items-center gap-2 w-full">
          <span className="text-sm font-medium text-gray-600">
            Select Color / Finish
          </span>
          <div className="flex gap-4 w-full justify-center flex-wrap">
            {variants.map(
              ({ name, color }: { name: string; color: string }) => (
                <button
                  key={name}
                  title={name} // Tooltip for color name
                  className={`w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black transition-all duration-150 border border-gray-300 ${
                    selectedColor === color
                      ? 'border-blue-500 scale-110 ring-2 ring-black ring-offset-1'
                      : 'border-gray-300 hover:scale-105 focus:ring-gray-400'
                  }`}
                  style={{ background: color }}
                  onClick={() => handleColorSelect(color)}
                  aria-label={`Select color ${name}`}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MaterialColorStep;
