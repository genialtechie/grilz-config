# Grill Creator Lab

The start of the UX overhaul of the builder (Nov 16), built on the approved 3D
engine. It is a comparison tool for the owner, not the final design: a
switcher (top right) flips between the options the owner asked to see.

- **Opening:** bare teeth with a row of starting builds, or a full screen of
  starting builds. Either way: start empty, or from a build you can change.
- **Layout:** an EA FC-style menu you can open in any order, or guided steps
  you can jump between.
- **Guiding:** a guide that asks one question when you seem stuck (or the build
  is empty), or questions only at the start.
- **One tooth:** tap it on the 3D; it gets an amber glow and every change
  applies to that tooth until "Whole set".
- Jeweler terms are kept, as the owner chose.

Chosen on Nov 16: the bare-teeth opening, the EA FC-style menu and the guide
when stuck. The menu now says what each tab holds, marks tabs not opened yet,
and shows a progress bar; inside a tab every option stays visible and locked
ones say why. Second pass (owner: neither look, lean jeweler, closer to the earlier rows):
calm rows that clearly read as buttons, a picture of what's chosen, one price
only (in the top bar). Several teeth can be edited at once: tap them on the 3D
(each glows) or pick a quick group (top row, bottom row, front teeth, canines,
every other). When teeth differ, the menu stacks their pictures with a count.
Third pass (owner: zoom out and simplify): round pictures like the earlier rows,
no arrow and no grey border on the rows (they read as tappable without them),
one type family throughout, and a small gold dot instead of "Not opened yet".
Nov 17 (owner's notes on the dead end after Start empty): Start empty opens Your
build with Teeth marked "Start here"; inside each part the main button leads on
("Next: Metal", and "Done" on Extras) with a smaller Back beside it; stages along
the top (current part bold, visited ticked, tap to jump); and the guide's quick
question shows what changed with an Undo for about 6 seconds.

`creator.html` is the built page. `src/` holds its parts; run `python3 build.py`
inside `src/` to rebuild (it writes `creator.html` and `engine.js` there).
The 3D parts are the prototype's (see `../prototype/`), with a camera move per
category and the selected-tooth glow added in `40-scene.js`.

After Done (v7, Nov 17), each screen taken through with the owner first:
1. **Your grill.** "This is your grill", one price ("About $2,000", the list
   on tap), the fitting asked in plain words, "+ Add a note or promo code",
   and "Send to VVS Lab" with "Free. Nothing to pay yet." beside a smaller
   "Keep editing".
2. **Where should VVS Lab text you?** First name and phone, then the code
   opens in place; the 6th digit sends. A phone verified on this device skips
   the code.
3. **Sent.** The 3D fades as the studio photo develops in its place, then
   "Start your order" (optional deposit), a card for Instagram, Follow and
   email, and What happens next.

The prototype switch "Opened from" flips between VVS Lab's own site (VVS Lab
texts; no in-store fitting yet) and a jeweler's builder (Gold Lab). Nothing is
sent: the code, the deposit and the AI photo are simulated, and say so.

v8 (Nov 17, after the owner's review: "a design system should be slowly built
and components reused"). Shared pieces now: the **Row** (words left, round
picture right; the menu, the fitting choices, the steps after sending), the
**Thumb** (a 3D render, a swatch, a diagram or one of the gold icons), the
**section** (one title, then rows or fields), the **footer** (a smaller
secondary button beside the main one), chips, fields and the stage tools.
After Done is now one screen to send (price, fitting, first name and phone),
then the code, then Sent; no stages on those screens. On the stage: Undo next
to Turn (any change), and the Change chips beside the mouth tools.

v9 (Nov 17): the owner felt Your build, the best part of the UX, was barely
seen once people went step by step. Three structures to compare, all with
the stages row and the Next-through-parts flow removed: **Stacked sheet** (a
part opens as a sheet over Your build; on a computer, as a second panel beside
it), **Expand in place** (a part opens inside its own row), **Build strip**
(the five round pictures pinned on top, the part below). Each pairs with
**Up next on Your build** or **a Next button**. Switch them in the prototype
panel (top right).

v10 (Nov 17): the owner chose the **build strip**. The five round pictures
stay pinned on top; the open part sits below. The main button says "Next"
("Done" on the last part); the smaller "Back" returns to the screen you were
on, and from the first screen to Start your build, where the button becomes
"Continue your build". No arrows inside buttons. Progress lives in the strip:
a part not opened yet wears a gold ring, like an unseen story, and the count
sits under the buttons. "Select teeth" is a toggle on the stage (bottom right
on phones, beside Undo on computers, above the tools when there is no room).
Undoing a quick-question answer brings the question back.

v11 (Nov 17): the rings confirmed, so the stacked-sheet, expand-in-place,
stages, steps-layout, full-screen-opening and start-questions code is gone.
The **AI path**, from the owner's eight slides: "Describe it" and "From a
picture" are two chips on the start page beside Start empty, and "Describe it"
is a tool on the stage once building. The screen is a conversation: a box, an
optional picture (a photo or a screenshot; no Instagram links, which can't be
read), then each reply as a Row ("Built it" or "Built the closest match", with
what's different). Before the first build, the sign-up says why, plainly, in
the same fields as sending; the code screen is reused, and a phone verified
here skips the code when sending. 3 free builds per phone, counted on the
device, every reply counting; after that, "Keep editing by hand". The AI's
note sits on the stage with Undo, and the Undo tool steps back over the build
too. Their words and picture go to the jeweler as "their idea". In this
prototype `wish()` in `50-ui.js`, a word matcher over the shop's own options,
stands in for the AI, and the page says so.

v12 (Nov 17): the owner approved the v11 words and, on where the AI entries
sit, asked for the best answer "even if it means redesigning the start empty
screen". The start page is now three equal ways in (Describe it, From a
picture, Build it yourself: the shared Thumb with two lines on a computer, an
icon and a name on a phone), then the popular builds, which open the builder
in one tap. The "Start empty" button is gone; "Continue your build" appears on
top only when a build is waiting. The v11 start page stays behind the
"Start page" switch in the prototype panel, to compare.

v13 (Nov 17) tried two ways to split the lanes; the owner preferred v6's
front door instead and asked for words that appeal to both audiences.

v14 (Nov 17): **the front door** is v6's layout in front of today's builder.
The piece cycles through the popular builds, its name and price above
"Design your grillz in 3D."; one line for "Getting grillz?" and one for
"Making grillz?"; "Design your grillz" opens the start page and "Start free as
a jeweler" goes to the sign-up page. Below: "What happens when you hit send" with the example
request on a phone, the price (two versions behind the "Price section"
switch), and two question lists, Getting grillz and Selling grillz. The logo
returns home. The code is one block in `50-ui.js` ("the front door") plus the
front-door styles in `page.html`; test plan `l` walks it.

v15 (Nov 17, the AI chat): the owner wasn't set on v12 and pointed the way: AI users
expect a text field, so "Start your build" with its builds, OR one AI field
with a camera inside it, "Describe your grillz or upload inspiration". The
**composer** is a new shared piece: text on top, a camera and a sparkle send
button below (no arrow, per the no-arrows rule), a picture as a thumbnail
with ×, Enter to send, the field growing to five lines. It sits at the foot
of the start page and at the foot of the AI conversation, with Back beside
it there. Sending from the start page skips the describe screen. v12 and v11
stay behind the "Start page" switch.
