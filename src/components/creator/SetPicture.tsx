import type { SetKind } from './model';

const GOLD = '#d9ad45';
const WHITE = '#cfd3d6';
const ICE = '#f4f7f9';

/** A set drawn as two rows of teeth (the lab's setSvg): the builds' cards, the sets and the strip's Teeth picture. */
export function SetPicture({ top, bottom, kind = 'gold' }: { top: number; bottom: number; kind?: SetKind }) {
  const teeth: JSX.Element[] = [];
  [
    [top, 14],
    [bottom, 44],
  ].forEach(([count, y], r) => {
    for (let k = 0; k < 16; k++) {
      const on = k >= (16 - count) / 2 && k < (16 + count) / 2;
      const x = 4 + k * 7;
      const i = k - (16 - count) / 2;
      const key = `${r}-${k}`;
      if (!on) {
        teeth.push(<rect key={key} x={x} y={y} width="6" height="20" rx="2.2" fill="rgba(18,18,17,.09)" />);
        continue;
      }
      const iced = kind === 'iced' || kind === 'fangs';
      const fang = kind === 'fangs' && r === 0 && (i === 0 || i === count - 1);
      const fill = kind === 'tone' && (i === count / 2 - 1 || i === count / 2) ? WHITE : GOLD;
      if (kind === 'open') teeth.push(<rect key={key} x={x + 0.8} y={y + 0.8} width="4.4" height="18.4" rx="2" fill="none" stroke={GOLD} strokeWidth="1.6" />);
      else if (fang) teeth.push(<path key={key} d={`M${x} ${y}h6v13l-3 9l-3 -9z`} fill={ICE} stroke={GOLD} strokeWidth="1" />);
      else teeth.push(<rect key={key} x={x} y={y} width="6" height="20" rx="2.2" fill={iced ? ICE : fill} {...(iced ? { stroke: GOLD, strokeWidth: 1 } : {})} />);
    }
  });
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      {teeth}
    </svg>
  );
}
