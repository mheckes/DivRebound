// Schritt 5 "Formular & Finanzamt" (docs/konzept-schweiz.md §1a). Gleicher
// Aufbau wie bei Dänemark: Status-Zeitleiste, Formular, Anschreiben,
// nächste Schritte, "Bearbeitung pausiert". Bei der Schweiz
// erzeugt das ePortal das Formular (Antrag DIP-0085) - DivRebound liefert das
// Anschreiben und merkt sich den Status.

import { taxOfficeWaysHtml, bindTaxOfficeWays, elsterMessageText, taxOfficePauseHtml, taxOfficeNavHtml, bindTaxOfficePause } from "../../components/flow.js";
import { getState } from "../../store/store.js";
import { navigate } from "../../router/router.js";
import { buildTaxOfficeLetter } from "../../lib/buildTaxOfficeLetter.js";
import { normalizeTaxOffice } from "../../util/taxOffice.js";
import { openPdfPreview } from "../../util/pdfPreview.js";
import { pausePanelHtml, bindPausePanel } from "../../components/pausePanel.js";
import { statusTimelineHtml, bindStatusTimeline, timelineTitle as statusTimelineTitle } from "../../components/statusTimeline.js";
import { refundReceived } from "../../util/caseProgress.js";
import { chStepRoute } from "../../config/caseSteps.js";
import {
  esc, saveCase, loadTransactions, entitlementsFor, formatChf,
  stepHeader, stepNavHtml, bindStepNav,
} from "./chShared.js";

export const CH_TIMELINE = [
  { label: "Formular erstellt", where: "ePortal" },
  { label: "Unterschrieben & versendet", where: "Post" },
  { label: "Vom Finanzamt bestätigt", where: "Finanzamt" },
  { label: "Im ePortal hochgeladen", where: "ePortal" },
  { label: "Ausgezahlt", where: "Konto" },
];

/** Einheitlicher Titel wie DK/IT: "Formular · 1 Formular · Betrag" */
export function timelineTitle(reclaimCase, total) {
  return statusTimelineTitle("Antrag DIP-0085", 1, formatChf(total));
}

/** Gespeicherter Fortschritt, mindestens aber aus dem Fall abgeleitet */
export function chTimelineDone(reclaimCase) {
  let derived = reclaimCase.ch.completedAt ? 4 : 0;
  if (refundReceived(reclaimCase).received) derived = 5;
  return Math.max(reclaimCase.ch.timelineStep ?? 0, derived);
}

const FORM_CHECKS = [
  ["created", "Im ePortal auf <b>„Erstellen“</b> klicken und den Antrag als PDF speichern."],
];

export async function mount(container, reclaimCase) {
  const transactions = await loadTransactions(getState().currentProfile);
  render(container, reclaimCase, transactions);
}

function downloadBlob(bytes, fileName, mimeType) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function letterFileName(profile, yearsLabel) {
  return `Anschreiben_Finanzamt_${profile.residence.lastName || "DivRebound"}_Schweiz${yearsLabel ? `_${yearsLabel}` : ""}.pdf`;
}

function render(container, reclaimCase, transactions) {
  const profile = getState().currentProfile;
  const results = entitlementsFor(reclaimCase, transactions, profile);
  const total = results.reduce((s, r) => s + (r.refund ?? 0), 0);
  const years = [...new Set(results.map((r) => Number(r.distribution.paymentDate.slice(0, 4))))].sort();
  const taxOffice = normalizeTaxOffice(profile.residence.taxOffice);
  const taxOfficeComplete = Boolean(taxOffice.name && taxOffice.street && taxOffice.postalCode && taxOffice.city);
  const formChecks = new Set(reclaimCase.ch.formChecks ?? []);
  const yearsLabel = years.length ? (years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : String(years[0])) : "";

  container.innerHTML = `
    <div class="ch-page">
    ${stepHeader(reclaimCase, 5)}
    <p class="ch-lead">Dein Finanzamt bestätigt auf dem Antrag aus dem ePortal, dass du in Deutschland wohnst.</p>

    <div class="card">
      <div class="card-head head-navy"><span class="card-title">Formular</span><span class="ch-head-sub">wird im ePortal erzeugt</span></div>
      <div class="card-body">
        <div class="ch-next"><span class="ch-next-num">!</span><span>Falls noch nicht geschehen: im ePortal auf <b>„Erstellen“</b> klicken und den Antrag als PDF speichern.</span></div>
      </div>
    </div>

    ${taxOfficeWaysHtml(profile, reclaimCase, {
      signText: "Antrag ausdrucken, auf Seite 1 unter „Rechtsgültige Unterschrift“ Ort und Datum eintragen und unterschreiben",
      confirmText: "Das Finanzamt bestätigt auf Seite 1 (Stempel und Unterschrift) und schickt den Antrag zurück",
      letterButtonsHtml: `<button class="btn-secondary btn-small" data-action="letter-preview" type="button" ${taxOfficeComplete ? "" : "disabled"}>👁 Vorschau</button><button class="btn-secondary btn-small" data-action="letter" type="button" ${taxOfficeComplete ? "" : "disabled"}>⬇ Herunterladen</button>${taxOfficeComplete ? "" : ` <a href="#" data-go-step="8">Anschrift des Finanzamts ergänzen</a>`}`,
    })}

    ${taxOfficePauseHtml(reclaimCase)}

    ${taxOfficeNavHtml(reclaimCase, "Antrag ist zurück")}
    </div>`;

  bindStepNav(container, reclaimCase, 5);
  bindStatusTimeline(container, () => chTimelineDone(reclaimCase), async (n) => {
    reclaimCase.ch.timelineStep = n;
    await saveCase(reclaimCase);
    render(container, reclaimCase, transactions);
  });

  container.querySelectorAll("[data-form-check]").forEach((box) =>
    box.addEventListener("change", async () => {
      const set = new Set(reclaimCase.ch.formChecks ?? []);
      box.checked ? set.add(box.dataset.formCheck) : set.delete(box.dataset.formCheck);
      reclaimCase.ch.formChecks = [...set];
      // Mit dem erstellten Antrag ist der erste Schritt der Zeitleiste erledigt.
      if (box.dataset.formCheck === "created" && box.checked && (reclaimCase.ch.timelineStep ?? 0) < 1) {
        reclaimCase.ch.timelineStep = 1;
        await saveCase(reclaimCase);
        render(container, reclaimCase, transactions);
        return;
      }
      await saveCase(reclaimCase);
    })
  );

  const buildLetter = () =>
    buildTaxOfficeLetter(getState().currentProfile, { reference: "Antrag auf Rückerstattung der schweizerischen Verrechnungssteuer" });
  container.querySelector('[data-action="letter"]').addEventListener("click", async () => {
    downloadBlob(await buildLetter(), letterFileName(profile, yearsLabel), "application/pdf");
  });
  container.querySelector('[data-action="letter-preview"]').addEventListener("click", () => openPdfPreview(buildLetter));

  container.querySelectorAll("[data-go-step]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(chStepRoute(reclaimCase.caseId, Number(a.dataset.goStep)));
    })
  );

  bindPausePanel(container, reclaimCase);
  bindTaxOfficeWays(container, () => elsterMessageText(getState().currentProfile, { reference: "Antrag auf Rückerstattung der schweizerischen Verrechnungssteuer", originalRequired: false }), reclaimCase);
  bindTaxOfficePause(container, reclaimCase, () => render(container, reclaimCase, transactions));
}
