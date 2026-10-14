import "./style/tokens.css";
import "./style/base.css";
import "./components/sidebar.css";
import "./components/modal.css";
import "./components/toast.css";
import "./screens/home/home.css";
import "./screens/shell/shell.css";
import "./screens/missingData/missingData.css";
import "./screens/summaryDownload/summaryDownload.css";
import "./screens/formVerification/formVerification.css";
import "./screens/cheatSheet/cheatSheet.css";
import "./screens/profile/profile.css";
import "./screens/holdings/holdings.css";
import "./screens/chCase/chCase.css";
import "./components/statusTimeline.css";

import * as pdfjsLib from "pdfjs-dist";
// Muss vor dem ersten parseDividendCertificate()-Aufruf gesetzt sein, sonst
// wirft pdf.js "No GlobalWorkerOptions.workerSrc specified" (bekannte Vite-
// Falle, siehe Plan Abschnitt 5/Verifikation - auch unter dem GitHub-Pages-
// Unterpfad testen, nicht nur im Dev-Server).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

import { startRouter, route, navigate, setNavigationGuard } from "./router/router.js";
import { getState, setState } from "./store/store.js";
import * as profileRepo from "./db/profileRepo.js";
import * as caseRepo from "./db/caseRepo.js";
import { mountSidebar } from "./components/sidebar.js";
import { hasInvalidInput, invalidFieldLabels, clearInvalidInput } from "./util/autosave.js";

import * as home from "./screens/home/home.js";
import * as shell from "./screens/shell/shell.js";
import * as missingData from "./screens/missingData/missingData.js";
import * as summaryDownload from "./screens/summaryDownload/summaryDownload.js";
import * as formVerification from "./screens/formVerification/formVerification.js";
import * as cheatSheet from "./screens/cheatSheet/cheatSheet.js";
import * as profileScreen from "./screens/profile/profile.js";
import * as coverLetter from "./screens/coverLetter/coverLetter.js";
import * as holdingsScreen from "./screens/holdings/holdings.js";
import * as chCase from "./screens/chCase/chCase.js";
import * as dkChecklist from "./screens/dkChecklist/dkChecklist.js";

import { websiteHome } from "./config/siteLinks.js";

const app = document.getElementById("divrebound-app");
app.innerHTML = `
  <div class="app-shell">
    <div class="sidebar" id="sidebar-root"></div>
    <div class="content">
      <a class="site-bridge-btn" href="${websiteHome}">← Zur Website</a>
      <div id="content-root"></div>
    </div>
  </div>
`;
const sidebarRoot = document.getElementById("sidebar-root");
const contentRoot = document.getElementById("content-root");

let currentUnmount = null;

/** @param {{ mount(container: HTMLElement, params: object): (void | (() => void)) }} screenModule */
function mountScreen(screenModule, params) {
  if (currentUnmount) {
    currentUnmount();
    currentUnmount = null;
  }
  const result = screenModule.mount(contentRoot, params);
  if (typeof result === "function") currentUnmount = result;
}

async function ensureCaseSelected(caseId) {
  const state = getState();
  let reclaimCase = state.cases.find((c) => c.caseId === caseId);
  if (!reclaimCase) {
    reclaimCase = await caseRepo.get(caseId);
    if (reclaimCase) {
      setState({ cases: [...state.cases.filter((c) => c.caseId !== caseId), reclaimCase] });
    }
  }
  setState({ currentCase: reclaimCase ?? null });
  return reclaimCase;
}

route("#/home", () => mountScreen(home, {}));
route("#/profile", () => mountScreen(profileScreen, {}));
route("#/anschreiben", () => mountScreen(coverLetter, {}));
route("#/ch/bestand", () => mountScreen(holdingsScreen, {}));
route("#/ch/:caseId/:step", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(chCase, p);
});
route("#/dk/:caseId/checklist", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(dkChecklist, p);
});
route("#/dk/:caseId/step1", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(shell, p);
});
route("#/dk/:caseId/step1/missing-data", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(missingData, p);
});
route("#/dk/:caseId/step1/summary", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(summaryDownload, p);
});
route("#/dk/:caseId/step2/verify", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(formVerification, p);
});
route("#/dk/:caseId/step2/cheatsheet", async (p) => {
  await ensureCaseSelected(p.caseId);
  mountScreen(cheatSheet, p);
});

async function bootstrap() {
  mountSidebar(sidebarRoot);

  // Gespeichert wird automatisch beim Verlassen eines Felds (util/autosave.js) -
  // gewarnt wird nur noch, wenn eine ungültige Eingabe nicht gespeichert werden konnte.
  setNavigationGuard(() => {
    if (!hasInvalidInput()) return true;
    const ok = window.confirm(
      `${invalidFieldLabels().join(", ")}: ungültige Eingabe wurde nicht gespeichert. Seite trotzdem verlassen?`
    );
    if (ok) clearInvalidInput();
    return ok;
  });
  window.addEventListener("beforeunload", (e) => {
    if (hasInvalidInput()) e.preventDefault();
  });

  const profiles = await profileRepo.getAll();
  if (profiles.length > 0) {
    const profile = profiles[0];
    const cases = await caseRepo.getByProfileId(profile.profileId);
    setState({ currentProfile: profile, cases });
  }

  // Der Nutzer-Flow soll bei jedem (Neu-)Laden der App immer mit der
  // Startseite beginnen, auch ohne vorhandenes Profil (Profil+erster Fall
  // werden über den Popup-Dialog in components/newCaseWizard.js angelegt,
  // ausgelöst von der "Neuer DivRebound"-Kachel auf der Startseite) - bewusst
  // unabhängig vom aktuellen location.hash, nicht nur wenn dieser leer ist.
  window.location.hash = "#/home";

  startRouter();
}

bootstrap();
