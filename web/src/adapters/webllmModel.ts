// Gemma on-device via WebLLM (https://github.com/mlc-ai/web-llm, Apache-2.0).
// Loaded from a CDN at runtime so the app has zero install-time deps; the service worker
// caches the module, and WebLLM caches the weights itself (Cache Storage), so after one
// online "Download" it runs in airplane mode.

import type { ChatMessage } from "../domain/chat.ts";
import { pickGemmaModel } from "../domain/model.ts";
import type { LanguageModel, LoadProgress, Support } from "../ports/languageModel.ts";

/** Pinned major so a breaking WebLLM release can't change behaviour under us. */
export const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm@0.2";

// The slice of the WebLLM API we use. Keeping it narrow documents the dependency.
interface WebLlmEngine {
  chat: {
    completions: {
      create(req: {
        messages: ChatMessage[];
        stream: true;
        temperature: number;
        max_tokens: number;
      }): Promise<AsyncIterable<{ choices: { delta?: { content?: string | null } }[] }>>;
    };
  };
}
interface WebLlmModule {
  prebuiltAppConfig: { model_list: { model_id: string }[] };
  hasModelInCache(modelId: string): Promise<boolean>;
  CreateMLCEngine(
    modelId: string,
    cfg: { initProgressCallback: (r: { progress: number; text: string }) => void },
  ): Promise<WebLlmEngine>;
}

interface GpuLike {
  requestAdapter(): Promise<{ features: { has(f: string): boolean } } | null>;
}

export function webllmModel(moduleUrl: string = WEBLLM_URL): LanguageModel {
  let lib: Promise<WebLlmModule> | null = null;
  let engine: Promise<WebLlmEngine> | null = null;
  let modelId: string | null = null;
  let f16: boolean | null = null;

  const gpu = (): GpuLike | undefined => (navigator as Navigator & { gpu?: GpuLike }).gpu;
  const loadLib = () => (lib ??= import(/* @vite-ignore */ moduleUrl) as Promise<WebLlmModule>);

  async function chooseModel(): Promise<string> {
    if (modelId) return modelId;
    const m = await loadLib();
    const ids = m.prebuiltAppConfig.model_list.map((x) => x.model_id);
    const picked = pickGemmaModel(ids, { supportsF16: f16 ?? true });
    if (!picked) throw new Error("No Gemma build small enough for this device is available in WebLLM.");
    modelId = picked;
    return picked;
  }

  const model: LanguageModel = {
    get modelName() {
      return modelId ?? "Gemma (on-device)";
    },

    async checkSupport(): Promise<Support> {
      const g = gpu();
      if (!g) return { ok: false, reason: "This browser has no WebGPU. Use Chrome on Android or desktop." };
      const adapter = await g.requestAdapter();
      if (!adapter) {
        return {
          ok: false,
          reason: "WebGPU is switched off for this GPU. Use Chrome on Android, or on desktop enable chrome://flags/#enable-unsafe-webgpu.",
        };
      }
      f16 = adapter.features.has("shader-f16");
      return { ok: true };
    },

    async isCached(): Promise<boolean> {
      try {
        const m = await loadLib();
        return await m.hasModelInCache(await chooseModel());
      } catch (e) {
        console.warn("[Killedar] Couldn't check for a saved Gemma guide (offline before WebLLM was cached?)", e);
        return false;
      }
    },

    load(onProgress: (p: LoadProgress) => void): Promise<void> {
      engine ??= (async () => {
        const m = await loadLib();
        const id = await chooseModel();
        return m.CreateMLCEngine(id, {
          initProgressCallback: (r) => onProgress({ fraction: r.progress, text: r.text }),
        });
      })();
      engine.catch((e: unknown) => {
        console.error("[Killedar] Loading Gemma failed", e);
        engine = null; // allow retry after a failed download
      });
      return engine.then(() => undefined);
    },

    async *stream(messages: ChatMessage[]): AsyncIterable<string> {
      if (!engine) throw new Error("Model not loaded yet — tap Download first.");
      const e = await engine;
      const chunks = await e.chat.completions.create({ messages, stream: true, temperature: 0.3, max_tokens: 220 });
      for await (const chunk of chunks) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    },
  };
  return model;
}
