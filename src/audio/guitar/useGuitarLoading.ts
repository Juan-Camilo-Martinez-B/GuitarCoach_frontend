import { useSyncExternalStore } from "react";
import { isGuitarLoading, subscribeGuitarLoading } from "./loadingStatus";

export function useGuitarLoading(): boolean {
  return useSyncExternalStore(subscribeGuitarLoading, isGuitarLoading, () => false);
}
