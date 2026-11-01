// Status-Zeitleiste Dänemark (gleicher Baustein wie Schweiz und Italien,
// docs/konzept-schweiz.md §1a) - auf "Formular & Finanzamt" und "Einreichen & abschließen".

import { getState, setState } from "../../store/store.js";
import * as caseRepo from "../../db/caseRepo.js";
import { statusTimelineHtml, bindStatusTimeline, timelineTitle } from "../../components/statusTimeline.js";
import { refundReceived } from "../../util/caseProgress.js";
import { dkRefund, formatDkk } from "./dkShared.js";

const STATUS_ORDER = ["draft", "residency_form_generated", "awaiting_tax_office", "ready_for_skat_submission", "skat_form_verified", "submitted"];

export const DK_TIMELINE = [
  { label: "Formular erstellt", where: "DivRebound" },
  { label: "Unterschrieben & versendet", where: "Post" },
  { label: "Vom Finanzamt bestätigt", where: "Finanzamt" },
  { label: "Bei SKAT eingereicht", where: "SKAT-Portal" },
  { label: "Ausgezahlt", where: "Konto" },
];

/** Gespeicherter Fortschritt, mindestens aber aus dem Fall abgeleitet. */
export function dkTimelineDone(reclaimCase) {
  let derived = reclaimCase.generatedDocuments.some((d) => d.type === "residency_certificate") ? 1 : 0;
  if (reclaimCase.status === "submitted") derived = 4;
  if (refundReceived(reclaimCase).received) derived = 5;
  return Math.max(reclaimCase.timelineStep ?? 0, derived);
}

export function dkTimelineHtml(reclaimCase) {
  const title = timelineTitle("Wohnsitzbescheinigung 02.050", 1, formatDkk(dkRefund(reclaimCase).total));
  return statusTimelineHtml({ title, steps: DK_TIMELINE, doneCount: dkTimelineDone(reclaimCase) });
}

/** @param {() => void} rerender */
export function bindDkTimeline(container, reclaimCase, rerender) {
  bindStatusTimeline(container, () => dkTimelineDone(reclaimCase), async (n) => {
    reclaimCase.timelineStep = n;
    // "Vom Finanzamt bestätigt" heißt: bereit für das SKAT-Portal.
    if (n >= 3 && STATUS_ORDER.indexOf(reclaimCase.status) < STATUS_ORDER.indexOf("ready_for_skat_submission")) {
      reclaimCase.status = "ready_for_skat_submission";
    }
    await caseRepo.put(reclaimCase);
    const cases = getState().cases.map((c) => (c.caseId === reclaimCase.caseId ? reclaimCase : c));
    setState({ currentCase: reclaimCase, cases });
    rerender();
  });
}
