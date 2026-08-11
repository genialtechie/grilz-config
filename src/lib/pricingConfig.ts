export const pricingConfig = {
  baseCost: 200,
  materials: {
    gold: { costPerTooth: 150 },
    silver: { costPerTooth: 115 },
  },
  diamonds: {
    moissanite: { costPerTooth: 75 },
    lab: { costPerTooth: 160 },
  },
  cuts: {
    deep: 0,
    permanent: 100,
  },
} as const;
