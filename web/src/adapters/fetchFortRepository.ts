// Reads fort JSON shipped with the app (and precached by the service worker).

import { parseFort, type Fort, type FortSummary } from "../domain/fort.ts";
import { FortNotFoundError, type FortRepository } from "../ports/fortRepository.ts";
import { defaultFetch, type FetchLike } from "./http.ts";

export function fetchFortRepository(baseUrl: string, doFetch: FetchLike = defaultFetch): FortRepository {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const cache = new Map<string, Promise<Fort>>();

  async function getJson(path: string): Promise<unknown> {
    const res = await doFetch(`${root}${path}`);
    if (res.status === 404) throw new FortNotFoundError(path);
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
  }

  return {
    async list(): Promise<FortSummary[]> {
      const index = await getJson("index.json");
      if (!Array.isArray(index)) throw new Error("forts/index.json must be a list");
      return index.map((e) => {
        const o = e as Record<string, unknown>;
        if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.nameMr !== "string") {
          throw new Error("forts/index.json entries need id, name, nameMr");
        }
        return { id: o.id, name: o.name, nameMr: o.nameMr };
      });
    },

    get(id: string): Promise<Fort> {
      if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new FortNotFoundError(id));
      let fort = cache.get(id);
      if (!fort) {
        fort = getJson(`${id}.json`).then(parseFort, (e: unknown) => {
          throw e instanceof FortNotFoundError ? new FortNotFoundError(id) : e;
        });
        fort.catch(() => cache.delete(id)); // don't cache failures
        cache.set(id, fort);
      }
      return fort;
    },
  };
}
