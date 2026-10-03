export function movingMedian(values: number[], window: number): number[] {
  if (window < 1) {
    throw new Error("La ventana de la mediana debe ser positiva.");
  }
  return values.map((_, index) => {
    const slice = values.slice(Math.max(0, index - window + 1), index + 1).sort((a, b) => a - b);
    return slice[Math.floor(slice.length / 2)];
  });
}
