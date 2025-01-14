import React from 'react';
import { ColorPickerProps } from '../../lib/types';

const colors = ['#FFD700', '#C0C0C0', '#E5E4E2']; // Gold, Silver, Platinum

const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onChange,
}) => {
  return (
    <div className="flex space-x-2">
      {colors.map((color) => (
        <button
          key={color}
          style={{ backgroundColor: color }}
          className={`w-8 h-8 rounded-full ${
            selectedColor === color ? 'ring-2 ring-black' : ''
          }`}
          onClick={() => {
            console.log('Color clicked:', color);
            onChange(color);
          }}
        />
      ))}
    </div>
  );
};

export default ColorPicker;
