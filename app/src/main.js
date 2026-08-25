import "./style/tokens.css";
import "./style/base.css";
import "./components/sidebar.css";
import "./components/modal.css";
import "./screens/onboarding/onboarding.css";
import "./screens/shell/shell.css";
import "./screens/missingData/missingData.css";
import "./screens/summaryDownload/summaryDownload.css";
import "./screens/formVerification/formVerification.css";
import "./screens/cheatSheet/cheatSheet.css";
import "./screens/profile/profile.css";

import * as pdfjsLib from "pdfjs-dist";
// Muss vor dem ersten parseDividendCertificate()-Aufruf gesetzt sein, sonst
// wirft pdf.js "No GlobalWorkerOptions.workerSrc specified" (bekannte Vite-
// Falle, siehe Plan Abschnitt 5/Verifikation - auch unter dem GitHub-Pages-
// Unterpfad testen, nicht nur im Dev-Server).
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

import { startRouter, route, navigate } from "./router/router.js";
import { getState, setState } from "./store/store.js";
import * as profileRepo from "./db/profileRepo.js";
import * as caseRepo from "./db/caseRepo.js";
import { mountSidebar } from "./components/sidebar.js";

import * as onboarding from "./screens/onboarding/onboarding.js";
import * as shell from "./screens/shell/shell.js";
import * as missingData from "./screens/missingData/missingData.js";
import * as summaryDownload from "./screens/summaryDownload/summaryDownload.js";
import * as formVerification from "./screens/formVerification/formVerification.js";
import * as cheatSheet from "./screens/cheatSheet/cheatSheet.js";
import * as profileScreen from "./screens/profile/profile.js";

const app = document.getElementById("divrebound-app");
app.innerHTML = `
  <div class="app-shell">
    <div class="sidebar" id="sidebar-root"></div>
    <div class="content" id="content-root"></div>
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

route("#/onboarding", () => mountScreen(onboarding, {}));
route("#/profile", () => mountScreen(profileScreen, {}));
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

  const profiles = await profileRepo.getAll();
  if (profiles.length > 0) {
    const profile = profiles[0];
    const cases = await caseRepo.getByProfileId(profile.profileId);
    setState({ currentProfile: profile, cases });
    if (!window.location.hash || window.location.hash === "#/") {
      window.location.hash = cases.length > 0 ? `#/dk/${cases[0].caseId}/step1` : "#/onboarding";
    }
  } else if (!window.location.hash || window.location.hash === "#/") {
    window.location.hash = "#/onboarding";
  }

  startRouter();
}

bootstrap();
