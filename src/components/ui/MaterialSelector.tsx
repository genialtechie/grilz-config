import React from 'react';
import { MaterialSelectorProps } from '../../lib/types';

const materials = ['gold', 'silver', 'diamond'];

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  selectedMaterial,
  onChange,
}) => {
  return (
    <div className="flex space-x-2">
      {materials.map((material) => (
        <button
          key={material}
          className={`px-4 py-2 rounded-sm ${
            selectedMaterial === material ? 'bg-gray-300' : 'bg-gray-100'
          }`}
          onClick={() => {
            console.log('Material clicked:', material);
            onChange(material);
          }}
        >
          {material}
        </button>
      ))}
    </div>
  );
};

export default MaterialSelector;
