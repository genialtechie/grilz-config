import { useCallback, useState } from 'react';
import { ToothCustomization } from '../types';

export const baseToothState: ToothCustomization = {
  material: 'default',
  color: '#f5f5f2',
  hasDiamonds: false,
};

const makeDefaultCustomizations = () =>
  Array.from({ length: 32 }, () => ({ ...baseToothState }));

const centeredSet = (teethPerRow: number) => {
  const start = Math.floor((16 - teethPerRow) / 2);
  const top = Array.from({ length: teethPerRow }, (_, index) => start + index);
  const bottom = Array.from(
    { length: teethPerRow },
    (_, index) => 16 + start + index,
  );
  return [...top, ...bottom];
};

export const useGrillzCustomization = () => {
  const [customizations, setCustomizations] = useState<ToothCustomization[]>(
    makeDefaultCustomizations,
  );
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>(() => centeredSet(6));
  const [isSelectionMode, setIsSelectionMode] = useState(true);

  const toggleToothSelection = useCallback((index: number) => {
    setSelectedTeeth((previous) =>
      previous.includes(index)
        ? previous.filter((toothIndex) => toothIndex !== index)
        : [...previous, index].sort((a, b) => a - b),
    );
  }, []);

  const selectPreset = useCallback((teethPerRow: number) => {
    setSelectedTeeth(centeredSet(teethPerRow));
  }, []);

  const selectAllTeeth = useCallback(() => {
    setSelectedTeeth(Array.from({ length: 32 }, (_, index) => index));
  }, []);

  const clearAllTeeth = useCallback(() => setSelectedTeeth([]), []);

  const updateSelectedTeethCustomization = useCallback(
    (customization: Partial<ToothCustomization>) => {
      const selectedToothSet = new Set(selectedTeeth);
      setCustomizations((previous) =>
        previous.map((tooth, index) =>
          selectedToothSet.has(index) ? { ...tooth, ...customization } : tooth,
        ),
      );
    },
    [selectedTeeth],
  );

  const resetCustomizationForSelection = useCallback(() => {
    const selectedToothSet = new Set(selectedTeeth);
    setCustomizations((previous) =>
      previous.map((tooth, index) =>
        selectedToothSet.has(index) ? { ...baseToothState } : tooth,
      ),
    );
  }, [selectedTeeth]);

  const resetAll = useCallback(() => {
    setCustomizations(makeDefaultCustomizations());
    setSelectedTeeth(centeredSet(6));
    setIsSelectionMode(true);
  }, []);

  return {
    customizations,
    selectedTeeth,
    isSelectionMode,
    toggleToothSelection,
    selectPreset,
    selectAllTeeth,
    clearAllTeeth,
    updateSelectedTeethCustomization,
    setIsSelectionMode,
    resetCustomizationForSelection,
    resetAll,
  };
};
