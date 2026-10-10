import type { ChatMessage } from "../domain/chat.ts";

export type { ChatMessage };

export interface LoadProgress {
  /** 0..1 */
  fraction: number;
  text: string;
}

export type Support = { ok: true } | { ok: false; reason: string };

/** An on-device chat model. */
export interface LanguageModel {
  /** Whether this device can run the model at all (e.g. WebGPU present). */
  checkSupport(): Promise<Support>;
  /** True when weights are already stored locally, i.e. it will work offline. */
  isCached(): Promise<boolean>;
  /** Downloads (first time) and initialises the model. Idempotent. */
  load(onProgress: (p: LoadProgress) => void): Promise<void>;
  /** Streams answer text chunks. Requires load(). */
  stream(messages: ChatMessage[]): AsyncIterable<string>;
  /** Human-readable model id, for the UI and the write-up. */
  readonly modelName: string;
}
