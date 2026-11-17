# Case study notes

Working notes for a portfolio case study of the VVS Lab redesign: what was made, why, and what changed along the way. Added to after every round. Screenshots for each version are in the repo under `docs/redesign/case-study/`, named by date and version.

## The project

VVS Lab is a 3D custom grillz builder that jewelers put on their own website. A customer designs a set (teeth, metal, finish, stones, extras), sees the price as they go, and sends the design to the jeweler with a studio photo, often with a deposit. Jewelers pay $199 a month after a 14-day trial. It is a Magpollo product with its own brand.

The redesign started Nov 14, 2026. The owner leads on taste and UX; Claude works as the design and engineering partner, building each idea as a working prototype rather than static mock-ups.

## Goals

- **Original brief (Nov 14):** redesign with a product designer's eye, UX first, with the best marketing thinking. Covers the front door, the builder ("step by step building that keeps users engaged and is understandable") and the brand.
- **Added Nov 16:**
  - A customer can make a custom grill order in under two minutes.
  - A hybrid site that sells to shop owners and to customers alike, and collects data on which should be the main lane.
  - Aesthetically pleasing, senior-level work.

## Timeline

| Date | Round | What was made | The owner's verdict | What it taught |
| --- | --- | --- | --- | --- |
| Nov 14 | 1. Moodboard and audit | Best-in-class grillz sites and configurators, an audit of the live product, user flows | "Don't get too stuck on grillz websites… look at games with customizing capabilities" | The category's own sites were not built by product designers. The benchmark is game character creators |
| Nov 14 | 2. Mood comps | Comps on the existing brand | "Blank canvas completely. Throw all the design we currently have away" | Start from the product's purpose, not from its current look |
| Nov 14 | Blank canvas, version 1 | The piece alone on a stage; the front door and the builder on one screen; three rooms to choose from | The Stone room chosen. The teeth must not "phase into each other"; metal must look like the real material "even if graphic" | The 3D is the product. Materials and form carry the brand |
| Nov 15 | Version 2 | Teeth sculpted in code; a jeweler's light for metal; the mouth opens and closes | "Too much space in between"; keep the earlier cream look as the default | A default that is not yet metal makes the metal step a reveal |
| Nov 15 | Process fix | A living plan page; every question as a one-question slide | "I need visibility because I am the one with taste here" | Make the work legible to the person who owns the taste |
| Nov 15 | Version 3 | A clear resin holder at 70% solid, set stones in bezels, one-of-one charms | The holder's top should be flat like a real case; the teeth edges read hollow; stones don't sparkle enough; bezels too thick | Study the references closely: proportion is the whole job in jewelry |
| Nov 15 | Version 5 (overnight, autonomous) | The whole journey end to end: front door, sign-up, a five-step builder with every live option and price, review, send, deposit, share card | "I absolutely love the materials, metals and finishes… the job's not finished… focus on the teeth" | Materials approved. The tooth shapes had become the weak link |
| Nov 15 to 16 | Version 6: the teeth | Teeth rebuilt from the live product's own 3D model, smoothed, seated and closed into a real bite | "The teeth are perfect" | Measure before sculpting: the existing asset already held the right proportions |
| Nov 16 | Full plan | Every module of both journeys, mapped from the real code | New goals added (above) | Scope the whole journey before polishing more of one screen |
| Nov 16 | Flow lab | A low-fidelity, clickable prototype of the shopper's flow options, with notes on every screen listing the open choices | Comments on the page itself: building it yourself is the default; AI visible but behind a free sign-up; popular sets so Next, Next, Next makes a popular grill; a Custom chip; single-tooth changes | Low fidelity keeps the conversation on the flow, not the polish. A verification ask lands better when it unlocks something the shopper wants: the studio photo |
| Nov 16 | The piece in the real app | The approved 3D rebuilt inside the production builder, driven by its real options and prices; every state checked side by side with the prototype | Show the whole piece, like the prototype | A prototype built on the live product's data model ports cleanly: the 3D swapped in without touching the controls, the prices or the server |
| Nov 16 | Sign-up research | Phone verification options and real US costs compared: Firebase, Twilio, WhatsApp, Instagram, email | Firebase text codes, phone required, no WhatsApp; Instagram as an optional handle plus a Follow ask, never a fake check | "Free" phone verification doesn't exist at scale in the US; about $7 a month per 1,000 sign-ups is the honest floor. Growth asks stay honest: a follow can be invited, not passed off as verification |
| Nov 16 | The UX overhaul: Grill Creator Lab, versions 1 to 5 | The old builder thrown away and rebuilt for a first-timer. A working lab on the real 3D with switchable versions: two openings, two layouts, two ways to guide; tap a tooth and it glows; then a menu in any order with a picture of each choice, and several teeth edited at once | "You are really struggling with what it means to do a UX overhaul" led to the grandma test. Picked: bare teeth with starting builds, an EA FC-style menu, a guide only when stuck. On the menu, three passes: "neither, but lean jeweler", then "zoom out and simplify… the card looks selectable on its own… too many fonts" | Show the full extent of what can be customised without showing everything at once: each row names what's inside and marks what hasn't been opened. Each pass took decoration away (arrows, borders, a second font, a second price) and the rows read as tappable anyway |
| Nov 17 | Creator Lab v6 and the screens after Done | Start empty opens Your build with Teeth marked "Start here"; inside each part the main button leads on ("Next: Metal") with a smaller Back beside it; stages along the top; Undo on the guide's quick question. The three screens after Done planned with the owner, the first one word by word | The owner walked the path a first-timer would take and found the dead end: "Start empty > selects teeth > the next CTA is done. they don't know you can customise other things". Chose both fixes, plus "if something is selected, there should be an undo button, in case they don't like it" | A menu in any order still needs a default path forward. The main button is the one thing a first-timer reads, so it has to lead to the next discovery, not to the exit. An automatic change needs a way back, or a guide feels pushy |
| Nov 17 | Creator Lab v7: after Done | Three screens, each taken through with the owner word by word before building: Your grill (one price, the fitting in plain words), Where should VVS Lab text you (the 6th digit of the code sends it; a verified phone skips the code), Sent (the 3D develops into the studio photo, then deposit, the optional extras, what happens next) | The owner asked what happens on VVS Lab's own site: "VVS Lab only, no partners yet". Chose "Start your order" for the deposit, then swapped its promise for words that are true for every shop | The verification step is the send button, so the gate costs no extra tap. The optional asks fill the 30-second wait for the photo instead of standing between the shopper and sending. Copy that promises timing or payment terms has to hold for every shop, or it doesn't go in |
| Nov 17 | Creator Lab v8: the design system | One shared Row (words left, round picture right) for the menu, the fitting choices and the steps after sending; matching gold line icons; one screen to send; Undo and Select teeth moved onto the stage | "That's awful design structure and hierarchy… a design system should be slowly built and components reused" | Build the parts first and let every new screen be made of them. Three screens that were designed one by one had drifted apart; one Row pulled them back |
| Nov 17 | Creator Lab v9 and v10: the builder's structure | Three structures to compare on the real 3D (a stacked sheet, expand in place, a build strip), each with an Up-next hint or a Next button; then the strip built out with Back, progress in the rings and the count under the buttons | "The your build page is the thing that made the UX the best, but… it barely ever gets seen." Chose the strip; no arrows in buttons; "we need to get creative with" the progress bar, so parts not opened yet wear a gold ring like an unseen story | The best screen is worthless if the path skips it. Pinning it on top, five round pictures, keeps it in view on every step. Progress can live inside the component instead of on top of it |
| Nov 17 | Creator Lab v11: the AI path | "Describe it" and "From a picture" on the start page and as a tool on the stage; a conversation that builds the closest version in the 3D and says what's different, with Undo; the phone sign-up first, with the reason said plainly; 3 free builds per phone. A word matcher stands in for the AI | Eight slides: rings and count confirmed; AI as a tool on the stage; one box then keep talking; 3 free builds, every reply counts; say why plainly; a photo or screenshot; the closest match | A paid feature can sit behind a sign-up without feeling like a wall if the reason is honest and the limit is stated up front. "Closest match, say what's different" keeps the AI useful when the catalogue says no. The same phone verification serves the AI gate and the send, so the gate costs no extra tap later |

## Key decisions and why

- **Games as the benchmark, not competitors.** Character creators make many choices feel like play, with the result always on screen. Grillz sites read as shops with a form.
- **The builder is the front door.** From the owner's first answers: "is the landing page that necessary to be bloated?" One screen with the live piece, plus a short scroll.
- **Cream first, metal on "Next".** The opening piece is a soft cream; metal arrives at the Metal step, which makes it a moment.
- **A clear holder, about 70% solid.** It comes from real reference photos of a grill on a clear mold. It reads as a jeweler's display case, and it gives the teeth context without showing gums.
- **One-of-one charms, quoted by the shop.** A premium tier that lifts the average order and lets the builder show pieces as rich as the references. Every charm was drawn from scratch so it resembles no copyrighted character.
- **Tap a tooth, then choose.** Per-tooth styling without a second mode.
- **A masculine default set.** At the owner's direction.
- **The live product's options and prices, unchanged.** The prototype doubles as the build spec, and every number in it is real.
- **The live product's tooth shapes, cleaned up.** After several hand-sculpted rounds, the owner judged the existing model's shape and spacing more realistic. The fix was to measure and refine it, not to keep sculpting.
- **The front door as a live experiment (Nov 16).** One site speaks to shoppers and jewelers side by side. Which door visitors pick, and how far each lane gets, decides the company's main lane, so the redesign doubles as a market test.
- **A partner jeweler makes direct orders (Nov 16).** Real orders from day one without VVS Lab running a workshop; VVS Lab can take a referral fee.
- **The journey ends at the deposit, with a clear "what happens next" (Nov 16).** Custom grillz are priced finally after the fit, so taking full payment up front would be wrong for the product. The timeline answers "what now?" instead.
- **Two minutes as the design budget (Nov 16).** Every screen is judged by whether it helps a shopper send an order in under two minutes. A one-tap look makes a complete, priced design first; everything else becomes optional.
- **AI behind an honest gate (Nov 16 and 17).** Building it yourself stays the default and free. The AI paths are visible from the first screen but cost money per reply, so they come after a free phone sign-up that says why in plain words, with 3 builds per phone and every reply counting. The AI never refuses: it builds the closest thing the shop sells and says what's different.
- **Progress inside the component (Nov 17).** No progress bar over the build strip. A part not opened yet wears a gold ring, the open part a black one, and the count sits where the decision to finish is made, under Back and Next.

## Craft notes

- **Materials.** Four lighting set-ups, each tuned to one material class: a studio for the clear holder, a bright room for the cream default, a jeweler's light tent for metal, and a room full of small hot lights for the stones. One shared room made yellow gold read silver.
- **Clear resin.** Drawn in two passes, with an edge glow that turns solid where it catches light. A dial runs it from clear to milky.
- **Stones.** Small faceted stones packed edge to edge inside a thin gold rim, with star glints that move as the piece turns.
- **Teeth.**
  - The live model was stored tilted open (10 degrees top, 7 bottom) and turned 4 degrees to one side. Stood upright, it is exactly symmetric.
  - Neighbouring teeth overlapped by up to 1 mm; they were re-seated to just touch.
  - The faceted surfaces were smoothed with two rounds of subdivision.
  - The bite was closed with a 1.6 mm overbite and enough clearance that caps and stones never meet.
  - A scalloped gum line arcs over each tooth.
- **Everything follows the tooth.** Caps, rims, stones, photo panels, letters and charms are laid out on a map of each tooth's real face, so they fit any shape.
- **Option pictures are the real 3D.** Each tile is rendered live from the same model, never drawn separately.
- **No files to load.** The whole 3D scene is generated in code, so the prototype is one page.
- **The AI's stand-in.** In the prototype a word matcher reads the shopper's sentence against the shop's own options: counts and rows, metals and karats, finishes, stones and settings, fangs, letters, two-tone. Anything outside the catalogue (rubies, black gold, 24K, charms, a chain) becomes the closest match plus a line saying so, which is the behaviour the real model will be asked for.
- **A glow that sits above the gums.** A picked tooth gets a soft amber shell that pulses. The first version sank into the clear holder ("it kinda phases into the gums"), so it is now drawn in its own pass after the scene: the holder is ignored, but other teeth still hide it, so it reads as a layer on top of the gums.

## Process and working agreements

- The owner leads taste and UX. Plans are shown and approved before building.
- Questions come one per slide, each with a recommended answer.
- A living plan page holds decisions, the change log and open questions.
- Every round is a working prototype at one stable link, with version history.
- All work lives on a separate `redesign` branch; the live site is untouched until the owner says otherwise.
- For any new service, try the simple, free path first and recommend with the trade-offs.
- **The owner directs every flow (Nov 16).** After an outline was approved, a full version of the shopper's journey was started without walking the owner through it, and two earlier decisions were quietly changed. The owner stopped it: "you are not one shotting the customer journey and ux flows, you need to run that by me, i know better". From then on: a clickable low-fidelity flow lab first, then selectable versions of each screen, and nothing built as final until picked. A good case-study beat on how the collaboration worked.
- **Three ways to start, from the owner (Nov 16).** Describe it to AI, start from a picture and let AI build the closest version, or build it yourself. And a new goal: a verified, contactable phone before the studio photo, while the builder and price stay free.

## Numbers to capture (open)

- **Time to order.** The live product today versus the redesign, from opening the builder to sending. Target: under two minutes. The live product already logs both events.
- **The lane test.** On the hybrid front door: how many visitors choose "design a grill" versus "for jewelers", and how many of each go on to send a design or start a trial.
- **Before and after.** The live builder versus the final redesign, on desktop and phone.
- **Quality.** Speed on real phones; studio photo accuracy on the new model.
