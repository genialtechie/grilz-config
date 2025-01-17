import React from 'react';
import { Material, MaterialStepProps } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

const MaterialStep: React.FC<MaterialStepProps> = ({
  selectedMaterial,
  onChange,
  updateSelectedTeethCustomization,
  goToStep,
}) => {
  const materials = ['gold', 'silver'];

  const materialEmojis = {
    gold: '🌟',
    silver: '✨',
  };

  return (
    <div className="space-y-2 md:space-y-4 flex flex-col items-center p-2 md:p-4">
      <h3 className="text-base sm:text-lg font-semibold text-center">
        Choose your material
      </h3>
      <div className="flex justify-center gap-2 md:gap-4">
        {materials.map((material) => (
          <button
            key={material}
            className={`px-3 py-2 md:px-6 md:py-4 rounded-lg flex flex-col items-center ${
              selectedMaterial === material
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            onClick={() => {
              const materialType = material as Material;
              onChange(materialType);
              updateSelectedTeethCustomization({
                material: materialType,
                color: materialConfigs[materialType].defaultColor,
              });
              goToStep(3);
            }}
          >
            <span className="text-base md:text-xl mb-1">
              {materialEmojis[material as keyof typeof materialEmojis]}
            </span>
            <span className="text-sm md:text-base capitalize">{material}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MaterialStep;
