import type { Fort, FortSummary } from "../domain/fort.ts";

export class FortNotFoundError extends Error {
  constructor(id: string) {
    super(`No fort with id "${id}"`);
    this.name = "FortNotFoundError";
  }
}

export interface FortRepository {
  list(): Promise<FortSummary[]>;
  /** Throws FortNotFoundError for unknown ids. */
  get(id: string): Promise<Fort>;
}
