// The hand-off points between the four build tracks (Nov 17). Change a type here only together with
// every track that uses it, and note it in docs/redesign/build/LOG.md.
import type { RenderSpec } from '../../lib/renderSpec';

/** What the builder hands to the screens after Done. */
export type CreatorDesign = {
  /** The full design, as POST /api/leads takes it. */
  spec: RenderSpec;
  /** One line for people: "6 × 6 · 14K yellow gold · iced canines". */
  summary: string;
  /** Estimate in dollars, from lib/pricing (the server recomputes it). */
  total: number;
  /** Deposit in dollars if the shop takes one, else null. */
  deposit: number | null;
  /** A still of the 3D (data URL) for the lead and the studio photo. */
  preview: string;
  /** Their own words and picture when the AI built it, sent to the shop as "their idea". */
  idea?: { words?: string; picture?: string };
};

/** Props of the after-Done flow (Your grill → phone + code → Sent). Owned by the after track. */
export type AfterFlowProps = {
  design: CreatorDesign;
  /** Back to the builder with the design kept. */
  onKeepEditing: () => void;
  /** Start a new build from the start page. */
  onStartOver: () => void;
};
