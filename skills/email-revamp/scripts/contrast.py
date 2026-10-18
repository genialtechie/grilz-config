#!/usr/bin/env python3
"""WCAG contrast check for an email palette.

Usage:
  python contrast.py PAGE TEXT [label=FG ...]
  python contrast.py '#fbf7f0' '#1b1714' link=#b02f45 highlight=#ce4257 button-text=#ffffff:#ce4257

Each extra pair is label=FOREGROUND, or label=FOREGROUND:BACKGROUND when the
background isn't the page (e.g. button text on the button). Prints the ratio
and whether it meets AA for body text (4.5:1) and large text (3:1).
Run it once for the light palette and once for the dark one.
"""
import sys


def luminance(hex_colour: str) -> float:
    h = hex_colour.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    channels = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 1
    page, text, *pairs = argv
    checks = [('text', text, page)]
    for pair in pairs:
        label, _, colours = pair.partition('=')
        fg, _, bg = colours.partition(':')
        checks.append((label, fg, bg or page))
    for label, fg, bg in checks:
        r = ratio(fg, bg)
        verdict = 'AA body' if r >= 4.5 else 'AA large only' if r >= 3 else 'FAILS'
        print(f'{label:<14} {fg} on {bg}: {r:4.2f}:1  {verdict}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
