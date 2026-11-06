import type { model } from "@coderline/alphatab";
import type { TrackInfo } from "./tabFile";

export function trackInfo(track: model.Track): TrackInfo {
  return {
    index: track.index,
    name: track.name,
    staves: track.staves.map((staff) => ({
      isPercussion: staff.isPercussion,
      showTablature: staff.showTablature,
      tuning: staff.tuning,
    })),
  };
}
