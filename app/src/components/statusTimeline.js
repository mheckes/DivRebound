// Status-Zeitleiste "Formular erstellt → … → Ausgezahlt" (docs/konzept-schweiz.md
// §1a). Gemeinsamer Baustein für die Seiten "Formular & Finanzamt" und den
// letzten Schritt - zunächst Schweiz, später auch Dänemark. Die Punkte sind
// anklickbar: ein Klick setzt den Fortschritt bis einschließlich dieses Punkts.

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * @param {{ title: string, steps: { label: string, where: string }[], doneCount: number }} options
 */
export function statusTimelineHtml({ title, steps, doneCount }) {
  return `
    <div class="card status-timeline-card">
      <div class="card-head"><span class="card-title">${esc(title)}</span><span class="status-timeline-hint">Status zum Anklicken aktualisieren</span></div>
      <div class="status-timeline">
        ${steps
          .map((s, i) => {
            const cls = i < doneCount ? "done" : i === doneCount ? "now" : "";
            return `
            <button class="status-timeline-step ${cls}" data-timeline-step="${i}" type="button">
              <span class="status-timeline-dot">${i < doneCount ? "✓" : i + 1}</span>
              <span class="status-timeline-label">${esc(s.label)}</span>
              <span class="status-timeline-where">${esc(s.where)}</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>`;
}

/**
 * Klick auf Punkt i: ist er schon erledigt und der letzte erledigte, wird er
 * wieder zurückgenommen, sonst gilt alles bis einschließlich i als erledigt.
 * @param {HTMLElement} root
 * @param {() => number} getDoneCount
 * @param {(doneCount: number) => void} onChange
 */
export function bindStatusTimeline(root, getDoneCount, onChange) {
  root.querySelectorAll("[data-timeline-step]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.timelineStep);
      const current = getDoneCount();
      onChange(current === i + 1 ? i : i + 1);
    })
  );
}
