// Startseite (#/home), nach Mock Up Ablauf 11-2026:
//  - erster Besuch: die vier Phasen als Gesamtbild, darunter "Neuen Antrag
//    starten" mit einer Kachel je Land (legt Profil und Antrag direkt an,
//    util/startCase.js - kein Dialog mehr)
//  - mit Anträgen: je Antrag eine Karte, die sagt, worauf er wartet, und genau
//    eine Frage stellt ("Bestätigung zurück?", "Geld angekommen?"), darunter
//    Statistik, Länderkacheln und der Hinweis zur Sicherung
//  - immer: der Beta-Hinweis unter dem Inhalt

import { getState, setState, subscribe } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import * as caseRepo from "../../db/caseRepo.js";
import { corridors } from "../../config/corridors.js";
import { PHASES } from "../../config/caseSteps.js";
import { formatNumberDe, formatDateDe } from "../../util/format.js";
import { nextStep, stepRoute, stepsFor, casePhase } from "../../util/caseNav.js";
import { isSubmitted, submittedAt, refundReceived, parseAmount, monthsBetween } from "../../util/caseProgress.js";
import { caseName, COUNTRY_NAMES } from "../../util/caseName.js";
import { startCase } from "../../util/startCase.js";
import { isEligible, totalRefund } from "../../lib/withholding.js";
import { phasesHtml, flagHtml, refundPercent } from "../../components/flow.js";
import { openConfirmModal } from "../../components/modal.js";

const COUNTRIES = ["DK", "CH", "IT", "SE"];
const AUTHORITY = { DK: "die dänische Steuerbehörde", CH: "die Schweizer Steuerverwaltung", IT: "die italienische Steuerbehörde", SE: "die schwedische Steuerbehörde" };

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Erwartete Erstattung aus den ausgewählten Ausschüttungen (DK in DKK, IT in EUR, SE in SEK); Schweiz: 0 */
function expectedRefund(reclaimCase, residenceCountry) {
  if (reclaimCase.targetCountry === "CH") return 0;
  const corridor = corridors[reclaimCase.targetCountry];
  const eligible = reclaimCase.distributions.filter((d) => isEligible(d, corridor, { residenceCountry }));
  return totalRefund(eligible, corridor, residenceCountry);
}

/**
 * Statistik über alle Anträge: erhaltene Erstattungen, durchschnittliche
 * Wartezeit ab Einreichung und ausstehende Beträge je Währung.
 */
function statistics(cases, residenceCountry) {
  let receivedEur = 0;
  let receivedCount = 0;
  const waits = [];
  const open = {};
  for (const c of cases) {
    const r = refundReceived(c);
    if (!r.received) {
      const cur = corridors[c.targetCountry].nativeCurrency;
      open[cur] = (open[cur] ?? 0) + expectedRefund(c, residenceCountry);
      continue;
    }
    const amount = parseAmount(r.amountEur);
    if (amount !== null) {
      receivedEur += amount;
      receivedCount += 1;
    }
    const months = monthsBetween(submittedAt(c)?.slice(0, 10), r.date);
    if (months !== null) waits.push(months);
  }
  const avgWait = waits.length ? Math.round(waits.reduce((s, m) => s + m, 0) / waits.length) : null;
  return { receivedEur, receivedCount, avgWait, open: Object.entries(open).filter(([, v]) => v > 0) };
}

function dotsHtml(phase) {
  const order = ["prepare", "confirm", "submit", "submitted", "received"];
  const at = order.indexOf(phase);
  return [0, 1, 2, 3].map((i) => `<span class="case-dot ${i < at ? "done" : i === at ? "now" : ""}"></span>`).join("");
}

function caseCardHtml(reclaimCase, residence) {
  const phase = casePhase(reclaimCase);
  const step = nextStep(reclaimCase);
  const steps = stepsFor(reclaimCase);
  const refundStep = steps[steps.length - 1];
  const expected = expectedRefund(reclaimCase, residence);
  const meta = [];
  if (expected) meta.push(`${formatNumberDe(expected)} ${corridors[reclaimCase.targetCountry].nativeCurrency} erwartet`);
  const submitted = submittedAt(reclaimCase);
  if (submitted) meta.push(`eingereicht am ${formatDateDe(submitted.slice(0, 10))}`);
  else meta.push(`angelegt am ${formatDateDe(reclaimCase.createdAt.slice(0, 10))}`);

  let status;
  let question = "";
  let actions;
  const open = (n, label, cls = "btn-primary") => `<button class="${cls} btn-small" data-nav="${stepRoute(reclaimCase, n)}" type="button">${esc(label)}</button>`;
  if (phase === "received") {
    const r = refundReceived(reclaimCase);
    status = `Erstattet${r.amountEur ? `: ${esc(r.amountEur)} EUR` : ""}${r.date ? ` am ${formatDateDe(r.date)}` : ""}`;
    actions = open(refundStep.n, "Ansehen", "btn-secondary");
  } else if (phase === "submitted") {
    status = `Eingereicht · wartet auf ${AUTHORITY[reclaimCase.targetCountry]}`;
    question = "Ist das Geld angekommen?";
    actions = open(refundStep.n, "Ja, Betrag eintragen", "btn-accent");
  } else if (phase === "confirm") {
    status = `Phase 2 von 3 · ${PHASES.confirm.title}`;
    question = "Ist die Bestätigung von deinem Finanzamt zurück?";
    actions = `${open(step.n, "Noch nicht", "btn-secondary")}<button class="btn-accent btn-small" data-confirmed="${reclaimCase.caseId}" type="button">Ja, jetzt einreichen →</button>`;
  } else {
    status = `Phase ${phase === "submit" ? 3 : 1} von 3 · ${PHASES[phase].title}`;
    actions = open(step.n, step.intro ? "Starten →" : `Weiter: ${step.title} →`);
  }

  return `
    <div class="case-card ${question ? "attn" : ""}">
      <div>
        <div class="case-name">${flagHtml(reclaimCase.targetCountry)}${esc(caseName(reclaimCase))}</div>
        <div class="case-meta">${esc(meta.join(" · "))}</div>
        <div class="case-dots">${dotsHtml(phase)}<span>${esc(status)}</span></div>
        ${question ? `<div class="case-q">${esc(question)}</div>` : ""}
      </div>
      <div class="case-actions">
        ${actions}
        <button class="case-delete" data-delete="${reclaimCase.caseId}" title="Antrag löschen" type="button">Löschen</button>
      </div>
    </div>`;
}

function render(container) {
  const state = getState();
  const profile = state.currentProfile;
  const residence = profile?.residence?.country;
  const cases = [...state.cases].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  const stats = statistics(cases, residence);
  const submittedCount = cases.filter(isSubmitted).length;
  const firstName = profile?.residence?.firstName;

  const countryTiles = `
    <div class="home-countries">
      ${COUNTRIES.map((c) => `<button class="home-country" data-start="${c}" type="button"><b>${flagHtml(c)}${COUNTRY_NAMES[c]}</b><span>${refundPercent(c)} % deiner Dividende zurück</span></button>`).join("")}
    </div>`;

  const beta = `
    <section class="beta-card" aria-labelledby="beta-title">
      <div class="beta-main">
        <span class="beta-badge">Beta-Test</span>
        <h2 class="beta-title" id="beta-title">Danke, dass du DivRebound testest</h2>
        <p>Sag uns, was hakt: ein Fehler, ein unklarer Text, eine fehlende Funktion.</p>
        <button type="button" class="btn-accent btn-small" data-feedback="home-beta">💬 Feedback geben</button>
      </div>
      <div class="beta-want">
        <div class="beta-want-label">Besonders gesucht</div>
        <b>Abrechnungen anderer Banken</b>
        <p>Bisher kennt DivRebound nur wenige Layouts. Ein kurzes „hat geklappt“ mit dem Namen deiner Bank hilft schon.</p>
      </div>
    </section>`;

  container.innerHTML = `
    <div class="home-page">
    <div class="content-header">
      <h1 class="content-title" data-feedback-skip>${cases.length ? `Willkommen zurück${firstName ? `, ${esc(firstName)}` : ""}` : "Hol dir deine Quellensteuer zurück"}</h1>
      <div class="content-breadcrumb">${cases.length ? "Übersicht" : "Für Privatanleger mit Wohnsitz in Deutschland"}</div>
    </div>

    ${
      cases.length
        ? `<h2 class="home-section">Deine Anträge</h2>
           ${cases.map((c) => caseCardHtml(c, residence)).join("")}

           <h2 class="home-section">Deine Statistik</h2>
           <div class="home-stats">
             <div class="home-stat"><b>${cases.length}</b><span>${cases.length === 1 ? "Antrag" : "Anträge"}, davon ${submittedCount} eingereicht</span></div>
             ${stats.open.map(([cur, v]) => `<div class="home-stat"><b>${formatNumberDe(v)} ${cur}</b><span>ausstehend</span></div>`).join("")}
             ${stats.receivedCount ? `<div class="home-stat"><b>${formatNumberDe(stats.receivedEur)} EUR</b><span>bisher erhalten</span></div>` : ""}
             ${stats.avgWait !== null ? `<div class="home-stat"><b>${stats.avgWait} ${stats.avgWait === 1 ? "Monat" : "Monate"}</b><span>Ø Wartezeit bis zur Auszahlung</span></div>` : ""}
           </div>`
        : phasesHtml()
    }

    <h2 class="home-section">Neuen Antrag starten</h2>
    ${countryTiles}
    ${
      cases.length
        ? `<div class="wait-box home-backup">
             <span>Deine Anträge liegen nur in diesem Browser. Sichere sie als Datei, bevor du das Gerät wechselst oder Browserdaten löschst. Die Sicherung findest du unten in der Seitenleiste.</span>
           </div>`
        : `<p class="field-hint">Für Aktien im Privatvermögen. Deine Daten bleiben in diesem Browser und werden nirgendwohin gesendet.</p>`
    }

    ${beta}
    </div>`;

  container.querySelectorAll("[data-nav]").forEach((el) => el.addEventListener("click", () => navigate(el.dataset.nav)));
  container.querySelectorAll("[data-start]").forEach((el) => el.addEventListener("click", () => startCase(el.dataset.start)));

  // "Ja, jetzt einreichen": Finanzamt-Schritt abhaken und zum Einreichen springen
  container.querySelectorAll("[data-confirmed]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const reclaimCase = getState().cases.find((c) => c.caseId === btn.dataset.confirmed);
      const step = nextStep(reclaimCase);
      const key = reclaimCase.targetCountry === "DK" ? null : reclaimCase.targetCountry.toLowerCase();
      if (key) reclaimCase[key].stepsDone = [...new Set([...(reclaimCase[key].stepsDone ?? []), step.n])].sort();
      else reclaimCase.dkStepsDone = [...new Set([...(reclaimCase.dkStepsDone ?? []), step.n])].sort();
      await caseRepo.put(reclaimCase);
      setState({ cases: getState().cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c)) });
      navigate(stepRoute(reclaimCase, nextStep(reclaimCase).n));
    })
  );

  container.querySelectorAll("[data-delete]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const reclaimCase = getState().cases.find((c) => c.caseId === btn.dataset.delete);
      const confirmed = await openConfirmModal(
        "Antrag wirklich löschen?",
        `„${caseName(reclaimCase)}“ wird unwiderruflich gelöscht, inklusive aller erfassten Ausschüttungen. Bereits heruntergeladene Dokumente sind davon nicht betroffen.`,
        { confirmLabel: "Löschen", danger: true }
      );
      if (!confirmed) return;
      await caseRepo.remove(reclaimCase.caseId);
      const wasCurrent = getState().currentCase?.caseId === reclaimCase.caseId;
      setState({ cases: getState().cases.filter((c) => c.caseId !== reclaimCase.caseId), currentCase: wasCurrent ? null : getState().currentCase });
    })
  );
}

export function mount(container) {
  render(container);
  // z.B. nach dem Löschen eines Antrags oder dem Laden einer Sicherung
  return subscribe(() => render(container));
}
