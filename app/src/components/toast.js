// Kurze Rückmeldung unten in der Mitte, z. B. "✓ Steuernummer gespeichert ·
// Rückgängig". Es gibt immer nur eine Meldung; eine neue ersetzt die alte.

const VISIBLE_MS = 4000;
let el = null;
let hideTimer = null;

function ensureElement() {
  if (el) return el;
  el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  (document.getElementById("divrebound-app") ?? document.body).appendChild(el);
  return el;
}

/**
 * @param {string} message
 * @param {{ actionLabel?: string, onAction?: () => void }} [options]
 */
export function showToast(message, { actionLabel, onAction } = {}) {
  const toast = ensureElement();
  toast.textContent = message;
  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      hideToast();
      onAction();
    });
    toast.appendChild(btn);
  }
  toast.classList.add("visible");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideToast, VISIBLE_MS);
}

export function hideToast() {
  if (el) el.classList.remove("visible");
}
