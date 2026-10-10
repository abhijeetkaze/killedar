// Screens. Talks only to use cases and ports handed in by main.ts (the composition root).

import type { makeAskFort } from "../app/askFort.ts";
import type { makePlanTrek, TrekPlan } from "../app/planTrek.ts";
import type { Fort, FortSummary, Lang } from "../domain/fort.ts";
import { formatClock } from "../domain/plan.ts";
import { EmptyQuestionError } from "../domain/prompt.ts";
import type { FortRepository } from "../ports/fortRepository.ts";
import type { LanguageModel } from "../ports/languageModel.ts";
import { downloadStatusText, estimateText, warningText } from "./copy.ts";
import { h, prefs, replace } from "./dom.ts";

export interface AppDeps {
  forts: FortRepository;
  model: LanguageModel;
  planTrek: ReturnType<typeof makePlanTrek>;
  askFort: ReturnType<typeof makeAskFort>;
  /** File names present under audio/, e.g. "sinhagad-mr.mp3". */
  audioFiles: () => Promise<Set<string>>;
}

type Tab = "plan" | "ask" | "listen";
const TABS: { id: Tab; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "ask", label: "Ask" },
  { id: "listen", label: "Listen" },
];

export async function mountApp(root: HTMLElement, deps: AppDeps): Promise<void> {
  const list = await deps.forts.list();
  const first = list[0];
  if (!first) throw new Error("No forts are bundled with the app.");

  const state = {
    fortId: list.some((f) => f.id === prefs.get("fort")) ? (prefs.get("fort") as string) : first.id,
    tab: (TABS.some((t) => t.id === prefs.get("tab")) ? prefs.get("tab") : "plan") as Tab,
    lang: (prefs.get("lang") === "mr" ? "mr" : "en") as Lang,
  };

  const header = h("header", { class: "masthead" });
  const view = h("main", { class: "view", id: "view", tabindex: "-1" });
  const nav = h("nav", { class: "tabbar", "aria-label": "Screens" });
  root.replaceChildren(header, view, nav);

  async function render(): Promise<void> {
    const fort = await deps.forts.get(state.fortId);
    replace(header, fortPicker(list, state.fortId, select), titleBlock(fort));
    replace(
      nav,
      ...TABS.map((t) =>
        h("button", { type: "button", "aria-current": t.id === state.tab ? "page" : undefined, onclick: () => go(t.id) }, t.label),
      ),
    );
    const screen =
      state.tab === "plan" ? planScreen(fort, deps) : state.tab === "ask" ? askScreen(fort, deps, state.lang, setLang) : listenScreen(fort, deps, state.lang, setLang);
    replace(view, screen);
  }

  function select(id: string): void {
    state.fortId = id;
    prefs.set("fort", id);
    void render();
  }
  function go(tab: Tab): void {
    state.tab = tab;
    prefs.set("tab", tab);
    void render().then(() => view.focus());
  }
  function setLang(lang: Lang): void {
    state.lang = lang;
    prefs.set("lang", lang);
    void render();
  }

  await render();
}

// ── header ──────────────────────────────────────────────────────────────────

function fortPicker(list: FortSummary[], current: string, onSelect: (id: string) => void): HTMLElement {
  return h(
    "div",
    { class: "fort-picker", role: "group", "aria-label": "Choose a fort" },
    ...list.map((f) =>
      h("button", { type: "button", "aria-pressed": f.id === current ? "true" : "false", onclick: () => onSelect(f.id) }, f.name),
    ),
  );
}

function titleBlock(fort: Fort): HTMLElement {
  return h(
    "div",
    { class: "title" },
    h("h1", { lang: "mr" }, fort.nameMr),
    h("p", {}, `${fort.name}, ${fort.summitElevationM.toLocaleString("en-IN")} m`),
  );
}

function langToggle(lang: Lang, onChange: (l: Lang) => void): HTMLElement {
  const opt = (l: Lang, label: string, attrs: Record<string, string> = {}) =>
    h("button", { type: "button", "aria-pressed": l === lang ? "true" : "false", onclick: () => onChange(l), ...attrs }, label);
  return h("div", { class: "lang", role: "group", "aria-label": "Answer language" }, opt("en", "English"), opt("mr", "मराठी", { lang: "mr" }));
}

// ── plan ────────────────────────────────────────────────────────────────────

function planScreen(fort: Fort, deps: AppDeps): HTMLElement {
  const trail = h("select", { name: "trail" }, ...fort.trails.map((t, i) => h("option", { value: String(i) }, `${t.name} (${t.difficulty})`)));
  const start = h("input", { name: "start", type: "number", min: "4", max: "14", value: "7", inputmode: "numeric" });
  const group = h("input", { name: "group", type: "number", min: "1", max: "30", value: "2", inputmode: "numeric" });
  const top = h(
    "select",
    { name: "top" },
    ...[30, 60, 90, 120].map((m) => h("option", { value: String(m), selected: m === 60 }, `${m} min`)),
  );
  const last = h("input", { name: "last", type: "time", value: fort.returnTransport.lastDepartureFromBase ?? "" });
  const result = h("section", { class: "result", "aria-live": "polite" });

  async function plan(): Promise<void> {
    replace(result, h("p", { class: "muted" }, "Working out your day…"));
    try {
      const p = await deps.planTrek({
        fortId: fort.id,
        trailIndex: Number(trail.value),
        startHour: clamp(Number(start.value), 4, 14, 7),
        groupSize: clamp(Number(group.value), 1, 30, 2),
        summitMin: Number(top.value),
        bufferMin: 30,
        lastDepartureOverride: last.value,
      });
      replace(result, planResult(p));
    } catch (e) {
      replace(result, h("p", { class: "error" }, errorText(e)));
    }
  }

  const form = h(
    "form",
    { class: "plan-form", onsubmit: (e: Event) => (e.preventDefault(), void plan()) },
    field("Trail", trail),
    h("div", { class: "row" }, field("Start climbing at (hour)", start), field("People", group)),
    h("div", { class: "row" }, field("Time on top", top), field("Last bus or train back", last)),
    h("button", { type: "submit", class: "primary" }, "Plan my day"),
  );

  void plan();
  return h("div", { class: "screen" }, result, form, offlinePanel(deps.model), h("p", { class: "note" }, fort.returnTransport.note));
}

function planResult(p: TrekPlan): HTMLElement {
  const { day } = p;
  const steps: [number, string][] = day
    ? [
        [day.leavePuneBy, "Leave Pune"],
        [day.startClimbBy, `Start climbing from ${p.trail.startPoint}`],
        [day.reachTopBy, "Reach the top"],
        [day.startDescentBy, "Start down"],
        [day.backAtBaseBy, "Back at the base"],
        [day.lastDeparture, "Last bus or train"],
      ]
    : [];
  return h(
    "div",
    {},
    day
      ? h("p", { class: "leave" }, "Leave Pune by ", h("strong", {}, formatClock(day.leavePuneBy)))
      : h("p", { class: "leave pending" }, "Add the last bus to get your leave-by time"),
    h("p", { class: "estimate" }, estimateText(p.estimate)),
    steps.length
      ? h("ol", { class: "timeline" }, ...steps.map(([t, label]) => h("li", {}, h("time", {}, formatClock(t)), h("span", {}, label))))
      : null,
    p.warnings.length ? h("ul", { class: "warnings" }, ...p.warnings.map((w) => h("li", {}, warningText(w)))) : null,
  );
}

function offlinePanel(model: LanguageModel): HTMLElement {
  const status = h("p", {});
  const detail = h("p", { class: "muted small" });
  const bar = h("progress", { max: "1", value: "0", hidden: true });
  const button = h("button", { type: "button", class: "secondary", hidden: true }, "Download trail guide");

  const set = (s: Parameters<typeof downloadStatusText>[0], extra = "") => {
    status.textContent = downloadStatusText(s);
    status.className = s === "ready" ? "ready" : "";
    detail.textContent = extra;
    button.hidden = s !== "missing" && s !== "failed";
    bar.hidden = s !== "downloading";
  };

  button.addEventListener("click", async () => {
    set("downloading");
    try {
      await model.load((p) => {
        bar.value = p.fraction;
        detail.textContent = p.text;
      });
      set("ready", model.modelName);
    } catch (e) {
      set("failed", errorText(e));
    }
  });

  set("checking");
  void (async () => {
    const support = await model.checkSupport();
    if (!support.ok) return set("unsupported", support.reason);
    set((await model.isCached()) ? "ready" : "missing", "A large one-time download. Use Wi-Fi.");
  })();

  return h("section", { class: "offline", "aria-label": "Offline guide" }, h("h2", {}, "On the fort"), status, bar, detail, button);
}

// ── ask ─────────────────────────────────────────────────────────────────────

const SUGGESTIONS: Record<Lang, string[]> = {
  en: ["Where can I refill water?", "What should I see at the top?", "What happened here in history?"],
  mr: ["पाणी कुठे मिळेल?", "वर काय पाहावे?", "या गडाचा इतिहास काय आहे?"],
};

function askScreen(fort: Fort, deps: AppDeps, lang: Lang, setLang: (l: Lang) => void): HTMLElement {
  const log = h("div", { class: "log", "aria-live": "polite" });
  const input = h("textarea", { name: "q", rows: "2", placeholder: `Ask about ${fort.name}`, maxlength: "500", lang });
  const submit = h("button", { type: "submit", class: "primary" }, "Ask");

  async function ask(question: string): Promise<void> {
    const answer = h("p", { class: "a", lang });
    log.append(h("p", { class: "q", lang }, question), answer);
    submit.disabled = true;
    try {
      const support = await deps.model.checkSupport();
      if (!support.ok) throw new UserFacing(support.reason);
      if (!(await deps.model.isCached())) {
        throw new UserFacing("The trail guide isn't on this phone yet. Download it from the Plan screen on Wi-Fi.");
      }
      await deps.model.load((p) => (answer.textContent = `Waking up the guide… ${Math.round(p.fraction * 100)}%`));
      answer.textContent = "";
      for await (const chunk of deps.askFort(fort.id, question, lang)) answer.textContent += chunk;
      if (!answer.textContent) answer.textContent = "No answer came back. Try asking differently.";
    } catch (e) {
      answer.className = "a error";
      answer.textContent = errorText(e);
    } finally {
      submit.disabled = false;
      answer.scrollIntoView({ block: "nearest" });
    }
  }

  const form = h(
    "form",
    {
      class: "ask-form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const q = input.value.trim();
        input.value = "";
        void ask(q);
      },
    },
    input,
    submit,
  );

  return h(
    "div",
    { class: "screen ask" },
    langToggle(lang, setLang),
    h("div", { class: "suggestions" }, ...SUGGESTIONS[lang].map((s) => h("button", { type: "button", lang, onclick: () => void ask(s) }, s))),
    log,
    form,
  );
}

// ── listen ──────────────────────────────────────────────────────────────────

function listenScreen(fort: Fort, deps: AppDeps, lang: Lang, setLang: (l: Lang) => void): HTMLElement {
  const paragraphs = fort.history[lang].length ? fort.history[lang] : fort.history.en;
  const textLang: Lang = fort.history[lang].length ? lang : "en";
  const player = h("div", { class: "player" });

  void deps.audioFiles().then((files) => {
    const file = `${fort.id}-${lang}.mp3`;
    if (files.has(file)) {
      replace(player, h("audio", { controls: true, preload: "auto", src: `audio/${file}` }));
    } else {
      replace(player, speakButton(paragraphs.join(" "), textLang));
    }
  });

  return h(
    "div",
    { class: "screen listen" },
    langToggle(lang, setLang),
    player,
    textLang !== lang ? h("p", { class: "muted small" }, "Marathi text for this fort is coming soon; showing English.") : null,
    h("div", { class: "history", lang: textLang }, ...paragraphs.map((p) => h("p", {}, p))),
    h("h2", {}, "Landmarks"),
    h("dl", { class: "landmarks" }, ...fort.landmarks.flatMap((l) => [h("dt", {}, l.name), h("dd", {}, l.note)])),
    h("h2", {}, "Sources"),
    h("ul", { class: "sources" }, ...fort.sources.map((s) => h("li", {}, h("a", { href: s, rel: "noopener", target: "_blank" }, s.replace(/^https:\/\//, ""))))),
  );
}

/** Fallback narration using the phone's own text-to-speech (works offline on most Android phones). */
function speakButton(text: string, lang: Lang): HTMLElement {
  if (!("speechSynthesis" in globalThis)) return h("p", { class: "muted small" }, "Audio isn't available on this browser.");
  let speaking = false;
  const button = h("button", { type: "button", class: "secondary" }, "Read aloud");
  button.addEventListener("click", () => {
    speechSynthesis.cancel();
    speaking = !speaking;
    button.textContent = speaking ? "Stop" : "Read aloud";
    if (!speaking) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "mr" ? "mr-IN" : "en-IN";
    u.rate = 0.95;
    u.onend = () => {
      speaking = false;
      button.textContent = "Read aloud";
    };
    speechSynthesis.speak(u);
  });
  return button;
}

// ── helpers ─────────────────────────────────────────────────────────────────

class UserFacing extends Error {}

function errorText(e: unknown): string {
  if (e instanceof UserFacing || e instanceof EmptyQuestionError) return e.message;
  if (e instanceof RangeError) return e.message;
  return "Something went wrong. Try again.";
}

function field(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", {}, label), control);
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}
