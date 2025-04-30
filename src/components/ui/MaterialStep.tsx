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

  return (
    <div className="flex flex-col items-center justify-center gap-8 w-full">

      <div className="flex gap-6 w-full justify-center">
        {materials.map((material) => (
          <button
            key={material}
            className={`w-16 h-16 rounded-full flex items-center justify-center text-base font-semibold shadow transition-all duration-150 border-2 focus:outline-none focus:ring-2 focus:ring-blue-400 ${
              selectedMaterial === material
                ? 'bg-blue-500 text-white border-blue-500 scale-105'
                : 'bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100'
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
            <div
              className="w-16 h-16 rounded-full border border-gray-300 shadow-inner"
              style={{
                background: material.toLowerCase().includes('gold')
                  ? 'linear-gradient(135deg, #FFD700 0%, #FFFACD 100%)'
                  : material.toLowerCase().includes('silver')
                  ? 'linear-gradient(135deg, #C0C0C0 0%, #F8F8FF 100%)'
                  : materialConfigs[material as keyof typeof materialConfigs]?.variants?.[0]?.color || '#eee',
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export default MaterialStep;
