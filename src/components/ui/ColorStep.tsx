import React from 'react';
import { ColorStepProps } from '../../lib/types';
import { materialConfigs } from '../../lib/constants';

const ColorStep: React.FC<ColorStepProps> = ({
  selectedMaterial,
  selectedColor,
  onChange,
  goToStep, //eslint-disable-line @typescript-eslint/no-unused-vars
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
            className={`flex flex-col items-center space-y-2 p-4 rounded ${
              selectedColor === color ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => onChange(color)}
          >
            <div
              className="w-12 h-12 rounded-full"
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
