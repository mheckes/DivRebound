# DivRebound – Projekt-Briefing für Claude Code

## Was ist DivRebound?

Ein Web-Tool für deutsche (später auch österreichische/schweizerische) Privatanleger, um zu viel gezahlte
ausländische Quellensteuer auf Dividenden zurückzufordern – ohne Steuerberater. MVP-Fokus: **Dänemark**,
Privatanleger (natürliche Personen), die dänische Aktien direkt halten.

Tagline: "Fair play for your dividends." / "Hol zurück, was dir zusteht."

Zielgruppe: B2C, reine Privatanleger. Kein B2B/Vermögensverwalter-Fokus (das wurde früh im Projekt
erwogen, dann aber verworfen).

## Kern-Architekturentscheidung: 100% clientseitig, kein Server

**Das ist die wichtigste Entscheidung im ganzen Projekt und darf nicht aufgeweicht werden.**

- Kein Backend, keine Datenbank, kein API-Endpunkt, an den PDFs oder personenbezogene Daten gesendet werden.
- PDF-Parsing läuft im Browser über **pdf.js** (Mozilla, Open Source).
- PDF-Erzeugung (Formular-Befüllung) läuft im Browser über **pdf-lib** (Open Source, AcroForm-Befüllung).
- Datenhaltung: **IndexedDB** im Browser des Nutzers. Kein Sync über Geräte hinweg vorgesehen – dafür gibt
  es die verschlüsselte Export-/Import-Datei (`.divrebound.json`, AES-GCM über die Web Crypto API).
- Konsequenz: Hosting kann rein statisch sein (GitHub Pages passt genau dazu). Es skaliert kostenlos mit
  der Nutzerzahl, weil jeder Nutzer seine eigene Rechenleistung mitbringt.
- Grund für diese Entscheidung: DSGVO-Konformität nicht nur als Prinzip, sondern technisch erzwungen –
  es gibt schlicht keinen Server, an den man Daten senden könnte.

**Mehrnutzer-Prinzip:** Es gibt keine geteilte/globale Instanz von Nutzerdaten. Jede Bildschirmvorlage liest
ihre Anzeigewerte zur Laufzeit aus dem lokalen Profil des Nutzers, nie aus fest im Code hinterlegten
Beispieldaten. In den Mockups ist das über ein zentrales `profile`-Objekt + `data-field`-Attribute im
Markup simuliert – das ist das Muster, das in der echten App durch echtes IndexedDB-Lesen ersetzt wird.

## Beigefügte Dateien und was sie sind

| Datei | Rolle |
|---|---|
| `divrebound_data_schema.md` | **Das Datenmodell.** TypeScript-Interfaces für InvestorProfile, ReclaimCase, CorridorConfig, Export-Datei, Validierungsregeln. Das ist die Grundlage für die tatsächliche Datenschicht (IndexedDB-Schema). |
| `divrebound_flow.mermaid` | Prozessfluss-Diagramm: Prozess A (Wohnsitzbescheinigung) + Prozess B (SKAT-Portal). |
| `parseDividendCertificate.js` | Extraktions-Parser für Dividendenabrechnungen (PDF → strukturierte Distribution-Objekte). Gegen 4 echte Abrechnungen kalibriert (Baader/Smartbroker+, comdirect, Trade Republic – 2x DK, 1x CH, 1x US zur Ablehnungs-Prüfung). **Enthält bekannte Lücken** (siehe unten). |
| `fillResidencyCertificate.js` | pdf-lib-Funktion zum Befüllen von Formular 02.050 (dänische Wohnsitzbescheinigung), 19 AcroForm-Felder, gegen Original-PDF verifiziert. |
| `divrebound_shell_mockup.html` | Hauptshell: Sidebar-Navigation + Positions-/Jahresübersicht (Schritt 1, erster Screen nach Login). |
| `divrebound_step_missing_data_mockup.html` | Schritt 1, Teil 2: fehlende Pflichtdaten ergänzen (Geburtsdatum, -ort, TIN, Ansässigkeitszeitraum). |
| `divrebound_step_summary_download_mockup.html` | Schritt 1, Teil 3: Zusammenfassung + PDF-Download (Ende Prozess A). |
| `divrebound_step_form_verification_mockup.html` | Schritt 2, Start: SKAT-Portal-Check (Start Prozess B). |
| `divrebound_cheatsheet_v3_mockup.html` | Schritt 2, Kern: das Cheat Sheet – seitengetreu zu den 6 echten SKAT-Formularseiten, mit Copy-Buttons, Fortschrittsanzeige, Plausibilitäts-Check. **Das ist der komplexeste und am weitesten ausgereifte Screen.** |
| `divrebound_profile_mockup.html` | Nutzer-Profilseite: persönliche Daten, Bankverbindung, Finanzamt, Datenschutz-Erklärung. |

**Wichtig:** Diese HTML-Dateien sind reine Mockups mit fest einprogrammierten Testdaten (Matthias Heckes,
TIN 69214187506, comdirect-Konto etc. – reale Testdaten, mit denen ein Fall auch tatsächlich schon einmal
erfolgreich eingereicht wurde) und `alert()`-Platzhaltern statt echter Funktionalität. Sie sind die
**visuelle und strukturelle Referenz**, kein direkt einsetzbarer Code. Layout, CI (Navy/Cyan), Feldreihenfolge,
Tooltips und Microcopy daraus 1:1 übernehmen – die Interaktivität muss neu, aber äquivalent gebaut werden.

## CI/Design-System (aus den Mockups extrahierbar)

```
--navy:#0F2240 (--teal-deep in den Mockup-Variablennamen, historisch bedingt)
--navy-mid:#1A3A6B
--navy-light:#E8EEF7
--cyan:#00B4D8 (--gold in den Mockup-Variablennamen)
--cyan-light:#E0F7FC
--bg:#F2F4F7; --charcoal:#111827; --muted:#6B7C93; --divider:#D8DFE8
--success:#059669; --danger:#A8433A
Fonts: DM Serif Display (Headlines) / DM Sans (Body) / JetBrains Mono (Zahlen/Codes)
Logo: Häkchen+Pfeil-Icon (siehe SVG-Pfade in den Mockups), Weiß/Cyan auf Navy
```

Design-Prinzipien, die iterativ erarbeitet wurden und beibehalten werden sollen:
- Farbe nur dort einsetzen, wo tatsächlich Handlungsbedarf besteht – nicht zusätzlich für reine Zusatzinfos.
- Erklärungen/Hintergrundwissen in einklappbare `<details>/<summary>`-Boxen, standardmäßig zu, nicht als
  permanent sichtbare Banner.
- Sidebar-Navigation über native `<details>/<summary>` statt eigenem JS-Aufklapp-Mechanismus.
- Zahlenspalten rechtsbündig, Tabellen mit klarer Zwischensummen-/Gesamt-Logik.

## Prozessfluss (siehe auch `divrebound_flow.mermaid`)

**Prozess A – Wohnsitzbescheinigung (Schritt 1):**
1. Privatvermögen-Gate → Zielland (DK) → Wohnsitzland (DE/AT/CH)
2. Multi-PDF-Upload → ISIN-Präfix-Check (`^DK`, nur Aktien) → Positions-/Jahresübersicht
3. Duplikat-Erkennung (gleiche ISIN+Zahltag+Betrag bereits in anderem Case?) + Ablehnungs-Anzeige für
   nicht passende ISINs – beides als eine einklappbare Hinweiszeile, nicht als separate Karten
4. Fehlende Pflichtdaten ergänzen (Geburtsdatum, -ort, TIN, Ansässigkeitszeitraum)
5. Zusammenfassung → PDF-Download (Formular 02.050) → Bearbeitungsstand speichern (.divrebound.json) +
   optionale ICS-Erinnerung
6. Case-Status: `awaiting_tax_office` (Medienbruch, 2–3 Wochen Wartezeit auf Finanzamt-Bestätigung)

**Prozess B – SKAT-Portal (Schritt 2):**
7. Formular-Verifizierung: SKAT-Portal in neuem Tab öffnen, Seitentitel bestätigen
8. Cheat Sheet: 6 Tabs = 6 echte SKAT-Formularseiten (About the claimant / About the shareholder / Refund
   information / Other documentation / Payment information / Summary). Nutzer ordnet Browserfenster
   nebeneinander an (**bewusst keine Simulation der SKAT-Seite im Tool selbst** – das wurde verworfen,
   weil es genau den Platz blockiert, den der Nutzer für sein echtes Browserfenster braucht).
9. "Refund information" ist pro Aktie wiederholbar (SKAT: "Create new record", max. 20 Aktien/Antrag).
10. Summary-Seite (Tab 6): hier wird nichts Neues eingetragen, nur geprüft – Cheat Sheet zeigt eine kurze
    Checkliste statt Wiederholung aller Felder, plus Erinnerung "vor dem Senden ausdrucken/als PDF speichern".
11. "Als eingereicht markieren" (umschaltbar) setzt Case-Status auf `submitted` und schaltet den
    Sidebar-Status auf erledigt. Erst danach wird der Button "Bearbeitungsstand speichern" aktiv –
    das ist bewusst kein Zwischenstand-Backup, sondern eine Jahres-Historie für künftige Steuerjahre.

## Bekannte, bewusst offene Lücken im Parser (`parseDividendCertificate.js`)

- Nur 4 Broker-Layouts kalibriert (Baader/Smartbroker+, comdirect, Trade Republic). Andere Broker
  (DKB, Consorsbank, etc.) werden vermutlich zunächst fehlschlagen – das ist erwartbar, kein Bug.
- Bei Extraktionsfehlern/-unsicherheit: **niemals raten**, sondern auf den "Fehlende Angaben"-Screen
  weiterleiten, wo der Nutzer manuell bestätigt/korrigiert. `extractionConfidence` im Schema
  (`"extracted" | "user_confirmed" | "user_corrected"`) bildet das ab.

## Wichtige Nuancen aus dem Datenmodell (Details siehe `divrebound_data_schema.md`)

- **Adresse ist kein reines Profil-Feld:** Bei Case-Anlage wird ein `applicantSnapshot` erzeugt (Kopie aus
  dem Profil). Spätere Profiländerungen wirken sich **nur auf neu angelegte Cases** aus, nie rückwirkend.
  Erkennt der Parser beim Hochladen eine abweichende Adresse, wird das als Ein-Klick-Angebot
  "Benutzerprofil enthält noch X · Aktualisieren" angezeigt – nie automatisch überschrieben.
- **"Amount of refund" wird von SKAT selbst berechnet** – unsere eigene Berechnung (Brutto × 12% bei DK)
  ist nur ein Plausibilitäts-Check im Cheat Sheet, kein Wert, der ins SKAT-Formular übertragen wird.
- **Bankverbindung** = das Konto, auf das die Erstattung fließen soll. Kriterium: kann es SEPA-Überweisungen
  empfangen? Das kann das Broker-Konto sein (in einer echten Einreichung war es das), muss aber nicht.

## Build-Reihenfolge (Empfehlung)

Bewusst eng geschnitten fürs MVP – **kein** AT/CH-TIN-Format, **kein** institutioneller Anleger-Zweig,
**kein** Schweiz-Korridor. Diese sind im Schema als "bewusst nicht Teil von V1" markiert.

1. **Grundgerüst:** Projekt-Setup, Routing zwischen den Screens, IndexedDB-Schicht nach `divrebound_data_schema.md`
2. **CI/Layout:** Sidebar-Shell + Navigation aus den Mockups übernehmen, funktional statt statisch
3. **Upload + Parser-Integration:** `parseDividendCertificate.js` an echten Datei-Upload anschließen,
   Positions-/Jahresübersicht mit echten (nicht mehr fest einprogrammierten) Daten befüllen
4. **Fehlende-Angaben-Screen + Zusammenfassung:** inkl. echter Ansässigkeitszeitraum-Ableitung
5. **PDF-Erzeugung:** `fillResidencyCertificate.js` an echten Download-Button anschließen
6. **Export/Import:** `.divrebound.json` mit echter AES-GCM-Verschlüsselung
7. **Formular-Verifizierung + Cheat Sheet:** überwiegend Anzeige-Logik, kein neuer Dateizugriff nötig –
   sollte vergleichsweise schnell gehen, da schon fast vollständig im Mockup durchgespielt
8. **Profilseite:** persönliche Daten dauerhaft in IndexedDB, Wiederverwendung über Cases hinweg

## Rechtliches (nicht vergessen, aber nicht Teil des Codes)

Ein Impressum ist in Deutschland für jede öffentlich erreichbare Website Pflicht, auch für ein kostenloses
MVP. Das ist kein Claude-Code-Thema, aber sollte vor dem Live-Schalten der GitHub-Pages-URL angelegt werden.
