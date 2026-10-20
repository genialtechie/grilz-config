// The stand-in for a logo (MAG-91): initials from the shop name, shown in the
// builder and dashboard until the shop adds its own. "Gold Mouth ATL" → "GM",
// "The Ice Box" → "IB", "Goldie's" → "G".

const SKIP = new Set(['the', 'and', 'of', 'a']);

export function monogram(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 1 || /\d/.test(word))
    .filter((word, _index, all) => !(SKIP.has(word.toLowerCase()) && all.length > 1));
  const letters = words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
  return letters || name.trim().charAt(0).toUpperCase() || '?';
}
