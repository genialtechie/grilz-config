import React from 'react';
import { DiamondStepProps } from '../../lib/types';

const DiamondStep: React.FC<DiamondStepProps> = ({
  hasDiamonds,
  onChange,
}) => {
  const toggleDiamonds = () => {
    onChange(!hasDiamonds);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full">
      {/* Add/Remove Diamonds Button - Styled like SelectionStep */}
      <button
        className={`flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-150 border-2 shadow focus:outline-none focus:ring-2 focus:ring-black ${
          hasDiamonds
            ? 'bg-white text-black border-black hover:bg-gray-100'
            : 'bg-black text-white border-black hover:bg-gray-800'
        }`}
        onClick={toggleDiamonds}
      >
        <span className="text-center leading-tight">
          {hasDiamonds ? 'Remove Diamonds' : 'Add Diamonds'}
        </span>
      </button>
      {/* Removed Back button and its container div */}
    </div>
  );
};

export default DiamondStep;
