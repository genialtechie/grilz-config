import React from 'react';
import { ColorStepProps } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

const ColorStep: React.FC<ColorStepProps> = ({
  selectedMaterial,
  selectedColor,
  onChange,
  goToStep,
}) => {
  const variants = materialConfigs[selectedMaterial].variants;

  return (
    <div className="space-y-4 flex flex-col items-center">
      <h3 className="text-lg font-semibold text-center">
        Select {selectedMaterial} variant
      </h3>
      <div className="flex justify-center space-x-4">
        {variants.map(({ name, color }) => (
          <button
            key={name}
            className={`px-6 py-4 rounded-lg flex flex-col items-center ${
              selectedColor === color
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
            onClick={() => {
              onChange(color);
              goToStep(4);
            }}
          >
            <div
              className="w-12 h-12 rounded-full mb-2"
              style={{ backgroundColor: color }}
            />
            <span>{name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorStep;
