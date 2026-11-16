# Shopper Flow Lab

A clickable, low-fidelity prototype for comparing how a shopper gets from the
front door to a sent order and a deposit. Grey boxes stand in for the 3D and
the studio photo; the AI steps are simulated. It is a review tool for the
owner, not a design to build from: every screen lists the choices still open.

`flow-lab.html` is the published page (a fragment: styles, markup, script).
The live copy is a private Claude artifact; ask the owner for the link.

What it shows (version 2, Nov 16, after the owner's comments):
- Building it yourself is the default: "Start designing" goes straight to Teeth.
- Popular sets fill every step in one tap; later steps arrive set to popular
  choices, so Next, Next, Next gives a popular grill.
- A "Custom" chip selects itself when teeth are tapped one by one.
- Single teeth can be changed on the Metal and Finish screens by tapping them.
- Letting AI build it (from a description or a picture) is visible to all but
  needs a free sign-up first, because AI costs money per use.
- One sign-up (name and a phone verified by text) unlocks AI, the studio
  photo, sending to the jeweler and the deposit; nobody is asked twice.
- After the code, an optional Instagram handle and a "Follow @vvslab" step.
  Nothing is checked and nobody is held back; the jeweler sees the handle as
  given, not verified. (Instagram's tools can't show who followed, so a follow
  can't verify anyone, and the flow never pretends it does.)
