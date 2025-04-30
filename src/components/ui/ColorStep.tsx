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
    <div className="flex flex-col items-center justify-center gap-8 w-full">

      <div className="flex gap-6 w-full justify-center">
        {variants.map(({ name, color }) => (
          <button
            key={name}
            className={`w-16 h-16 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-150 ${
              selectedColor === color
                ? 'ring-2 ring-blue-500 scale-105'
                : 'hover:ring-2 hover:ring-blue-300'
            }`}
            style={{
              background: color,
            }}
            onClick={() => {
              onChange(color);
              goToStep(4);
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorStep;
