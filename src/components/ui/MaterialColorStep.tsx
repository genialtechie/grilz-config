// src/components/ui/MaterialColorStep.tsx
import React from 'react';
import { Material, ToothCustomization } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

interface MaterialColorStepProps {
  selectedMaterial: Material;
  selectedColor: string;
  onMaterialChange: (material: Material) => void;
  onColorChange: (color: string) => void;
  updateSelectedTeethCustomization: (update: Partial<ToothCustomization>) => void;
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
  const variants = materialConfigs[selectedMaterial].variants;

  const handleMaterialSelect = (material: Material) => {
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
        <span className="text-sm font-medium text-gray-600">Select Material</span>
        <div className="flex gap-4">
          {materials.map((material) => (
            <button
              key={material}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                selectedMaterial === material
                  ? 'ring-2 ring-blue-500 scale-105 border-blue-500' // Keep ring for selected material
                  : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => handleMaterialSelect(material)}
              aria-label={`Select ${material}`}
            >
              <div
                className="w-full h-full rounded-full border border-gray-300 shadow-inner"
                style={{
                  background: material.toLowerCase() === 'gold'
                    ? 'linear-gradient(135deg, #FFD700 0%, #FFFACD 100%)'
                    : 'linear-gradient(135deg, #C0C0C0 0%, #F8F8FF 100%)',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Color Variant Selection */}
      <div className="flex flex-col items-center gap-2 w-full">
        <span className="text-sm font-medium text-gray-600">Select Color / Finish</span>
        <div className="flex gap-4 w-full justify-center flex-wrap">
          {variants.map(({ name, color }) => (
            <button
              key={name}
              title={name} // Tooltip for color name
              className={`w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-150 border border-gray-300 ${
                selectedColor === color
                  ? 'ring-2 ring-blue-500 scale-105'
                  : 'hover:scale-105' // Simpler hover
              }`}
              style={{ background: color }}
              onClick={() => handleColorSelect(color)}
              aria-label={`Select color ${name}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MaterialColorStep;
