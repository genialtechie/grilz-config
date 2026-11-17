// The front door's words, as the owner signed them off in the Creator Lab
// (docs/redesign/creator-lab/src/50-ui.js; reasons in docs/redesign/plan.md,
// Decisions). Change none of them without the owner.

/** The moving strip under the hero: only options the builder really sells. */
export const WORDS = ['14K Yellow', 'Rose Gold', 'White Gold', 'Platinum', 'VVS Diamonds', 'Moissanite', 'Iced Out', 'Diamond Cut', 'Open Face', 'Fangs', 'Two-Tone', 'One-of-One'];

/** What happens when you hit send: what reaches the jeweler. */
export const GETS: [string, string][] = [
  ['Who it’s from', 'Name and phone, checked with a text code.'],
  ['The exact spec', 'Every tooth, metal and stone, with the price shown.'],
  ['The studio photo', 'The picture that sold it.'],
  ['The fit', 'A mailed mold kit, their own mold or scan, or in store.'],
  ['The deposit', 'Paid to the shop, straight to them.'],
];

export const Q_GET: [string, string][] = [
  ['What metals can I choose?', 'Yellow, white or rose gold in 10K, 14K or 18K, sterling silver, or platinum. You pick in the builder and watch the price change.'],
  ['How do you get the shape of my teeth?', 'We post you a mold kit: you bite, then mail it back. Or send your own mold or a scan.'],
  ['Is the price I see final?', 'It’s an estimate from the real prices. The shop confirms the exact price after your fitting.'],
  ['What does sending my design cost?', 'Nothing. You send it free and the shop texts you.'],
  ['What’s the deposit?', 'An optional payment that starts your order. You see the amount before you pay, and it counts toward your grill.'],
  ['Do I need an account?', 'No. Designing is free. We only ask for your phone when you send a design or use AI, and we text you a code.'],
];

export const Q_SELL: [string, string][] = [
  ['Do I need a website?', 'No. The builder is its own link, so it works from your Instagram bio, a story or a DM. If you have a site, it can sit there too.'],
  ['Whose prices does it show?', 'Yours. You set your metal, stone and per-tooth prices, so the total a customer sees matches what you would quote.'],
  ['Where does the deposit go?', 'Through your own Stripe account, straight to you. VVS Lab never holds your money.'],
  ['Is the studio photo the finished piece?', 'It is a photo-real picture of the design they built, so they can see it before paying. The 3D build and the spec you receive are what you work from at the bench.'],
  ['Can customers ask for a one-of-one?', 'Yes. They can place charms on any tooth or send their own idea with a photo. Those arrive as a custom request for you to quote.'],
  ['Is there a contract?', 'No. 14 days free with no card, then $199 a month. Cancel any month.'],
];
