// Composition root: the only place adapters are chosen and wired to use cases.

import { fetchFortRepository } from "./adapters/fetchFortRepository.ts";
import { serviceWorkerFiles } from "./adapters/serviceWorkerFiles.ts";
import { tablePredictor } from "./adapters/tablePredictor.ts";
import { webllmModel } from "./adapters/webllmModel.ts";
import { makeAskFort } from "./app/askFort.ts";
import { makeOfflineSetup } from "./app/offlineSetup.ts";
import { makePlanTrek } from "./app/planTrek.ts";
import { mountApp } from "./ui/views.ts";

const forts = fetchFortRepository("./forts/");
const predictor = tablePredictor("./predictions.json");
const model = webllmModel();

let audio: Promise<Set<string>> | null = null;
const audioFiles = () =>
  (audio ??= fetch("./audio/index.json")
    .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
    .then((list) => new Set(list))
    .catch((e: unknown) => {
      console.warn("[Killedar] No narration index; using the phone's voice", e);
      return new Set<string>();
    }));

const root = document.getElementById("app");
if (root) {
  mountApp(root, {
    forts,
    model,
    planTrek: makePlanTrek({ forts, predictor }),
    askFort: makeAskFort({ forts, model }),
    offline: makeOfflineSetup({ files: serviceWorkerFiles(), model }),
    audioFiles,
  }).catch((e: unknown) => {
    root.textContent = "Killedar couldn't start. Reload the page while online once.";
    console.error("[Killedar] Couldn't start", e);
  });
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./sw.js").catch((e: unknown) => console.warn("[Killedar] Service worker not registered", e));
}
