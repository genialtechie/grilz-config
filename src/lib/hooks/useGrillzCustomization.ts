import { useState } from 'react';
import { ToothCustomization } from '../types';

// Default state for a single tooth when reset
export const baseToothState: ToothCustomization = {
  material: 'default', // Use 'default' as the base material state
  color: '#FFFFFF', // Default color (won't be used if material is 'default')
  hasDiamonds: false,
};

// Initialize default customization state for all 32 teeth
const defaultCustomization: ToothCustomization[] = Array(32).fill(null).map(() => ({ ...baseToothState }));

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
    setSelectedTeeth([...Array(32)].map((_, i) => i));
  };

  // Function to clear the tooth selection
  const clearAllTeeth = () => {
    setSelectedTeeth([]);
  };

  const updateSelectedTeethCustomization = (
    customization: Partial<ToothCustomization>
  ) => {
    console.log('Updating customization:', customization);
    console.log('For teeth:', selectedTeeth);
    setCustomizations((prev) =>
      prev.map((tooth, index) =>
        selectedTeeth.includes(index) ? { ...tooth, ...customization } : tooth
      )
    );
  };

  // Function to reset the customization for selected teeth
  const resetCustomizationForSelection = () => {
    // Use Partial<ToothCustomization> to allow setting just the needed fields for reset
    const resetState: Partial<ToothCustomization> = { 
      material: 'default',
      color: baseToothState.color, // Include color for consistency, though it might not be used
      hasDiamonds: false 
    };
    updateSelectedTeethCustomization(resetState);
    console.log('Resetting customization for teeth:', selectedTeeth);
  };

  return {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectAllTeeth,
    clearAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
    resetCustomizationForSelection,
  };
};
