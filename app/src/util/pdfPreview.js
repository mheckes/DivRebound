// "Vorschau" für erzeugte PDFs (Formular, Anschreiben): öffnet das PDF in
// einem neuen Tab, ohne es herunterzuladen. Das Fenster wird vor dem await
// geöffnet - danach zählt der Klick nicht mehr als Nutzeraktion und der
// Browser würde das Pop-up blockieren.

import { showToast } from "../components/toast.js";

/** @param {() => Promise<Uint8Array>} buildBytes */
export async function openPdfPreview(buildBytes) {
  const win = window.open("", "_blank");
  try {
    const bytes = await buildBytes();
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (win) win.location.href = url;
    else if (!window.open(url, "_blank")) {
      showToast("Die Vorschau wurde vom Browser blockiert. Bitte Pop-ups erlauben oder das PDF herunterladen.");
    }
  } catch (err) {
    win?.close();
    console.error("[pdfPreview] Vorschau fehlgeschlagen:", err);
    showToast(`Vorschau fehlgeschlagen: ${err.message}`);
  }
}
