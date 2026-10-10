// Use case: answer a trail question about one fort, on-device, grounded in its notes.

import type { Lang } from "../domain/fort.ts";
import { buildAskMessages } from "../domain/prompt.ts";
import type { FortRepository } from "../ports/fortRepository.ts";
import type { LanguageModel } from "../ports/languageModel.ts";

export interface AskFortDeps {
  forts: FortRepository;
  model: LanguageModel;
}

export function makeAskFort({ forts, model }: AskFortDeps) {
  return async function* askFort(fortId: string, question: string, lang: Lang): AsyncGenerator<string> {
    const fort = await forts.get(fortId);
    const messages = buildAskMessages(fort, question, lang); // validates before touching the model
    yield* model.stream(messages);
  };
}
