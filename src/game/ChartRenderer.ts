export interface ChordBox {
  symbol: string;
  x: number;
  width: number;
}

export function layoutChart(chords: string[], width: number): ChordBox[] {
  if (chords.length === 0 || width <= 0) {
    return [];
  }
  const boxWidth = width / chords.length;
  return chords.map((symbol, index) => ({
    symbol,
    x: index * boxWidth,
    width: boxWidth,
  }));
}
