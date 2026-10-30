type Listener = () => void;

let pending = 0;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function trackLoading<T>(work: Promise<T>): Promise<T> {
  pending += 1;
  emit();
  return work.finally(() => {
    pending -= 1;
    emit();
  });
}

export function isGuitarLoading(): boolean {
  return pending > 0;
}

export function subscribeGuitarLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
