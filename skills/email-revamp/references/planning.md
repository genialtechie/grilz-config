# Planning an email from the smallest form out

Do this for every email before designing it, and write the plan down (in the
repo's docs, so the next person sees why each element is there). Worked plans
for four real emails are in `vvs-lab-example.md` under "Email plans".

## Plan from the smallest form out

Design an email the way a mascot designer starts from the silhouette: get the
smallest form right before adding anything. Write this plan before any layout.

0. **The moment.** What triggered it, who reads it, where they are (usually a
   phone, mid-task), how they feel, and the **one job** the email does for
   them.
1. **The inbox row** (sender · subject · preheader). Most people only ever see
   this. It must deliver the point on its own; the preheader adds a fact the
   subject doesn't have, never repeats it.
2. **The first screen** (about 600px on a phone). Headline, the one visual,
   the one action. If a reader stops here they have what they need.
3. **The details.** Only what helps the reader do the job, ranked.
4. **The reference.** Fine print and footer.

Then audit every element with two questions: **why does this reader need it
now, and what will they do with it?** No answer → cut it. Rules that fall out
of this:

- **Each fact appears once.** No subline repeating the headline, no table
  repeating the spec list.
- **Five sizes only:** headline (44–54px) · hero visual · body (17px) ·
  details (15–16px) · fine print (13px). Importance decides the tier, not the
  data type.
- **No eyebrows or shouty uppercase labels.** The headline says what kind of
  email it is; section labels are quiet sentence case.
- **Don't show state you don't know.** If a deposit may not be paid yet,
  don't list it as if it were.
- **People's own words beat fields.** A customer's note is shown as a quote,
  not a table row.

## Plan template

```
### <Email name> (to <reader>)
- Moment: what just happened, where they are, how they feel.
- Job: the one thing this email does for them.
- Inbox row: <sender> · "<subject>" · preheader "<adds a fact>".
- First screen: headline → the one visual → the one action.
- Details: only what helps the job, ranked.
- Reference (13px): fine print.
- Cut: what was there before and why it went (repeats, state we don't know...).
```

## Gaps the plan exposes

Planning from the reader's job regularly shows the product is missing a step.
On VVS Lab it found two in one pass: the customer was told about a deposit
with no way to pay it from the email (fixed with a signed 30-day pay link),
and the jeweler was never told when a deposit was paid (fixed with a new
email sent from the payment webhook, claimed atomically so two events send
one email). Raise gaps like these with the user and close them; they're often
worth more than the redesign.
