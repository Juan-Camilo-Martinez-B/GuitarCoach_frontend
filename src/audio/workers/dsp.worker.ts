import { yinPitch } from "../dsp/yin";

export interface PitchRequest {
  type: "pitch";
  samples: Float32Array;
  sampleRate: number;
}

export interface PitchResponse {
  type: "pitch";
  frequency: number | null;
}

export function handleDspMessage(message: PitchRequest): PitchResponse {
  return { type: "pitch", frequency: yinPitch(message.samples, message.sampleRate) };
}
