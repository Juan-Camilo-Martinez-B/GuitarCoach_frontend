import { AlphaTabApi, LayoutMode, PlayerMode, synth, type model } from "@coderline/alphatab";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { defaultTrack, isGuitarTrack, type TrackInfo } from "./tabFile";
import { trackInfo } from "./trackInfo";

const BASE = import.meta.env.BASE_URL;

export interface TabState {
  /** El soundfont terminó de cargar y la partitura se puede tocar. */
  ready: boolean;
  playing: boolean;
  tracks: TrackInfo[];
  track: number;
  title: string;
  artist: string;
  tempo: number;
  current: number;
  total: number;
  error: string;
}

const INITIAL: TabState = {
  ready: false,
  playing: false,
  tracks: [],
  track: 0,
  title: "",
  artist: "",
  tempo: 0,
  current: 0,
  total: 0,
  error: "",
};

/** Solo suena la guitarra elegida: voz, bajo y batería del archivo quedan en silencio. */
function onlyGuitar(instance: AlphaTabApi, tracks: model.Track[], chosen: number): void {
  for (const track of tracks) {
    track.playbackInfo.isMute = track.index !== chosen;
    track.playbackInfo.isSolo = false;
  }
  instance.changeTrackMute(
    tracks.filter((track) => track.index !== chosen),
    true,
  );
  instance.changeTrackMute(
    tracks.filter((track) => track.index === chosen),
    false,
  );
}

/**
 * Monta alphaTab dentro de element: dibuja la tablatura y la toca con el soundfont,
 * con el cursor siguiendo cada nota. Las notas son las del archivo, sin inventar nada.
 */
export function useAlphaTab(
  element: RefObject<HTMLElement | null>,
  viewport: RefObject<HTMLElement | null>,
) {
  const api = useRef<AlphaTabApi | null>(null);
  const [state, setState] = useState<TabState>(INITIAL);

  useEffect(() => {
    const host = element.current;
    if (!host) {
      return;
    }
    const instance = new AlphaTabApi(host, {
      core: { fontDirectory: `${BASE}font/` },
      display: { layoutMode: LayoutMode.Page },
      player: {
        playerMode: PlayerMode.EnabledSynthesizer,
        soundFont: `${BASE}soundfont/sonivox.sf2`,
        scrollElement: viewport.current ?? undefined,
        enableCursor: true,
        enableAnimatedBeatCursor: true,
        enableElementHighlighting: true,
      },
    });
    api.current = instance;
    const patch = (next: Partial<TabState>) => setState((previous) => ({ ...previous, ...next }));

    instance.scoreLoaded.on((score) => {
      const all = score.tracks.map(trackInfo);
      const chosen = defaultTrack(all);
      // El selector ofrece solo guitarras; si el archivo no trae ninguna, la pista elegida.
      const guitars = all.filter(isGuitarTrack);
      const tracks = guitars.length > 0 ? guitars : all.filter((item) => item.index === chosen);
      patch({
        tracks,
        track: chosen,
        title: score.title,
        artist: score.artist,
        tempo: score.tempo,
        current: 0,
        error: "",
      });
      const guitar = score.tracks.find((item) => item.index === chosen);
      onlyGuitar(instance, score.tracks, chosen);
      if (guitar) {
        instance.renderTracks([guitar]);
      }
    });
    instance.playerReady.on(() => patch({ ready: true }));
    instance.playerStateChanged.on((event) =>
      patch({ playing: event.state === synth.PlayerState.Playing }),
    );
    instance.playerPositionChanged.on((event) =>
      patch({ current: event.currentTime, total: event.endTime }),
    );
    instance.error.on(() =>
      patch({ error: "No se pudo leer la tablatura. Prueba con otro archivo o formato." }),
    );

    return () => {
      instance.destroy();
      api.current = null;
    };
  }, [element, viewport]);

  const load = useCallback((bytes: ArrayBuffer) => {
    const instance = api.current;
    if (!instance) {
      return;
    }
    instance.stop();
    setState((previous) => ({ ...previous, error: "", tracks: [], current: 0, total: 0 }));
    if (!instance.load(new Uint8Array(bytes))) {
      setState((previous) => ({ ...previous, error: "Ese archivo no es una tablatura legible." }));
    }
  }, []);

  const selectTrack = useCallback((index: number) => {
    const instance = api.current;
    const track = instance?.score?.tracks.find((item) => item.index === index);
    if (!instance || !track) {
      return;
    }
    instance.stop();
    onlyGuitar(instance, instance.score?.tracks ?? [], index);
    instance.renderTracks([track]);
    setState((previous) => ({ ...previous, track: index }));
  }, []);

  const playPause = useCallback(() => api.current?.playPause(), []);
  const stop = useCallback(() => api.current?.stop(), []);

  const setSpeed = useCallback((speed: number) => {
    if (api.current) {
      api.current.playbackSpeed = speed;
    }
  }, []);

  const setLooping = useCallback((loop: boolean) => {
    if (api.current) {
      api.current.isLooping = loop;
    }
  }, []);

  const setMetronome = useCallback((on: boolean) => {
    if (api.current) {
      api.current.metronomeVolume = on ? 1 : 0;
    }
  }, []);

  const setCountIn = useCallback((on: boolean) => {
    if (api.current) {
      api.current.countInVolume = on ? 1 : 0;
    }
  }, []);

  return {
    state,
    load,
    selectTrack,
    playPause,
    stop,
    setSpeed,
    setLooping,
    setMetronome,
    setCountIn,
  };
}
