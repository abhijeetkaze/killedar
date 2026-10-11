// "Use offline": a badge in the header that opens a setup sheet. One download on Wi-Fi saves the
// app files and the Gemma guide; the badge shows progress on every screen and a check when ready.

import type { makeOfflineSetup } from "../app/offlineSetup.ts";
import { overallFraction, overallStatus, type OfflineReport, type OfflineStep } from "../domain/offline.ts";
import { offlineBadgeText, offlineStepText, offlineStepTitle, offlineSummaryText } from "./copy.ts";
import { h, prefs, replace } from "./dom.ts";
import { ICONS, progressRing, type IconName } from "./icons.ts";

type OfflineSetup = ReturnType<typeof makeOfflineSetup>;

export interface OfflineControls {
  /** Header button; the same node on every render so progress survives screen changes. */
  badge: HTMLButtonElement;
  open(): void;
}

export function offlineControls(setup: OfflineSetup): OfflineControls {
  let report: OfflineReport | null = null;
  let running = false;
  let wanted = prefs.get("offline") === "on";

  const badge = h("button", { type: "button", class: "offline-badge", "aria-haspopup": "dialog" });
  const steps = h("ol", { class: "offline-steps" });
  const summary = h("p", { class: "offline-summary", role: "status" });
  const go = h("button", { type: "button", class: "primary" });
  const close = h("button", { type: "button", class: "secondary" }, "Close");
  const sheet = h(
    "dialog",
    { class: "offline-sheet", "aria-labelledby": "offline-title" },
    h("h2", { id: "offline-title" }, "Use Killedar with no signal"),
    summary,
    steps,
    h("div", { class: "offline-actions" }, go, close),
  );
  document.body.append(sheet);

  badge.addEventListener("click", () => open());
  close.addEventListener("click", () => sheet.close());
  sheet.addEventListener("click", (e) => e.target === sheet && sheet.close()); // backdrop tap
  go.addEventListener("click", () => void start());

  function open(): void {
    if (!sheet.open) sheet.showModal();
  }

  async function start(): Promise<void> {
    if (running) return;
    running = true;
    wanted = true;
    prefs.set("offline", "on");
    render();
    try {
      report = await setup.prepare((r) => {
        report = r;
        render();
      });
    } finally {
      running = false;
      render();
    }
  }

  function render(): void {
    const status = report ? (running && overallStatus(report) !== "ready" ? "working" : overallStatus(report)) : "off";
    // The service worker stores the app files on its own; only claim "ready" once the user chose
    // offline (or already has the guide), so the choice stays theirs.
    const chosen = wanted || report?.guide.status === "done";
    const overall = status === "ready" && !chosen ? "off" : status;
    const fraction = report ? overallFraction(report) : 0;

    badge.className = `offline-badge ${overall}`;
    badge.setAttribute("aria-label", `Offline: ${offlineBadgeText(overall, fraction, wanted)}`);
    const icon = overall === "working" ? progressRing(fraction) : ICONS[overall === "ready" ? "ready" : wanted ? "alert" : "download"];
    replace(badge, iconSpan(icon), h("span", {}, offlineBadgeText(overall, fraction, wanted)));

    summary.className = `offline-summary ${overall}`;
    replace(summary, overall === "ready" ? iconSpan(ICONS.ready) : null, offlineSummaryText(overall));
    replace(steps, ...(report ? [stepItem(report.files), stepItem(report.guide)] : []));

    const failed = report && [report.files.status, report.guide.status].some((s) => s === "failed" || s === "no-space");
    go.hidden = overall === "ready";
    go.disabled = running || !report;
    go.textContent = running ? "Downloading…" : failed ? "Try again" : "Download for offline";
    close.textContent = overall === "ready" ? "Done" : "Close";
  }

  render();
  void setup.check().then((r) => {
    if (!running) report = r;
    render();
  });

  return { badge, open };
}

function stepItem(s: OfflineStep): HTMLElement {
  const icon: IconName | null =
    s.status === "done"
      ? "ready"
      : s.status === "unsupported"
        ? "blocked"
        : s.status === "failed" || s.status === "no-space"
          ? "alert"
          : s.status === "missing"
            ? "todo"
            : null;
  return h(
    "li",
    { class: s.status },
    iconSpan(icon ? ICONS[icon] : progressRing(s.fraction)),
    h(
      "div",
      {},
      h("strong", {}, offlineStepTitle(s.id)),
      h("span", { class: "small" }, offlineStepText(s)),
      s.status === "working" ? h("progress", { max: "1", value: s.fraction }) : null,
    ),
  );
}

/** Icon markup comes from icons.ts constants only, never from data. */
function iconSpan(markup: string): HTMLElement {
  const span = h("span", { class: "icon" });
  span.innerHTML = markup;
  return span;
}
