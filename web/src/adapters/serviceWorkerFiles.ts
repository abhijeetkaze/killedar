// Asks our service worker (scripts/sw.template.js) about its precache over a MessageChannel.

import type { OfflineFiles } from "../ports/offlineFiles.ts";

type Reply =
  | { type: "progress" | "done"; stored: number; total: number }
  | { type: "error"; message: string };

/** No service worker within this long (file://, private mode, unsupported) → treat as unavailable. */
const READY_TIMEOUT_MS = 10_000;

export function serviceWorkerFiles(): OfflineFiles {
  async function worker(): Promise<ServiceWorker> {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers aren't available here.");
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Service worker didn't start.")), READY_TIMEOUT_MS)),
    ]);
    if (!reg.active) throw new Error("Service worker isn't active yet.");
    return reg.active;
  }

  async function ask(message: string, onProgress?: (stored: number, total: number) => void): Promise<{ stored: number; total: number }> {
    const sw = await worker();
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e: MessageEvent<Reply>) => {
        const r = e.data;
        if (r.type === "error") reject(new Error(r.message));
        else if (r.type === "progress") onProgress?.(r.stored, r.total);
        else resolve({ stored: r.stored, total: r.total });
      };
      sw.postMessage(message, [channel.port2]);
    });
  }

  return {
    status: () => ask("offline-status"),
    store: async (onProgress) => {
      await ask("offline-store", onProgress);
    },
    async keep() {
      return (await navigator.storage?.persist?.()) ?? false;
    },
  };
}
