import { useState } from 'react';
import { ToothCustomization } from '../types';

const defaultCustomization: ToothCustomization[] = Array(14).fill({
  material: 'gold',
  color: '#FFD700',
});

export const useGrillzCustomization = () => {
  const [customizations, setCustomizations] =
    useState<ToothCustomization[]>(defaultCustomization);
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(true);

  const toggleToothSelection = (index: number) => {
    setSelectedTeeth((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const selectAllTeeth = () => {
    setSelectedTeeth([...Array(14)].map((_, i) => i));
  };

  const updateSelectedTeethCustomization = (
    customization: Partial<ToothCustomization>
  ) => {
    setCustomizations((prev) =>
      prev.map((tooth, index) =>
        selectedTeeth.includes(index) ? { ...tooth, ...customization } : tooth
      )
    );
  };

  return {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
  };
};
