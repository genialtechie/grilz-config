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
ones say why. The switcher now compares two looks for the menu: game-like
(cards, icons, live previews) and jeweler-like (a quiet list on hairlines).

`creator.html` is the built page. `src/` holds its parts; run `python3 build.py`
inside `src/` to rebuild (it writes `creator.html` and `engine.js` there).
The 3D parts are the prototype's (see `../prototype/`), with a camera move per
category and the selected-tooth glow added in `40-scene.js`.
