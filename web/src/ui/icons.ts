// Inline SVG icons (no icon font: it would be one more thing to cache). Static markup only.

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  /** cloud with a down arrow: "save for offline" */
  download: svg('<path d="M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17.5 18"/><path d="M12 11v9m-3-3 3 3 3-3"/>'),
  /** check in a circle: "ready" */
  ready: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16 10"/>'),
  /** exclamation in a circle: "not finished" */
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5m0 3.2v.1"/>'),
  /** crossed circle: "can't on this browser" */
  blocked: svg('<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>'),
  /** empty circle: "to do" */
  todo: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>'),
} as const;

export type IconName = keyof typeof ICONS;

/** A ring that fills clockwise with `fraction` (0..1). */
export function progressRing(fraction: number): string {
  const r = 9;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(1, Math.max(0, fraction)) * c).toFixed(1);
  return svg(
    `<circle cx="12" cy="12" r="${r}" opacity="0.25"/>` +
      `<circle cx="12" cy="12" r="${r}" stroke-dasharray="${filled} ${c.toFixed(1)}" transform="rotate(-90 12 12)"/>`,
  );
}
