// Zentrales State-Objekt + minimaler Pub/Sub. Bewusst kein Framework:
// Screens rufen `render(container, state)` neu auf, wenn sich ihr Ausschnitt
// des States ändert, statt über virtuelles DOM/Reaktivität zu laufen.

const state = {
  /** @type {InvestorProfile | null} */
  currentProfile: null,
  /** @type {ReclaimCase | null} */
  currentCase: null,
  /** @type {ReclaimCase[]} alle Cases des aktuellen Profils, für die Sidebar */
  cases: [],
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
