# VVS Lab Redesign Plan

Snapshot of the living plan page, kept up to date on the `redesign` branch (last round: Nov 17, 2026, Creator Lab v11). Newest decisions are at the top of the Decisions table.

## Status

The approved 3D now runs inside the real builder on the redesign branch, showing the whole piece as you chose. The builder's UX overhaul has started from scratch: the Grill Creator Lab (v11, republished from this account at https://claude.ai/artifact/Apwvvs8JjwHDwus15UQKFg; the first account's copy was https://claude.ai/artifact/DK6Km1K4CZZiCDbGwsPWym) puts the options you asked to compare on the real 3D. v13 makes the start page "Start your build" with its builds, or one AI field with a camera inside it, the same field that closes the AI conversation; v11 adds the AI path you decided on Nov 17: "Describe it" and "From a picture" on the start page and as a tool on the stage, the phone sign-up first with the reason said plainly, 3 free builds per phone, a conversation, and the closest match with a note on what's different. Main and the live site are untouched.

**Goals (updated Nov 16):** the original brief, plus three new ones: a customer can make a custom grill order in under two minutes; a hybrid site that sells to shop owners and customers alike, and shows which should be the main lane; senior-level, aesthetically pleasing work; and a verified, contactable contact before a shopper gets some of it, while the rest stays free to explore. Notes for the portfolio case study: Case study notes

|  |  |
| --- | --- |
| **Built** | [End-to-end prototype](https://claude.ai/artifact/AuT9uiP5MtFsVjeVweLmLk), version 6: front door, sign-up, the five-step builder with every option from the live demo shop, review, send, deposit, share card |
| **Real** | Every option and price rule of the live demo shop; all 3D, generated in code and drawn live; your design is kept between visits on the same device |
| **Simulated** | Sending the request, the studio photo (a still of the 3D), the deposit, sign-up. Nothing reaches a server. |
| **Not done** | Wiring into the real app. Inscription fonts and enamel colours, multi-tooth inscriptions, shop add-ons, live metal pricing. |
| **Not verified** | Tested in an automated browser at desktop and phone widths, not on a real phone or a real graphics card, so speed on phones is unknown |
| **Repo** | All redesign work lives on the `redesign` branch (created Nov 16 at your request). So far it only adds `docs/redesign/` and the working rules in `CLAUDE.md`; no app code has changed. Main and the live site are untouched, and nothing merges to main until you say so. |

How this doc works: I update it before and after every round. Decisions are asked as question slides and recorded below. Comment anywhere to change the plan.

## Round 5 plan: the hybrid front door and the shopper's path (needs your OK)

**Paused, Nov 16: the flow comes to you first.** I started building the shopper's journey without taking you through the flow, and nothing of it was published. These choices I made on my own are now open questions for you, one slide at a time:

- Start every design from a one-tap look. This changes your Nov 15 order: Teeth → Metal → Finish → Details → Send.
- Show real metal from the first tap. This changes your Nov 15 call: cream until the Metal step.
- A "Surprise me" button, and a "Skip to send" shortcut on every step.
- Extras (fangs, initials, a charm, the permanent look, your idea) as one row, each opening on its own.
- The send screen inside the controls: only name and Instagram or phone required; email, a note and a promo code tucked away.
- The studio photo, deposit and what happens next all after sending, with the time it took shown to the customer.
- The controls as a side panel on computers and a slim tray on phones. On Nov 15 you asked to see selectable versions before choosing.

**Your answers so far (Nov 16):** three ways to start (describe it to AI, start from a picture and AI builds the closest version, or build it yourself, where the first tap only picks teeth); real metal from the first tap; a verified phone at the studio photo, if it can be free; selectable versions for the rest. To compare the flow options, here is a small clickable prototype: [Shopper Flow Lab](https://claude.ai/artifact/8YSgY8b6cgC4F8peaW2ZG1). Each screen lists the choices that are still yours to make.

**Flow lab version 2 (Nov 16), from your comments:** building it yourself is the default; AI is visible but behind a free sign-up; popular sets with Next, Next, Next; a Custom chip; single-tooth changes by tapping.

**Phone verification: what it costs (researched Nov 16).** Texting a code is nearly free but not free. The cheapest reliable way, Firebase phone codes from Google, is about $0 a month at 100 sign-ups, $7 at 1,000 and $47 at 5,000, with no US carrier registration. Twilio Verify, which plugs straight into our sign-in system (Supabase), is the most proven but costs about $58 a month at 1,000. A free option exists: "Verify with WhatsApp", where the shopper sends us a prefilled code from WhatsApp; but only a third of US adults use WhatsApp, so it can only sit alongside texts. Email codes already work for free but are not textable. Instagram DM verification is free but needs Meta's app review.

**The aim.** A shopper lands on VVS Lab and sends a custom grill order in under two minutes. Jewelers on the same page see why they want it for their own shop. Every visit shows which lane is stronger.

**What I'll build:** prototype version 7, at the same link.

| Part | What it does | Why |
| --- | --- | --- |
| **1. Hybrid front door** | The piece, live, is the hero. The shopper lane leads (design your grill, order in two minutes); a clear second door speaks to jewelers (put this on your site). Three layouts you can switch between to compare. | The door each visitor picks is the lane test's first signal |
| **2. Fast start** | One tap on a look (plain gold, iced, open face, fangs, two-tone, one-of-one) builds a full set with a price. Everything after that is optional. | A complete, priced design in the first ten seconds is what makes two minutes possible |
| **3. The builder controls** | Another round, from your notes (next slide) | You flagged them |
| **4. One screen to send** | Price, fit and two fields: name, and Instagram or phone. Email, a note, promo code and add-ons are tucked in, optional. | Fewer fields, no extra screen |
| **5. The studio photo** | After sending, the 3D turns into the studio photo in place | The reward for sending |
| **6. Deposit and what happens next** | The deposit, then four steps: the jeweler messages you, you get fitted, they make it, it's delivered | Your answer on where the journey ends |
| **7. Confirmation** | On screen, plus a preview of the shopper's email | Closes the loop |
| **8. A jeweler's shop** | The same path dressed in a jeweler's own logo and colour, switchable | Shows the shop lane with the same builder |
| **9. A two-minute clock** | Times you from the first tap to send and shows it on the confirmation ("Designed in 1:24") | You can test the target yourself; it is also good marketing |

**Phone first.** Most shoppers come from Instagram on a phone, so the phone layout leads and the computer layout follows.

**Direct orders** read as made by a partner jeweler. The partner's name and the referral fee are yours to set later; the prototype uses a stand-in.

**How the lane test is measured** once this is in the real app: which door each visitor takes; for shoppers, designs started, orders sent, deposits paid and the time to send; for jewelers, the demo opened and trials started.

**In parallel:** the approved 3D is being rebuilt inside the real app, on its own branch, for me to review before it joins `redesign`.

## The full plan: every module (Nov 16)

The redesign covers two journeys. The **customer's**: from opening a shop's builder to sending a design and paying a deposit. The **jeweler's**: from first hearing of VVS Lab to running their shop on it. This list comes from a full read of the real app, so nothing in it is guessed.

Where things stand (Nov 17, evening): the piece is approved and rebuilt in the real app. The builder is overhauled for a first-timer in the Grill Creator Lab: the build strip with Next and Back, progress in the rings, Select teeth on the stage, a guide when stuck with Undo. After "Done": one screen to send, the code, then Sent, all built. The AI path is built (v11) from the Nov 17 decisions. Not started: the front door, the shop's brand, coming back, everything on the jeweler's side, VVS Lab's brand and the emails.

### The customer's journey

| Step | What the real app does today | Redesign |
| --- | --- | --- |
| **1. Arrive** | A shop link, the shop's own domain, or the builder on the jeweler's website (in the page on computers, a "Design your grillz in 3D" card on phones). Also the loading, closed and paused screens. | Not started |
| **2. The shop's brand** | Each shop's logo, colour and fonts dress the builder | Not started. The prototype uses a stand-in "Your Shop" |
| **3. The piece** | The 3D model | **Approved** |
| **4. Build** | Five steps: Teeth, Metal, Look, Make it yours, Review & send. Tap a tooth to style it alone. | Overhauled in the Grill Creator Lab: bare teeth with starting builds, the build strip (any order, Next and Back), a guide when stuck, tap teeth to style them, several at once. AI: Describe it or start from a picture, behind a free phone sign-up (v11) |
| **5. Review and send** | Summary, price breakdown, fit (mold kit, own mold, in store), the shop's add-ons, promo code. Then name, Instagram or phone, and an optional email and note | Replaced by "After Done": 1. Your grill, 2. Where should they text you. Order and rules decided; screens being designed one by one |
| **6. Studio photo** | An AI photo of their exact design, about 30 seconds after sending; 3 per visitor | Needs a verified phone. Develops from the 3D on the Sent screen. Prompts still to be re-tuned to the new 3D |
| **7. Deposit** | None, the shop's own pay link, or a card through the shop's own Stripe. The money goes straight to the jeweler | Decided: optional, offered on the Sent screen. Screen not designed yet |
| **8. Confirmation** | A "Sent to the shop" card on screen, plus an email to the customer if they gave one | The Sent screen: photo, deposit, what happens next. Not designed yet. Email: not started |
| **9. Coming back** | The design is kept on their device, a link to the design, and the deposit link in the email (30 days) | Partly prototyped |

The journey stops there today. There is no order status page, no balance payment and no texts. The jeweler takes it from there in DMs.

### The jeweler's journey

| Step | What the real app does today | Redesign |
| --- | --- | --- |
| **1. Discover** | The landing page, the demo builder, "DM BUILD" on Instagram, or a shop VVS Lab builds ahead and hands over with a QR claim link | Front door: prototyped, needs another round (your call). Claim page: not started |
| **2. Sign up and sign in** | Three fields, a 14-day free trial that goes live at once, an email to confirm, sign-in by emailed link or code | Sign-up: prototyped. The rest: not started |
| **3. Set up** | Logo, pricing in three questions, the full editor (what you sell, every price, deposit and Stripe, where requests go), publish | Not started |
| **4. Share** | The link, a website code with guides for Shopify, Wix, Squarespace and WordPress, their own domain, promo codes | Not started |
| **5. Requests** | Every design arrives by email and in a requests list: photo, spec, contact buttons, a status (new, contacted, deposit paid, won, lost), team notes, export | One request card prototyped. The list: not started |
| **6. Stats and team** | Views, requests, conversion, value and deposits; owners and staff | Not started |
| **7. Plan and billing** | Trial banner, card prompt, $199 a month, the lock when a trial ends, the paused builder | Not started |

### Across both

| Module | What it is | Redesign |
| --- | --- | --- |
| **Emails** | 17 in all. 4 per design request (new design to the jeweler, the photo follow-up, the customer's confirmation, deposit paid), 4 for accounts (welcome, code, team invite, sign-in link), 5 in the trial sequence, 2 to win shops back, plus product news | Not started |
| **Brand** | VVS Lab's own logo, wordmark, colour and type | Not started. The prototype uses stand-ins |
| **Kept as is** | The internal admin (Magpollo only); the legal pages get a restyle only | No design work |

### Gaps in the journey (product questions, not only design)

- After sending, the customer has nowhere to see where their order stands.
- Payment stops at the deposit; the rest is paid outside VVS Lab.
- The studio photo only comes after sending. That is on purpose: it is the reason to send.
- The landing page promises a Shopify checkout, but there is no Shopify connection.

### Found on the way (in the live app, left alone)

- Studio photos for sent designs only run while a Flux image key is set, even though OpenAI is now the default image service. The live site has that key today (its health check says photos are on), so nothing is broken. Removing the key would quietly stop photos.
- The photo-limit message says "for this demo" on real shops.
- A photo made after editing a sent design is not attached to the request.

### Proposed order

1. **Round 5: the customer's journey, end to end**, as one prototype: arrive (link and phone card, the shop's brand), the new controls, review and send, studio photo, deposit, confirmation, coming back. In parallel, build the approved piece into the real app on the redesign branch.
2. **Round 6: brand and front door**: VVS Lab's identity, then the landing page, sign-up, claim and sign-in.
3. **Round 7: the jeweler's dashboard**: setup, requests, share, stats, team, billing.
4. **Round 8: emails.**
5. **Build each approved round into the real app**, re-tune the studio photo, and test on real phones.
6. **Go live**: merge into main only when you say.

## Round 4: the teeth (version 6)

This round is only the shape and spacing of the teeth, with the hosted model as the yardstick. Materials, metals, finishes, controls and the flow are untouched.

|  | Before (version 5) | Now (version 6) |
| --- | --- | --- |
| **Shape** | Hand-made rounded forms, one formula per tooth type | The hosted model's own crowns: 16 shapes (8 upper, 8 lower), smoothed so they are soft where the hosted ones are faceted |
| **Spacing** | Teeth walked along a curve by their width | Each tooth where the hosted model has it, then seated so neighbours touch. The hosted teeth overlap each other by up to 1 mm; these do not |
| **Bite** | Both rows ended on a flat line with a gap | A real bite: the top row closes 1.6 mm over the bottom, with 1 mm clear at the front and 0.6 mm at the back, so caps and stones never meet |
| **Heights** | Every tip on one line | The natural line: the front two longest, the ones beside them about 1 mm shorter |
| **Gum line** | Straight | Scalloped: it arcs over each tooth and comes to a point between neighbours, filling the small gap there |
| **Left and right** | The same shape on both sides | True mirror images |

**What I found in the hosted model.** It is stored tilted open (top row 10 degrees, bottom row 7) and turned about 4 degrees to one side, which is why it measured lopsided at first. Stood upright it is exactly symmetric, so the right-hand teeth are used and mirrored.

**What carried over.** Every finish, stone setting, open face, opal, photo, letters, charm and fang. They are now laid out on a map of each tooth's real face, so they follow its outline. A fang is the real canine drawn out to a point.

**Choices I made. Accepted on Nov 16 ("the teeth are perfect").**

- Bite: the natural overbite hides the top 1.6 mm of the bottom front teeth while the mouth is closed. The other way is both rows meeting edge to edge, so the whole bottom grill shows.
- Gum line: scalloped, not straight.
- Crown length: almost the whole crown shows (front teeth 9.6 mm tall). The hosted version hides about 1.2 mm more under the gum.

**Checked:** every look at desktop and phone widths in an automated browser, with no errors. **Not checked:** a real phone. The teeth carry about twice the detail of version 5, so speed on phones is the thing to watch.

## What to test this morning

Open the prototype on your phone and on a laptop, and walk the two journeys.

| Journey | Steps | What to judge |
| --- | --- | --- |
| Jeweler | Watch the front door cycle through looks. Scroll down. Press Start free, name a shop, open its builder. | Does the first screen sell it? Is the sign-up short enough? |
| Customer | Press Try the builder. Teeth, Metal, Finish, Details, Send. Add a name and handle, send, pay the deposit. | Is each step obvious? Does the bench feel right in the hand? |
| Finishes | On Finish, try every tile under Plain, then Iced out with each setting, then Photo with your own image. | Which finish is weakest? Do the stones sparkle when you turn the piece? |
| One tooth | On Metal or Finish, tap one tooth and change only it. Tap empty space to go back. | Is it discoverable? |
| One-of-one | Teeth step, the One-of-one look. Or Details, then a charm on a tooth you tapped. | Are the charms close enough to the reference? |
| The piece | Left, Front, Right. Open mouth. Slide the holder from 30% to 100%. | Tooth shapes, gaps, the holder's flat top. |

Design calls I made without you, since you asked me to finish alone: one control layout (a bench along the bottom, not three to choose from); option pictures rendered live from the real tooth; the front door cycles through five looks by itself; a three-field sign-up that puts the shop's name on the builder; Left, Front and Right view buttons; a promo code (VVS10) in the demo shop.

## Round 3.1: fixes from your review

All six fixes are in version 5. Each answers a note you gave on version 3, checked against close-ups of your reference photos.

| Your note | What the reference shows | What changes |
| --- | --- | --- |
| The holder's top should be flatter or more solid, like a grill holder or case | A clear block with a flat top and near-vertical walls | The holder becomes a flat-topped block with crisp bevelled edges, with only a slim gum roll at the tooth necks |
| The edges of the front surface look hollow rather than tooth-shaped | Each cap is a bulging dome whose top edge arches up toward the gum | Caps get a fuller, rounder face and an arched top edge with a visible lip. Clear teeth become more solid so they read as teeth, not glass shells. |
| Too much gap between teeth | Neighbouring caps touch along their lower half | Teeth are re-seated so their widest points meet near the front, with flatter sides |
| Diamonds: not enough sparkle, wrong size, bezel too thick, too much bare gold inside the bezel | Tiny stones packed edge to edge inside a thin gold rim | Smaller stones, tighter rows, covering the whole face up to a thin rim. Brighter light on the stones. |
| Diamond cut is the weakest finish | Cut teeth show crisp flat facets | Larger, sharper facets instead of a fine cross-hatch |
| Make the charms in the reference, from scratch | Quartered crest, triangle emblem, winged ball, pointed hat, broom, owl, potion bottles, blue stone | Those eight, built as original generic versions, replace the current set. The default showpiece follows the reference layout. |

One thing I will not copy: the boy-wizard figure, the triangle-circle-line symbol and the school crest art are a film studio's property. The crest is a plain quartered shield, the emblem is a triangle with a stone, and a crown takes the figure's place. A custom figure is what "Request your own idea" is for.

## Round 3 plan: the 3D

Built on Nov 15 as version 3 of the prototype. The target is your reference photos: gold caps on a clear resin mold, with set stones, enamel colour and sculpted charms.

| Part | What you will see | How it is made |
| --- | --- | --- |
| Holder | A clear resin dental mold under the grill, frosted and about 70% solid, like the one in your photos. A dial in the prototype sets how see-through it is. | Gum ridges and teeth generated in code, with a frosted-glass material that blurs what sits behind it |
| Teeth | Rounder, softer teeth that touch their neighbours without overlapping. Teeth you haven't picked are part of the clear holder. | Each tooth is one smooth rounded form, tapered and bowed by type. Proportions come from the hosted model; its look does not. |
| Grill caps | A picked tooth becomes a cap on the holder: the cream material by default on the Teeth step, metal from the Metal step on | The tooth's own shape, slightly fuller |
| Metals | Yellow, white and rose gold, and silver. The karat shifts the colour. | The jeweler's light tent from version 2 |
| Stones | Iced teeth get real set stones in a honeycomb, each one faceted, replacing version 2's sparkle effect | Hundreds of small cut stones placed across the tooth surface |
| Colour | Enamel fills and bezel-set coloured stones | A glossy colour material and domed gems |
| One-of-one showcase | One finished showpiece set with original charms (a crest, wings, a crown, gem drops), to show what premium custom looks like | Charms built as raised gold reliefs |
| Start state | Mouth closed, with the open and close button |  |

The showcase uses original motifs, not Harry Potter or any other licensed character.

What changed while building, from your notes: iced teeth now sit inside a raised gold bezel, and the default showpiece is masculine (a cross, a black-enamel crest, a crown, a spade, onyx stones; no heart, no red). The charm library has eight pieces: crest, crown, cross, spade, bolt, wing, onyx and sapphire. The holder dial runs from clear (30%) to milky (100%).

Added early because you chose it on a slide: tap a tooth on Metal, Finish or Custom to change just that one.

Not in this round: open face, diamond dust, engraving, opals, photo grillz, fangs and initials. They are all in v1 and follow in round 4.

## Decisions

The direction is a blank-canvas rebuild in the Stone room, with nothing carried over from the current site or my first two rounds.

| Date | Decision | Your answer |
| --- | --- | --- |
| Nov 17 | The start page, again: one AI field | Not set on v12. "With ai platforms people are more used to a text field when they know they are talking to ai. We can implement a text field with a camera / upload icon for uploads and write describe your grillz or upload inspiration. Didn't have to be split. It should be start your build and those selections ORRRR using the ai builds." You asked for research on comparable start pages and a "god tier" design that keeps the screens after it consistent. Built as v13: Start your build with the builds row (Build it yourself first), then "or let AI build it", then one field, "Describe your grillz or upload inspiration", with a camera inside it and a send button that wakes when there's something to send. The same field closes the AI conversation (Keep talking), replacing the textarea, picture line and Build-it button there. v12 and v11 stay behind the Start page switch |
| Nov 17 | The v11 words, and the start page | The words written without a slide stay as they are: the sign-up screen ("Where should we text your code?" and "Every AI build costs us money, so we ask for your phone first. Each phone gets 3 free builds, and it's the number VVS Lab texts about your grill."), the Describe-it screen (heading, intro and the example sentence) and the ending after 3 builds ("That was your 3 free builds on this phone." with "Keep editing by hand"). On where the AI entries sit: "You're a product designer… Get creative and pick the best way even if it means redesigning the start empty screen." Picked and built as v12: three equal ways in (Describe it, From a picture, Build it yourself), each a round icon and a name, then the popular builds, which now open the builder in one tap; "Start empty" as a button is gone. A build in progress comes back as "Your build is waiting" with Continue your build on top. The v11 start page stays behind the prototype switch to compare |
| Nov 17 | The AI screens: four more choices | What counts toward the 3 free builds: every reply counts. The AI sign-up screen (after they describe it and tap "Text me a code to build it"): say why, plainly, with the same fields as sending (first name and phone, then the code). "Start from a picture" takes a photo or a screenshot (Instagram blocks other sites from reading a post from its link, so a pasted link can't be relied on). When the AI can't make exactly what they asked for (a stone or style the shop doesn't offer, a blurry picture): build the closest match and say what's different. Built in Creator Lab v11; a simple word matcher stands in for the AI, and the page says so |
| Nov 17 | AI in the builder: where it lives, how it talks, how many | The explored count stays in the strip itself: a part not opened yet wears a gold ring (like an unseen story), the open part a black ring, and "2 of 5 explored" sits under Back and Next (confirmed). Once someone is building, "Describe it / use a picture" lives as a tool on the stage (Your build is now the strip, so the planned row had no home). "Describe it" is one box, then keep talking (each AI reply costs money, which is why it sits behind the free phone sign-up). One verified phone gets 3 AI builds free, in total |
| Nov 17 | The builder's structure: the build strip | The build strip is the choice: the five round pictures stay pinned on top, the open part below. The main button says "Next" (no part name, no arrow) and "Done" on the last part. The smaller button is "Back": it goes to the screen you were on before, stays visible beside Done, and from the first screen returns to Start your build (the build is kept; the button there says "Continue your build"). No arrows inside any button. "Select teeth" is a toggle on the stage: bottom right on phones in line with the other tools, beside Undo on computers, above the tools when there's no room. Quick questions can sit on top of it; undoing an answer brings the question back. Keep the explored count, but not as a bar on top of the strip ("we need to get creative with that"): parts not opened yet wear a gold ring, like an unseen story, and the count sits under the buttons |
| Nov 17 | Rethinking the builder's structure; AI paths; your notes on v8 | "The your build page is the thing that made the UX the best, but… it barely ever gets seen." You asked to see prototypes of all structures: a stacked sheet over Your build, expand in place, a build strip, each with Up next on Your build or a Next button (all in Creator Lab v9 as switches). AI paths: "Describe it" and "Start from a picture" on the start page and in Your build; the phone sign-up comes after they describe it; AI builds the closest version in the 3D, all editable, with a note and Undo. Notes: "Change" becomes "Select teeth"; "Here are your grillz"; no big price, the EST pill stays; the fitting pictures use the live builder's icons |
| Nov 17 | Your review of v7: design system and hierarchy | "That's awful design structure and hierarchy… a design system should be slowly built and components reused." Done in v8: one shared Row (words left, round picture right) for the menu, the fitting choices and the steps after sending, as the menu was when its pictures sat on the right; matching gold icons (mold tray, scan, store, message, deposit, Instagram); no stages on the screens after Done; name and phone on the same screen as the fitting, so after Done it's one screen to send, then the code, then Sent; every screen ends in the same footer (Sent: Not now + Pay deposit, then Save my photo); start page padding fixed. In-store fitting stays off VVS Lab's own site; the Sent line is just the number. Also: an Undo button next to Turn (steps back through any change), and the Change chips (whole set, rows, front teeth, canines, every other, your picks) moved out of the panel onto the stage beside the mouth tools. Next round: the AI paths |
| Nov 17 | Orders from VVS Lab's own site | VVS Lab only, no partners yet: on VVS Lab's own site the shopper sees VVS Lab, and VVS Lab texts them (this updates Nov 16's partner jeweler for now). When partners come, deposits go to the partner's own Stripe and VVS Lab's fee is invoiced monthly; until then VVS Lab takes them as its own shop. The words under "Start your order": "$150 now, counted toward your grill. \[Shop\] confirms the rest." |
| Nov 17 | After Done, screen 3: Sent | Order, top to bottom: the 3D develops into the studio photo (about 30 s) with "Sent. Gold Lab will text you." and their number under it; then the deposit, "Start your order: $150 now, the rest after your fitting." with \[Pay $150 deposit\] and "Not now"; then one small card, "While your photo develops": Instagram ("Gold Lab sees it as you typed it"), a Follow @vvslab button, "Email me a copy"; then What happens next: 1 Gold Lab texts you, 2 Fitting, 3 They make it, 4 It's yours. Open question from you: what happens when the design is sent from VVS Lab's own site, not a jeweler's builder (whose name shows, who texts, where the deposit goes) |
| Nov 17 | After Done, screen 2: Where should Gold Lab text you? | First name and phone, then "Text me a code"; the code box opens in place, fills itself from the text on phones, and the 6th digit sends the design and opens Sent. The line under the fields: "Gold Lab texts you about this grill only. We'll send a code first; msg & data rates may apply." "Send a new code" after 30 seconds; "Wrong number? Change it". A phone already verified on this device skips the code: name and number with Change, and "Send to Gold Lab". Instagram, the Follow ask and email move to the Sent screen, while the photo develops |
| Nov 17 | Builder fixes from your notes | The dead end (Start empty → teeth → only "Done"): fix both ways. Start empty opens Your build, and inside each part the big button says "Next: Metal" and so on, with "Done" on the last part. Back is a smaller button beside the main one. On top of each part: stages (Teeth · Metal · Finish · Stones · Extras), the current one bold, visited ones ticked, tap to jump. The quick question gets Undo: the bubble says what changed, with Undo, for about 6 seconds. The 3 screens after Done use the same pattern: a small "Keep editing" beside "Send to Gold Lab", and stages on top (Your grill · Text me · Sent) |
| Nov 17 | After Done, screen 1: Your grill | Headline "This is your grill"; button "Send to Gold Lab" (the shop's name) with "Free. Nothing to pay yet." under it. Price: one number, "About $2,500", with "Gold Lab confirms the exact price after your fitting." and "What's in the price" opening the list. Fitting: "How will they get the shape of your teeth?" with one plain line per option (jeweler terms kept), the shop's first option already picked. Extras: one quiet link, "Add a note or promo code"; the shop's add-ons as small switches only if it has any |
| Nov 16 | After "Done": order and rules | Three screens, one job each: 1. Your grill (the piece, the price breakdown, the fit) → 2. Where should they text you (first name, phone and a 6-digit code) → 3. Sent (the 3D develops into the studio photo, the deposit, what happens next). Required to send: first name and a verified phone. The deposit is optional, offered on the Sent screen. They keep the design through the Sent screen and an optional email; the jeweler's own text is the follow-up (no texts from VVS Lab) |
| Nov 16 | The creator's menu, third pass, and what's next | Zoom out and simplify: round pictures like the earlier rows, no arrow, no grey border (the rows look tappable on their own), fewer fonts. Keep editing several teeth at once as it is. Next round: what happens after "Done" (phone sign-up, studio photo, send, deposit, what happens next), taken screen by screen |
| Nov 16 | The creator's menu, second pass | Neither look: lean jeweler, closer to the earlier rows, and the rows must look tappable. Keep the pictures of the chosen finish and stones; when teeth differ, stack the pictures with a count. Price in one place only (the top bar). Edit several teeth at once: tap to add, plus quick groups (top row, bottom row, front teeth, canines, every other) |
| Nov 16 | Showing how much you can customise | Each menu row says what's inside it; rows not opened yet are marked. Inside a tab, everything stays visible and locked options say why. Two looks for the menu to compare: game-like and jeweler-like |
| Nov 16 | The creator, first picks | Opening: bare teeth with a row of starting builds. Layout: the EA FC-style menu in any order, but it needs better design and must show what each tab can do, so nobody misses how much they can customise. Guiding: a guide only when you seem stuck. Glow: as it is, but drawn above the gums (fixed) |
| Nov 16 | The creator: what to compare | See both, then choose: opening on bare teeth with a row of starting builds vs a full screen of starting builds; an EA FC-style menu in any order vs guided steps you can jump between; a guide that asks when you seem stuck vs questions only at the start. One tooth: tap it on the 3D and it shows a selected glow |
| Nov 16 | The UX overhaul: who and what | Throw the old flow away. Design for a first-timer who knows nothing about grillz (the grandma test). After about two minutes they can say: "I made my grill, I know the price, they'll text me." It should feel like building your character in EA FC: start from an empty build or a preset build, everything customisable, sometimes an easy conversation, never at the cost of full control. Keep the jeweler terms |
| Nov 16 | Framing in the real builder | Show the whole piece, teeth and clear holder, like the prototype; no zooming in on just the chosen teeth |
| Nov 16 | Instagram | After the phone code: an optional field for their handle, then a "Follow @vvslab" step. They go through either way, and the jeweler sees the handle as given, not verified. (A follow that pretends to verify was ruled out: it would mislead shoppers and jewelers.) |
| Nov 16 | Shopper sign-up | Phone verified by a text code, sent by Firebase (Google): about $0 a month at 100 sign-ups, $7 at 1,000, $47 at 5,000. No WhatsApp option. A phone is required; email alone does not count. You asked about verifying with an Instagram follow: Instagram's tools only show a follower count, not who followed, so it can't verify anyone |
| Nov 16 | Flow lab comments | Build it yourself is the default. AI stays visible but needs a free sign-up, said plainly, because it costs per use. Popular sets fill every step so Next, Next, Next gives a popular grill. A Custom chip selects itself when teeth are tapped. Single teeth can be changed by tapping them |
| Nov 16 | How flows get decided | You direct every journey and flow. First a small, clickable, low-fidelity prototype of the flow options; then selectable versions of each screen to compare. Nothing is built as final until you pick it |
| Nov 16 | New goal: verified contact | A verified, contactable contact is required for some access. Shoppers can see the goodness first; I propose what stays free and what needs the contact |
| Nov 16 | First tap and material | Real metal from the first tap (replaces cream first), but the first tap is just picking teeth |
| Nov 16 | Building | Start rebuilding the approved 3D inside the real app now, in parallel with Round 5 |
| Nov 16 | Where the shopper's journey ends | At the deposit, plus a clear "what happens next" on screen and in the email |
| Nov 16 | Who makes direct orders | A partner jeweler already on VVS Lab; VVS Lab can take a referral fee |
| Nov 16 | Round 5 | The hybrid front door plus the shopper's path, from landing to order sent |
| Nov 16 | What still needs design | The builder controls and the front door. The rest of version 6 is fine to build |
| Nov 16 | New goals | An order in under two minutes; a hybrid site that sells to shop owners and customers and shows which lane should lead; senior-level, aesthetically pleasing work; notes kept for a portfolio case study |
| Nov 16 | Branch | All redesign work on a branch named redesign; nothing touches main or the live site until you say |
| Nov 16 | Teeth | Approved: "the teeth are perfect" |
| Nov 15 | Iced teeth | Diamonds sit inside a raised gold bezel, as in the reference photos |
| Nov 15 | Default one-of-one | Has to be masculine |
| Nov 15 | Round 3 | Yes, build it: the 3D only |
| Nov 15 | One-of-ones: premium for whom | Premium for the customer: any shop can offer them, and they go to the jeweler as a custom quote |
| Nov 15 | One-of-ones: how they work | A charm library the customer places live in 3D, plus a request with a photo and a note for anything else |
| Nov 15 | Per-tooth mixing | Tap a tooth, then choose |
| Nov 15 | Front door | One screen plus a short scroll: what the jeweler receives, the price, and FAQs |
| Nov 15 | GitHub push | Leave both commits local for now; give the repo owner a prompt to grant access |
| Nov 15 | Holder | A translucent holder case under the grill, about 70% solid, like the clear mold in your reference photos |
| Nov 15 | Focus | Lock in the teeth sculpting, 3D model and materials first |
| Nov 15 | Quality bar | The grills on the page should be almost as beautiful and custom as the reference photos |
| Nov 15 | One-of-one designs | Included, as premium only |
| Nov 15 | Mouth at start | Closed |
| Nov 15 | Finishes in v1 | All of the ones in the live hosted version |
| Nov 15 | How you see progress | A living plan page (this doc), plus question slides for every decision |
| Nov 15 | Step order | Teeth → Metal → Finish → Details → Photo and send |
| Nov 15 | Photo grillz | An option under Finish |
| Nov 15 | Control layout | Show selectable prototypes before choosing |
| Nov 15 | Default tooth material | The cream material from version 1; real metal only from the Metal step on |
| Nov 15 | Teeth | Too much space between them. Use the hosted model for shape reference only. |
| Nov 15 | Old moodboard commit | Keep it for now |
| Nov 14 | Concept | Yes, push the blank-canvas prototype further |
| Nov 14 | Room | Stone |
| Nov 14 | Price | A quiet live pill; the full number on the last screen |
| Nov 14 | Proof from jewelers | Parked for v1 |
| Nov 14 | Starting point | Blank canvas: throw away all existing design |
| Nov 14 | Inspiration | Game customisers, not grillz sites |

## Open questions

**v13, choices I made inside your direction (for your verdict):** the order (builds first, then the AI field at the bottom, where the thumb is and where chat apps put it); the send button shows a sparkle, not an arrow, since you ruled out arrows in buttons; the line under the field, "3 free AI builds per phone. We text you a code first."; on the sign-up, their message shown above the approved words; in the conversation, the composer replaces the approved line "Or add a picture: a photo or a screenshot" (the camera inside the field does that job now).

**Still without a slide (small):** after a build, the stage note is headed "AI built it" and shows what it built, the first difference and Undo for about 10 seconds; the heading when they come back is "Keep talking", with "2 of 3 free builds left on this phone. Every build counts, small changes too." under the button. The start page v12 is mine to answer for (you asked me to pick): say if the three doors or the one-tap builds don't sit right.

For when you have tested version 5. I will ask these as slides:

- [ ] Does the bench (the new controls) work for you, or do you want a different layout?
- [ ] Are the tooth shapes, gaps and the holder right now?
- [ ] Stones, bezels and sparkle: close enough to the reference?
- [ ] The charms: right set, right level of detail?
- [ ] Next: keep refining the prototype, or start wiring it into the real app?

## Product scope

VVS Lab is software a grillz jeweler rents for $199 a month: their customers design a piece in 3D, and the jeweler gets a priced order request.

| Surface | Who uses it | Whose brand | What it does |
| --- | --- | --- | --- |
| Builder | The jeweler's customer | The shop's | Design a grill in 3D and see the shop's price. Opened from the shop's Instagram bio, site or own domain. |
| Photo and request | The jeweler's customer | The shop's | A studio photo of the design, then name, contact, fit choice and an optional deposit. |
| Shop console | The jeweler | VVS Lab | Requests with the full spec, prices and options, branding, deposits, team. |
| Front door | The jeweler | VVS Lab | Where a jeweler meets it, tries the builder and starts a 14-day free trial. |

The redesign covers the builder, the photo and request, and the front door. The shop console is out of scope for now.

## Builder flow

Five steps in the order you approved, grouped the way a customer thinks rather than one question per screen. Every step starts with a choice already made, so Next always works.

| Step | What the customer decides | Options | Material on the teeth |
| --- | --- | --- | --- |
| 1. Teeth | Which teeth, and fangs | Tap teeth on the model; common sets (top 6, bottom 6, 6 + 6, 8 + 8, full); fangs on the canines | Cream default |
| 2. Metal | Colour, then karat | Yellow, white or rose gold; silver; 10K, 14K or 18K | Real metal from here on |
| 3. Finish | The look | Solid, open face, diamond cut, diamond dust, engraving, opals, photo grillz, iced. Iced opens stones (moissanite, lab, natural) and setting (honeycomb, mosaic, prong) in the same step. | Metal |
| 4. Details | Optional extras; skippable | Deep or perm cut, initials on a tooth, an inspiration photo | Metal |
| 5. Photo and send | Keep it and send it | Studio photo, full price breakdown, name and Instagram or phone, fit (in store, mailed kit, own mold), optional deposit, share card | Metal |

Sources for the option list: the main-branch builder and the Gold Mouf Dog configurator. Per-tooth mixing (one tooth different from the rest) comes from the main branch and has no step yet; see Open questions.

## Prototype architecture

The prototype is one HTML page for agreeing the direction; once you sign off, it is rebuilt inside the real app.

&#91;embedded content: prototype architecture · one page, one 3D scene\]

The metal reflects its own lighting, separate from the room, which is why gold reads as gold. Iced and diamond cut are surface effects on the metal, not extra geometry.

## References

The builder takes its patterns from game customisers; the two grillz builders supply the option list but not the UX.

| Reference | What we take | What we avoid |
| --- | --- | --- |
| Gran Turismo, Forza, Rocket League | The showroom: one object under studio light, turning slowly when idle |  |
| The Sims 4 Create-a-Sim | Touch the part itself to change it |  |
| Fortnite locker, Rocket League garage | Every part shows its current choice at a glance |  |
| NBA 2K, Cyberpunk 2077 | Start from a preset, with a shuffle |  |
| Forza upgrades, Armored Core | Show the difference per option (+$380), not just a total |  |
| Gran Turismo Scapes, Spider-Man | Photo mode as the reward at the end |  |
| GTA (your note) | Metal that reads as the real material without being hyper-real |  |
| Nike By You | Product on top, one row of options, every part pre-chosen |  |
| [Gold Mouf Dog configurator](https://goldmoufdogandco.com/configurator) | Its option list: type, metal, teeth, fangs, style, setting, cut, stones | Eight text-only screens with no live preview; an embedded third-party form (jewlx.ai); metal asked before teeth |
| Main-branch builder | The fullest option list: per-tooth mixing, initials, inspiration photo, fit, deposit | Dense panels, step 1 is tooth counting, competing buttons |
| Hosted 3D teeth model | Tooth proportions only (width, height, depth per tooth) | Its look: the plaster jaw, the flat light |

Added Nov 15: your four reference photos of a custom set on a clear resin mold (from an Instagram reel by kabilsgrillz). What we take: the clear holder, the rounded pillowy caps, honeycomb-set stones, enamel colour, bezel-set gems and sculpted charms. What we avoid: the Harry Potter characters themselves, which are licensed.

## Change log

| Date | Round | What changed |
| --- | --- | --- |
| Next | Wiring | Port the 3D and the strip into the real app; re-tune the AI photo for the new model |
| Nov 17 | Creator Lab v13: one AI field | The start page: heading and builds (Build it yourself as the first tile, one tap into the builder), a hairline "or let AI build it", then the composer: text on top, a camera and a sparkle send button below, a picture shown as a thumbnail inside it with ×. Under it: "3 free AI builds per phone. We text you a code first." Typing there and sending skips the describe screen and goes straight to the sign-up (their words shown on top) or, on a verified phone, straight to the build. The AI conversation ends in the same composer, with Back beside it |
| Nov 17 | Creator Lab v12: the start page | Three ways in as doors (the Thumb and two lines on a computer, an icon and a name on a phone), then the popular builds, one tap into the builder. The empty-start CTA is gone; Continue your build appears only when a build is waiting. v11's chips-beside-Start-empty layout kept behind a switch |
| Nov 17 | Creator Lab v11: the AI path | "Describe it" and "From a picture" as two chips on the start page and a "Describe it" tool on the stage. The conversation screen: a box, a picture (photo or screenshot), then the reply as a Row ("Built it" or "Built the closest match", with what's different). The sign-up in the same fields as sending, with the reason said plainly; the code screen reused; a phone verified here skips the code when sending. 3 free builds per phone, counted on the device, every reply counting; when they're used up, "Keep editing by hand". The AI's note on the stage with Undo, and the Undo tool steps back over the build too. Their words and picture travel to the jeweler as "their idea". A word matcher over the shop's own options stands in for the AI. Also removed: the unused stacked-sheet, expand-in-place, stages, steps-layout, full-screen-opening and start-questions code |
| Nov 17 | Creator Lab v8 to v10 | v8: shared pieces (Row, Thumb, section, footer), one screen to send, Undo and Select teeth on the stage. v9: three builder structures to compare. v10: the build strip chosen, with Back and Next, progress in the rings, the count under the buttons |
| Nov 16 | 4.2: the piece in the real app | The approved teeth, holder, metals, finishes and stones rebuilt inside the real builder, driven by its own options and prices, with the whole piece in view. Build, lint and 272 tests pass. Still to do: new opening stills and option pictures, a real-phone speed check (the piece is far more detailed than before), and re-tuning the AI studio photo for the clear holder |
| Nov 16 | Flow lab, versions 1 to 3 | A clickable, low-fidelity prototype of the shopper's flow options, revised from your comments: build it yourself by default, AI behind a free phone sign-up, popular sets, Custom, single-tooth changes, and an optional Instagram and Follow step |
| Nov 16 | 4.1: real teeth (version 6) | Teeth rebuilt from the hosted model's crowns, smoothed; neighbours seated to touch; natural bite with a 1.6 mm overbite; scalloped gum line; caps, stones, rims, panels and charms laid out on each tooth's real face. Nothing else changed. |
| Nov 15 | 4: end to end (version 5) | New controls (the bench) with live-rendered option pictures; five steps with every option and price rule of the live demo shop: five metals, karats, plain, iced and photo, six styles, opal colours, three settings, three stones, iced open face, fangs, deep cut or permanent look, initials, a written idea, an inspiration photo, fit, promo code; review, send, deposit and share card; the jeweler's view of the request; front door with a short scroll and a three-field sign-up; view buttons; the design is kept between visits |
| Nov 15 | 3.1: fixes (version 5) | Flat-topped holder block; fuller caps with an arched edge and a lip; teeth re-seated so they touch; smaller stones packed edge to edge in a thin rim, with star glints that move as the piece turns; diamond cut as crisp facets; the reference charm set made from scratch (crest, emblem, winged orb, crown, hat, broom, owl, two potions, sapphire) |
| Nov 15 | 3: the 3D (version 3) | Clear resin holder with a dial; rounder teeth; cream default caps; set stones in bezels; first charm set; tap a tooth to change just that one |
| Nov 15 | Blank canvas v2 | Sculpted teeth generated in code; jeweler's lighting for the metal; mouth opens and closes; Stone room only |
| Nov 14 | Blank canvas v1 | Fresh start: the piece on a stage, front door and builder on one screen |
| Nov 14 | Rounds 1 and 2 (discarded) | Moodboard, audit, mood comps and flows. Built on the old brand. |
