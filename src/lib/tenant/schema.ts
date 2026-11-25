import { z } from 'zod';
import {
  ADD_ON_ID,
  CUTS,
  DIAMOND_GRADES,
  MAX_ADD_ONS,
  GRILLZ_TYPES,
  INSCRIPTION_STYLES,
  KARATS,
  METALS,
  MOLDS,
  PVD_COLORS,
  SETTINGS,
  STONES,
  STYLES,
  TOOTH_EXTRAS,
} from '../renderSpec.js';

// A tenant (jeweler) config: everything that differs between shops. The option
// catalog itself (ids, labels, images, AI prompt text) belongs to the platform in
// renderSpec.ts; a shop chooses which options it sells and what it charges.
// The same schema validates configs in the browser, the API and the dashboard.

const ids = <T extends readonly { id: string }[]>(list: T) => list.map((item) => item.id) as [T[number]['id'], ...T[number]['id'][]];

export const MetalIdSchema = z.enum(ids(METALS));
export const KaratIdSchema = z.enum(ids(KARATS));
export const GrillzTypeSchema = z.enum(ids(GRILLZ_TYPES));
export const StyleIdSchema = z.enum(ids(STYLES));
export const SettingIdSchema = z.enum(ids(SETTINGS));
export const StoneIdSchema = z.enum(ids(STONES));
export const GradeIdSchema = z.enum(ids(DIAMOND_GRADES));
export const ExtraIdSchema = z.enum(ids(TOOTH_EXTRAS));
export const PvdColorIdSchema = z.enum(ids(PVD_COLORS));
export const CutIdSchema = z.enum(ids(CUTS));
export const MoldIdSchema = z.enum(ids(MOLDS));
export const InscriptionStyleIdSchema = z.enum(ids(INSCRIPTION_STYLES));

const money = z.number().min(0).max(100_000);
/**
 * A price that can go below zero: styles can be priced below the base style
 * (MAG-219 — Trax lists Windows at -$60, and a shop prices it the same way).
 * Everything else stays non-negative.
 */
const signedMoney = z.number().min(-100_000).max(100_000);
const multiplier = z.number().min(0.1).max(10);
const nonEmptyUnique = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).min(1).refine((list) => new Set(list).size === list.length, 'Each option can be listed once.');
const priceMap = <K extends z.ZodEnum<[string, ...string[]]>>(key: K, value: z.ZodTypeAny = money) => z.record(key, value);

export const FONT_PAIRS = ['serif-classic', 'modern-sans', 'editorial'] as const;
export const PRICE_DISPLAYS = ['exact', 'from', 'hidden'] as const;
export const CUT_UNITS = ['order', 'arch', 'tooth'] as const;
/** The columns of the iced price table: gold by karat, the other metals by name. */
export const ICED_KEYS = ['silver', 'platinum', ...KARATS.map((karat) => karat.id)] as const;
export const IcedKeySchema = z.enum(ICED_KEYS);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #C9A45C.');

export const BrandSchema = z.object({
  name: z.string().trim().min(2).max(60),
  /** Public URL or storage path of the logo; absent = a wordmark of `name`. */
  logo: z.string().trim().max(500).optional(),
  accent: hex,
  fontPair: z.enum(FONT_PAIRS),
  instagram: z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/, 'Instagram handle without the @.').optional(),
  phone: z.string().trim().max(30).optional(),
  /** "Powered by VVS Lab" in the footer. */
  poweredBy: z.boolean(),
});

export const CatalogSchema = z.object({
  metals: nonEmptyUnique(MetalIdSchema),
  karats: nonEmptyUnique(KaratIdSchema),
  types: nonEmptyUnique(GrillzTypeSchema),
  styles: nonEmptyUnique(StyleIdSchema),
  settings: nonEmptyUnique(SettingIdSchema),
  stones: nonEmptyUnique(StoneIdSchema),
  /** May be empty: no cut choice, and the builder hides the Cut group (MAG-205). */
  cuts: z.array(CutIdSchema).refine((list) => new Set(list).size === list.length, 'Each option can be listed once.'),
  molds: nonEmptyUnique(MoldIdSchema),
  /** Named tooth extras the shop sells (MAG-204); absent = none. */
  extras: z.array(ExtraIdSchema).refine((list) => new Set(list).size === list.length, 'Each option can be listed once.').optional(),
  /** PVD colour coat (MAG-214): the shop offers it; absent = not offered. Colour costs nothing extra. */
  pvd: z.boolean().optional(),
  /** Diamond grade tiers the shop sells (MAG-215); absent = none. */
  grades: z.array(GradeIdSchema).refine((list) => new Set(list).size === list.length, 'Each option can be listed once.').optional(),
  fangs: z.boolean(),
  inscription: z.object({ enabled: z.boolean(), styles: nonEmptyUnique(InscriptionStyleIdSchema) }),
  /** The "Make it yours" step: free-text idea and inspiration upload. */
  vision: z.boolean(),
  /** The shop's own extras (rush order, carrier case…), offered on the Extras step. */
  addOns: z
    .array(
      z.object({
        id: z.string().regex(ADD_ON_ID),
        label: z.string().trim().min(2, 'Name each add-on.').max(40),
        detail: z.string().trim().max(80).optional(),
        price: money,
        per: z.enum(['order', 'tooth']),
      }),
    )
    .max(MAX_ADD_ONS)
    .refine((list) => new Set(list.map((addOn) => addOn.id)).size === list.length, 'Each add-on can be listed once.')
    .optional(),
});

export const PricingSchema = z.object({
  currency: z.literal('USD'),
  /**
   * How the prices were set: the starting prices a new shop gets ('default'),
   * the three quick questions ('quick'), or the full editor ('custom'). Shops
   * from before quick pricing have none and are treated as 'custom', so the
   * quick questions never rewrite their prices.
   */
  source: z.enum(['default', 'quick', 'custom']).optional(),
  display: z.enum(PRICE_DISPLAYS),
  base: money,
  /** What the per-order fee is called ("Appointment fee", "Mold kit"…); absent = "Service fee". */
  baseLabel: z.string().trim().max(40).optional(),
  metalPerTooth: priceMap(MetalIdSchema),
  /** Applies to gold only (yellow, white, rose). */
  karatMultiplier: z.record(KaratIdSchema, multiplier),
  /**
   * Per-tooth finish prices. A style can cost less than the base style
   * (Solid, $0): a negative price is a below-base style, shown openly as
   * -$60 / tooth in the builder and as a negative "Style & finish" line in
   * the summary (MAG-219). The shop still sets every price — a style with
   * no price is not offered, never free by accident.
   */
  stylePerTooth: priceMap(StyleIdSchema, signedMoney),
  stonePerTooth: priceMap(StoneIdSchema),
  settingPerTooth: priceMap(SettingIdSchema),
  extras: z.object({ fangs: money, permanent: money, photo: money }),
  /**
   * What each fit costs and how it's counted (MAG-96): once per order, per arch
   * (top and bottom each count once they have a tooth), or per tooth. Absent =
   * how it worked first: permanent look at extras.permanent per order, deep cut free.
   */
  cuts: z.record(CutIdSchema, z.object({ amount: money, per: z.enum(CUT_UNITS) })).optional(),
  /**
   * Iced teeth priced all-in (MAG-97): by stone, then metal (silver, platinum)
   * or gold karat, the whole price of one iced tooth, in place of metal plus
   * stones. The setting price and the iced open-face share still apply on top.
   * A missing cell is a combination the shop doesn't offer. Absent = metal plus
   * stones, as before.
   */
  icedPerTooth: z.record(StoneIdSchema, z.record(IcedKeySchema, money)).optional(),
  /** The fangs price is for the set (default) or for each fang (one per upper canine in the set). */
  fangsPer: z.enum(['set', 'fang']).optional(),
  inscription: priceMap(InscriptionStyleIdSchema),
  /** Totals below this are raised to it; 0 = no minimum. */
  minimumOrder: money,
  /**
   * Iced open face holds fewer stones than a full face: charge this share (%)
   * of the stone and setting price, plus a labour price per tooth (absent =
   * the open-face finish price). Absent = 100%, which is how it worked first.
   */
  icedOpenFace: z.object({ stoneShare: z.number().min(0).max(100), perTooth: money.optional() }).optional(),
  /**
   * Iced opal (MAG-169): an opal centre inside a border of stones. The same
   * shape as icedOpenFace: this share (%) of the stone and setting price plus
   * an opal price per tooth. Absent fields fall back to the iced open-face
   * share and the Opals finish price.
   */
  icedOpal: z.object({ stoneShare: z.number().min(0).max(100).optional(), perTooth: money.optional() }).optional(),
  /**
   * Metal linked to the live market price (see lib/metalMarket): grams of
   * metal per tooth and labour per tooth for each metal, plus a markup on the
   * metal. The fixed metalPerTooth prices stay as the fallback when no market
   * price is available. `quote` is filled in by the server from the day's
   * prices; a quote saved in a config is ignored.
   */
  market: z
    .object({
      enabled: z.boolean(),
      gramsPerTooth: z.record(MetalIdSchema, z.number().min(0).max(50)),
      labourPerTooth: priceMap(MetalIdSchema),
      markupPercent: z.number().min(0).max(500),
      quote: z
        .object({
          asOf: z.string().max(40),
          gold: z.number().positive(),
          silver: z.number().positive(),
          platinum: z.number().positive(),
          perTooth: z.record(z.string().max(20), money),
        })
        .optional(),
    })
    .optional(),
  /** A fee per way of getting the fit (e.g. a mail-in kit), once per order. */
  molds: priceMap(MoldIdSchema).optional(),
  /**
   * Back teeth priced apart from the front six (incisors and canines): each
   * premolar and molar costs this percent of a front tooth's per-tooth price
   * (metal, finish, stones, setting). Absent = 100%, the same as the front.
   */
  positions: z.object({ premolar: z.number().min(25).max(400), molar: z.number().min(25).max(400) }).optional(),
  /** Set-size pricing: the per-tooth prices drop by percentOff once a set has minTeeth teeth. */
  volume: z
    .array(z.object({ minTeeth: z.number().int().min(2).max(32), percentOff: z.number().min(1).max(90) }))
    .max(4)
    .refine((tiers) => new Set(tiers.map((tier) => tier.minTeeth)).size === tiers.length, 'Each set size can have one discount.')
    .optional(),
  /**
   * Set prices by metal (MAG-204): whole-set prices, gold by karat and the
   * other metals by name (the same key as the iced table). A size entry's
   * price is what the whole set costs in that metal; a missing cell is a
   * metal with no set price. Absent = per-tooth prices, as before.
   */
  setPrices: z
    .array(
      z.object({
        size: z.number().int().min(2).max(32),
        prices: z.record(IcedKeySchema, money),
      }),
    )
    .max(4)
    .refine((tiers) => new Set(tiers.map((tier) => tier.size)).size === tiers.length, 'Each set size can have one price.')
    .optional(),
  /**
   * A flat surcharge per tooth on a metal (MAG-204): white and rose gold cost
   * a fixed amount over the base metal price, whatever the karat. Applies to
   * fixed metal prices only — a market-linked quote already is that metal's
   * price. Absent = no surcharge.
   */
  colourSurcharge: z.record(MetalIdSchema, money).optional(),
  /** Named tooth extras, per tooth (MAG-204); absent = none offered. */
  extraPerTooth: z.record(ExtraIdSchema, money).optional(),
  /** Diamond grade tiers, per tooth (MAG-215); absent = none offered. */
  gradePerTooth: z.record(GradeIdSchema, money).optional(),
});

export const DepositSchema = z.object({
  /** stripe = checkout into the shop's Stripe account; link = the shop's own payment link; none = no deposit step. */
  mode: z.enum(['stripe', 'link', 'none']),
  rule: z.discriminatedUnion('type', [
    z.object({ type: z.literal('percent'), value: z.number().min(1).max(100), min: money, roundTo: z.number().int().min(1).max(100) }),
    z.object({ type: z.literal('fixed'), amount: money }),
  ]),
  link: z.string().url().optional(),
});

/** The pricing with cut prices kept only for the cuts on offer (none left = no `cuts` table). */
export const pruneCutPrices = <P extends { cuts?: Partial<Record<string, unknown>> }>(pricing: P, offered: readonly string[]): P => {
  if (!pricing.cuts) return pricing;
  const kept = Object.fromEntries(Object.entries(pricing.cuts).filter(([id]) => offered.includes(id)));
  const { cuts: _drop, ...rest } = pricing;
  return (Object.keys(kept).length ? { ...rest, cuts: kept } : rest) as P;
};

/** The pricing with extra prices kept only for the extras on offer (none left = no `extraPerTooth` table). */
export const pruneExtraPrices = <P extends { extraPerTooth?: Partial<Record<string, unknown>> }>(pricing: P, offered: readonly string[]): P => {
  if (!pricing.extraPerTooth) return pricing;
  const kept = Object.fromEntries(Object.entries(pricing.extraPerTooth).filter(([id]) => offered.includes(id)));
  const { extraPerTooth: _drop, ...rest } = pricing;
  return (Object.keys(kept).length ? { ...rest, extraPerTooth: kept } : rest) as P;
};

/** The pricing with grade prices kept only for the tiers on offer (none left = no `gradePerTooth` table). */
export const pruneGradePrices = <P extends { gradePerTooth?: Partial<Record<string, unknown>> }>(pricing: P, offered: readonly string[]): P => {
  if (!pricing.gradePerTooth) return pricing;
  const kept = Object.fromEntries(Object.entries(pricing.gradePerTooth).filter(([id]) => offered.includes(id)));
  const { gradePerTooth: _drop, ...rest } = pricing;
  return (Object.keys(kept).length ? { ...rest, gradePerTooth: kept } : rest) as P;
};

export const TenantConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    brand: BrandSchema,
    catalog: CatalogSchema,
    pricing: PricingSchema,
    deposit: DepositSchema,
    leads: z.object({ email: z.array(z.string().email()).max(5), sms: z.array(z.string().max(30)).max(3) }),
    ai: z.object({ monthlyGenerations: z.number().int().min(0).max(100_000) }),
  })
  .superRefine((config, ctx) => {
    const { catalog, pricing, deposit } = config;
    const need = (list: readonly string[], prices: Record<string, number>, path: string) => {
      list.forEach((id) => {
        if (prices[id] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricing', path, id], message: `Add a price for ${id}.` });
      });
    };
    need(catalog.metals, pricing.metalPerTooth, 'metalPerTooth');
    need(catalog.karats, pricing.karatMultiplier, 'karatMultiplier');
    need(catalog.styles, pricing.stylePerTooth, 'stylePerTooth');
    need(catalog.stones, pricing.stonePerTooth, 'stonePerTooth');
    need(catalog.settings, pricing.settingPerTooth, 'settingPerTooth');
    need(catalog.extras ?? [], pricing.extraPerTooth ?? {}, 'extraPerTooth');
    need(catalog.grades ?? [], pricing.gradePerTooth ?? {}, 'gradePerTooth');
    if (catalog.inscription.enabled) need(catalog.inscription.styles, pricing.inscription, 'inscription');
    if (deposit.mode === 'link' && !deposit.link) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deposit', 'link'], message: 'Add the payment link.' });
    if (pricing.display === 'hidden' && deposit.mode !== 'none' && deposit.rule.type !== 'fixed') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deposit', 'rule'], message: 'With hidden prices the deposit must be a fixed amount.' });
    }
    if (catalog.types.includes('iced') && (!catalog.settings.length || !catalog.stones.length)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catalog', 'types'], message: 'Iced out needs at least one setting and stone.' });
    }
  })
  // Pricing only ever charges for cuts the shop offers: drop entries left over from cuts turned off.
  // The same for named extras and diamond grade tiers.
  .transform((config) => ({ ...config, pricing: pruneGradePrices(pruneExtraPrices(pruneCutPrices(config.pricing, config.catalog.cuts), config.catalog.extras ?? []), config.catalog.grades ?? []) }));

export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export type TenantCatalog = TenantConfig['catalog'];
export type TenantPricing = TenantConfig['pricing'];
export type TenantDeposit = TenantConfig['deposit'];

export type ParseResult = { ok: true; config: TenantConfig } | { ok: false; issues: { path: string; message: string }[] };

export const parseTenantConfig = (value: unknown): ParseResult => {
  const result = TenantConfigSchema.safeParse(value);
  if (result.success) return { ok: true, config: result.data };
  return { ok: false, issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) };
};
