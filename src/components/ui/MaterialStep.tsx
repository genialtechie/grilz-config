import React from 'react';
import { Material, MaterialStepProps } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

const MaterialStep: React.FC<MaterialStepProps> = ({
  selectedMaterial,
  onChange,
  updateSelectedTeethCustomization,
  goToStep,
}) => {
  const materials = ['gold', 'silver', 'diamond'];

  return (
    <div className="flex justify-center space-x-2">
      {materials.map((material) => (
        <button
          key={material}
          className={`px-4 py-2 rounded-sm ${
            selectedMaterial === material ? 'bg-gray-300' : 'bg-gray-100'
          }`}
          onClick={() => {
            const materialType = material as Material;
            console.log('Updating material to:', materialType);
            onChange(materialType);
            updateSelectedTeethCustomization({
              material: materialType,
              color: materialConfigs[materialType].defaultColor,
            });
            goToStep(3);
          }}
        >
          {material}
        </button>
      ))}
    </div>
  );
};

export default MaterialStep;
