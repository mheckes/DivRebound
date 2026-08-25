# DivRebound

**Fair play for your dividends.** Hol zurück, was dir zusteht.

DivRebound ist ein Web-Tool für deutsche, österreichische und schweizerische Privatanleger, um zu viel
gezahlte ausländische Quellensteuer auf Dividenden zurückzufordern – ohne Steuerberater.

**MVP-Fokus:** Dänemark, Privatanleger (natürliche Personen), die dänische Aktien direkt im Depot halten.

## Architektur

DivRebound läuft **100 % clientseitig, ohne Server**:

- Kein Backend, keine Datenbank, kein API-Endpunkt, an den PDFs oder personenbezogene Daten gesendet werden.
- PDF-Parsing (Dividendenabrechnungen) läuft im Browser über [pdf.js](https://mozilla.github.io/pdf.js/).
- PDF-Erzeugung (Formular-Befüllung) läuft im Browser über [pdf-lib](https://pdf-lib.js.org/).
- Datenhaltung: IndexedDB im Browser des Nutzers. Kein automatischer Sync über Geräte hinweg – dafür
  gibt es eine verschlüsselte Export-/Import-Datei (`.divrebound.json`, AES-GCM über die Web Crypto API).

Diese Entscheidung ist bewusst: DSGVO-Konformität wird damit nicht nur als Prinzip verfolgt, sondern
technisch erzwungen – es gibt schlicht keinen Server, an den Daten gesendet werden könnten. Als Konsequenz
lässt sich die App rein statisch hosten (z. B. GitHub Pages) und skaliert kostenlos mit der Nutzerzahl.

## Tech-Stack

- [Vite](https://vitejs.dev/) + Vanilla JavaScript (kein Framework)
- [pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist), [pdf-lib](https://www.npmjs.com/package/pdf-lib)
- [idb](https://www.npmjs.com/package/idb) als schlanker IndexedDB-Wrapper

## Lokal starten

```bash
cd app
npm install
npm run dev
```

Production-Build:

```bash
npm run build
npm run preview
```

## Deployment

Der Build wird automatisch per GitHub Actions (`.github/workflows/deploy.yml`) auf GitHub Pages
veröffentlicht, bei jedem Push auf `main`.

## Projektstruktur

```
app/                          Vite-App (der eigentliche, lauffähige Code)
Mock Up Status 08-2026/       Referenz: HTML-Mockups, Datenmodell, Prozessfluss
DivRebound CI/                Referenz: Corporate-Design-Guide
Dänemark/                     Formularvorlage 02.050 (dänische Wohnsitzbescheinigung)
```

## Scope (MVP)

Bewusst eng geschnitten: nur Dänemark als Zielland, nur Privatanleger (kein institutioneller Zweig),
nur DE/AT/CH als Wohnsitzländer. Details siehe `Mock Up Status 08-2026/divrebound_data_schema.md`.
