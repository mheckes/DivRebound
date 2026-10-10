# DivRebound — Architekturkonzept Website + App-Integration

**Status:** Abgestimmt, bereit zur Übergabe an Claude Code (Stand 10.10.2026)
**Ziel dieses Dokuments:** Grundlage für die Implementierung durch Claude Code — enthält Architektur, Menü-/Seitenstruktur, Inhalte, Design-Referenzen und eine konkrete Aufgabenliste.
**Visuelle Referenz:** `divrebound-website-prototyp.html` (klickbarer Prototyp). Bei Abweichungen zwischen Dokument und Prototyp gilt der Prototyp für Layout und Texte. Er gehört als `docs/prototyp.html` ins Repo.

---

## 0. Entscheidungsgrundlage (aus Abstimmung mit Matthias)

| Frage | Entscheidung |
|---|---|
| Tech-Stack | Offen gelassen ("schlag was vor") → **Empfehlung: Jekyll**, siehe Abschnitt 1 |
| Domain | GitHub Pages Subdomain (kein Custom Domain aktuell) |
| Verhältnis Marketing-CI ↔ App-CI | Langfristig **ein gemeinsames CI** |
| Aktuelles CI | **Navy/Cyan** ("Variante B"), nicht mehr Teal/Gold — siehe Abschnitt 3 |
| Farbmodus der Website | **Hell** (Seitenhintergrund `--bg`), Header und Hero in Navy |
| Header | Durchgehend Navy, Menüpunkte und CTA mittig, CTA heißt „Zur DivRebound App" |
| App-Navigation | **Variante A:** Seitenleiste bleibt, Button „← Zur Website" oben rechts im Inhaltsbereich, Rechtliches im Fuß der Seitenleiste (Abschnitt 4a) |
| Länder-Daten | Stiftung Warentest Finanztest 10/2026 (S. 83), nur Regelsatz, 16 Länder (Abschnitt 5a) |
| Unterstützte Länder | Dänemark verfügbar. Österreich und Frankreich nicht geplant (Aufwand, Bürokratie, Kosten). Übrige „in Planung" |
| Unternehmenslogos | Keine, nur Textnamen (Marken, mögliche Kooperationsanmutung) |

---

## 1. Tech-Stack-Empfehlung: Jekyll (nativ auf GitHub Pages)

**Empfehlung: Jekyll**, GitHub Pages' eingebauter Generator — kein zusätzliches Build-Tool, kein GitHub-Actions-Workflow nötig.

**Warum:**
- GitHub Pages baut Jekyll-Repos automatisch bei jedem Push — kein `npm run build`, keine CI-Pipeline, kein zusätzlicher Wartungsaufwand. Passt zu eurem Grundsatz "einfache statt technisch vollständige Lösungen".
- Layouts/Includes (`_layouts`, `_includes`) verhindern Copy-Paste von Header/Footer/Nav über mehrere HTML-Dateien — genau das Problem, das bei der bisherigen CI-Einzeldatei sonst bei 4+ Seiten entstehen würde.
- Neue Inhalte = neue Markdown-Datei mit Front Matter. Kein Template-Umbau nötig → erfüllt die geforderte Erweiterbarkeit direkt.
- Die DivRebound-App selbst bleibt komplett unangetastet: Jekyll verarbeitet nur Dateien mit Front Matter oder `.md`; ein Ordner mit fertigem HTML/CSS/JS (eure App) wird unverändert 1:1 durchgereicht ("passthrough"), solange er nicht mit `_` beginnt.

**Grenzen, die du kennen solltest:**
- GitHub Pages erlaubt beim nativen Jekyll-Build nur eine Whitelist an Plugins (`github-pages`-Gem). Für dieses Projekt reicht das völlig (wir brauchen kein Plugin, evtl. später `jekyll-sitemap`, das ist in der Whitelist enthalten).
- Falls ihr später React-Komponenten, MDX o.ä. wollt, braucht es einen echten Build-Schritt (z. B. Astro/Eleventy + GitHub-Actions-Workflow, der nach `gh-pages` deployed). Das ist ein sauberer Upgrade-Pfad, aber für den aktuellen Umfang (4 Seiten + App-Link) unnötige Komplexität.

**Alternative, falls Claude Code lieber ganz ohne Jekyll arbeitet:** Reines statisches HTML mit manuellem Header/Footer in jeder Datei (wie eure bisherige CI-Datei) — funktioniert genauso auf GitHub Pages, aber jede Nav-Änderung muss in jeder Datei einzeln gepflegt werden. Empfehlung bleibt Jekyll.

---

## 2. Repository- & Hosting-Architektur

**Ein Repository, ein GitHub-Pages-Deployment.** Marketing-Website und App leben nebeneinander im selben Repo, die App als unverändertes Unterverzeichnis.

```
repo-root/
├─ _config.yml                 # Jekyll-Konfiguration (title, baseurl, nav-Daten)
├─ _layouts/
│  ├─ default.html             # <head>, Header, Footer, Meta/OG-Tags
│  └─ page.html                # Standard-Content-Seite (erbt von default)
├─ _includes/
│  ├─ header.html              # Logo + Hauptnavigation
│  ├─ footer.html              # Footer-Navigation (Impressum, Datenschutz, Kontakt)
│  └─ nav.html                 # rendert _data/nav.yml
├─ _data/
│  └─ nav.yml                  # zentrale Nav-Definition — neue Seite = neuer Eintrag
├─ assets/
│  ├─ css/
│  │  ├─ tokens.css            # Farb-/Typo-Variablen — SINGLE SOURCE OF TRUTH (s. Abschnitt 3)
│  │  └─ site.css              # Marketing-spezifische Styles
│  ├─ img/                     # Logo-SVGs, Screenshots, OG-Image, Favicon
│  └─ fonts/                   # optional, falls selbst gehostet statt Google Fonts CDN
├─ index.md                    # (a) Startseite
├─ ueber-mich.md               # (c) Über mich
├─ impressum.md                # (d) Impressum
├─ datenschutz.md              # empfohlene Ergänzung, siehe Abschnitt 7
├─ 404.html                    # optional, GitHub Pages unterstützt das nativ
└─ app/                        # (b) DivRebound App — komplett eigenständig, von Jekyll unverändert durchgereicht
   ├─ index.html               # bestehender/künftiger App-Entry-Point
   ├─ js/ …
   ├─ css/ …
   └─ …                        # pdf.js, pdf-lib, IndexedDB-Logik etc. — unverändert
```

### Navigation Website → App
Ein prominenter CTA-Button ("Zur App" / "Depot verbinden") verlinkt direkt auf `/app/`. Kein Iframe — die App bekommt die volle Fensterbreite/-höhe und ihre eigene Navigation, das ist für eine Anwendung mit Sidebar-Navigation und mehreren Schritten die richtige Wahl.

### Navigation App → Website
Siehe Abschnitt 4a. Kurzfassung: Die App behält ihre Seitenleiste. Sie bekommt oben rechts im Inhaltsbereich den Button „← Zur Website" und im Fuß der Seitenleiste die Links Über mich, Impressum, Datenschutz.

### Domain-Vorbereitung
Da ihr aktuell auf der GitHub-Pages-Subdomain bleibt (`https://<username>.github.io/<repo>/`), sollte `_config.yml` mit `baseurl: "/<repo>"` arbeiten und alle internen Links über Jekylls `relative_url`-Filter statt hartcodierter Pfade laufen. Vorteil: Ein späterer Umzug auf eine eigene Domain (z. B. divrebound.de) reduziert sich auf "CNAME-Datei anlegen, `baseurl` leeren" — kein Link-Refactoring nötig.

**Offener Punkt:** Der finale Repo-Name bestimmt den öffentlichen Pfad (`.../<repo>/`). Empfehlung: `divrebound` als Repo-Name wählen, bevor Claude Code loslegt — das wird sonst später eine URL-Migration.

---

## 3. Design-System (CI)

Bestätigt anhand deiner beiden Anhänge: **Navy/Cyan ("Variante B")** ist das aktuell gültige CI — sowohl für Website als auch App. Teal/Gold ("Variante A") ist verworfen.

### Farbpalette

| Token | Wert | Verwendung |
|---|---|---|
| `--navy` | `#0F2240` | Primary · Brand, Hero-Hintergrund |
| `--navy-mid` | `#1A3A6B` | Secondary · Hover |
| `--navy-light` | `#E8EEF7` | Surface · Chip-Hintergrund |
| `--cyan` | `#00B4D8` | Accent · CTA, Logo-Pfeil |
| `--cyan-light` | `#E0F7FC` | Chip-Hintergrund hell |
| `--bg` | `#F2F4F7` | Seiten-Hintergrund |
| `--surface` | `#FFFFFF` | Karten/Cards |
| `--charcoal` | `#111827` | Text, Überschriften |
| `--muted` | `#6B7C93` | Sekundärtext |
| `--divider` | `#D8DFE8` | Trennlinien |
| `--success` | `#059669` / `#D1FAE5` | Status "erstattet" |

### Typografie
- **Display/Headlines:** DM Serif Display (inkl. Italic für Akzente wie *„zusteht"*)
- **Body/UI:** DM Sans (400/500/600)
- **Daten/Mono:** JetBrains Mono (Beträge, ISINs, Prozentwerte, Statuscodes)

### Logo
Finales Logomark laut `DivRebound_Logo_Refresh.html` ("Logo Refresh v3"): Häkchen (weiß) das in einen aufwärts zeigenden Pfeil (Cyan, mit Pfeilspitze) übergeht — auf Navy-Kachel oder freistehend. Ersetzt frühere Icon-Varianten (Doppelbogen-Kreislauf aus der v2-CI, Doppelpfeil aus der ursprünglichen v1-CI).

### Umsetzung: `assets/css/tokens.css`
Alle Farb-/Font-Variablen kommen in **eine** CSS-Datei mit `:root { --navy: #0F2240; … }`, die sowohl von den Jekyll-Layouts **als auch** von `app/index.html` eingebunden wird (einfacher `<link>`-Tag, kein Build-Schritt nötig). Das ist der konkrete technische Hebel für "langfristig vereinheitlichen": Website und App sind laut deinen Vorlagen bereits auf demselben Navy/Cyan-CI — die gemeinsame Token-Datei stellt sicher, dass das so bleibt, statt in zwei Dateien zu divergieren.

### Screenshots/Beispiele auf der Website
Punkt 4 deiner Vorgabe ("aktuelle Screenshots aus der aktuellen App") — Status: Die App befindet sich laut Projektstand noch im Design/Konzept, nicht im aktiven Build. Für den ersten Website-Launch wird ein Screenshot der Positionsübersicht verwendet, mit verallgemeinerten Namen, Beträgen und persönlichen Daten, Kennzeichnung „Beispielansicht". Keine Smartphone-Ansicht. Sobald der echte Build steht: 1:1-Austausch der Bilddateien in `assets/img/`, keine Layout-Änderung nötig.

---

## 4. Menüstruktur

**Hauptnavigation (Header, auf jeder Seite sichtbar):**

```
[Logo DivRebound]        Startseite   Über mich   [Zur DivRebound App]
```

- „Zur DivRebound App" bewusst als **CTA-Button** (Cyan, gefüllt), nicht als gleichwertiger Textlink — das ist die wichtigste Aktion auf der Seite.
- „Wie funktioniert's" wird **nicht** als eigener Nav-Punkt geführt, sondern als Anker-Sektion auf der Startseite (siehe Abschnitt 5) — passt zur einfachen Struktur mit aktuell nur 3 Content-Seiten. Sobald mehr Erklärinhalt entsteht (z. B. pro Korridor), aus dem Anker eine eigene Seite machen und in `_data/nav.yml` ergänzen.

**Footer-Navigation (auf jeder Seite):**

```
Impressum   ·   Datenschutz   ·   Über mich
```

Impressum/Datenschutz gehören in Deutschland konventionell in den Footer, nicht in die Hauptnavigation — das entspricht auch gängigem Nutzererwartung.

**Erweiterbarkeit:** Beide Navigationsblöcke werden aus `_data/nav.yml` gerendert:

```yaml
main:
  - title: "Startseite"
    url: "/"
  - title: "Über mich"
    url: "/ueber-mich/"
cta:
  title: "Zur DivRebound App"
  url: "/app/"
footer:
  - title: "Impressum"
    url: "/impressum/"
  - title: "Datenschutz"
    url: "/datenschutz/"
```

Neue Seite später (z. B. „Korridore" oder „FAQ") = neue Markdown-Datei + ein Eintrag in dieser YAML-Datei. Kein Template-Eingriff.

---

## 4a. Navigation zwischen Website und App

**Ausgangslage:** Die Website hat oben eine Menüleiste (Navy, Menüpunkte mittig). Die App hat keine Top-Leiste, nur eine Seitenleiste. Dort gibt es bisher keinen Weg zurück zur Website und keinen Zugang zu Impressum und Datenschutz.

**Prinzip:** Zwei Oberflächen, ein Erscheinungsbild. Die App behält ihre Seitenleiste (die Schritt-Navigation braucht sie, und der Platz soll für das SKAT-Portal-Fenster frei bleiben). Die Website bleibt eine Website. Die Übergänge sind symmetrisch gestaltet.

| Von → Nach | Wo | Element |
|---|---|---|
| Website → App | Header rechts, außerdem Hero und Abschluss-Band | Button „Zur DivRebound App" |
| App → Website | Inhaltsbereich der App, oben rechts in der Kopfzeile (gleiche Position wie der CTA auf der Website, gespiegelt) | Button „← Zur Website" |
| App → Rechtliches | Fuß der Seitenleiste, immer sichtbar | Links Über mich · Impressum · Datenschutz |
| Website → App (zurückkehrend) | Header rechts | Button wechselt zu „Zurück zur App", sobald die App schon einmal geöffnet wurde |

**Regeln**
1. **Logo-Verhalten:** Auf der Website führt das Logo zur Startseite. In der App führt es zur App-Startseite (Home). Das entspricht der üblichen Erwartung in Anwendungen.
2. **Gleiche Optik an der Übergangsstelle:** Header der Website und Seitenleiste der App sind beide Navy, das Logo steht beide Male oben links. Der Wechsel wirkt dadurch wie ein Umschalten innerhalb eines Produkts.
3. **Impressum immer erreichbar:** Die Pflichtangaben müssen von jeder Seite leicht erreichbar sein, auch aus der App. Deshalb stehen die Links im Fuß der Seitenleiste (kein Rechtsrat, bitte prüfen lassen).
4. **Kein Datenverlust beim Wechsel:** Website und App liegen auf derselben Origin (GitHub Pages, gleiches Repo). IndexedDB bleibt beim Wechsel erhalten. Offene Fälle gehen nicht verloren.
5. **Zurück zur App:** Die App setzt beim Öffnen einen Marker in `localStorage` (z. B. `divrebound.lastVisit`, optional mit letztem Fall und Schritt). Die Website liest ihn und schaltet den CTA auf „Zurück zur App". Optional kann der Link direkt in den letzten Schritt springen.
6. **Routing in der App:** Hash-Routing (`/app/#/dk/2026-09/schritt-1`) statt History-API. GitHub Pages kennt keine serverseitigen Rewrites, Deep Links wären sonst 404. Der Zurück-Button des Browsers springt so zwischen den App-Schritten und verlässt die App nicht unerwartet.
7. **Eine Quelle für Links:** Die Website-Links in der App (Über mich, Impressum, Datenschutz, Startseite) kommen aus einer gemeinsamen Datei (`/assets/js/site-links.js` oder `_data/nav.yml`, in die App gespiegelt), damit neue Seiten an einer Stelle gepflegt werden.

**Entscheidung: Variante A.** Die Alternative B (schmale Top-Leiste, ca. 48 px, Logo wandert aus der Seitenleiste) wurde verworfen, weil sie Höhe kostet, die Tabellen und Cheat Sheet brauchen. Der Prototyp enthält B noch als Schalter. Umgesetzt wird nur A.

**Änderungen an der App (Umfang):**
- Kopfzeile des Inhaltsbereichs: Button „← Zur Website" rechts neben Titel und Breadcrumb
- Fuß der Seitenleiste: drei Textlinks
- Marker in `localStorage` beim Start
- Hash-Routing, falls noch nicht vorhanden
- Gemeinsame `tokens.css` einbinden (siehe Abschnitt 3)

Der Prototyp zeigt A in der App-Ansicht. „Neues markieren" im schwarzen Prototyp-Balken hebt alle neuen Elemente hervor.

---

## 5. Seitenstruktur (Sitemap)

| Pfad | Seite | Inhalt | Layout |
|---|---|---|---|
| `/` | **Startseite** | Hero mit Value Proposition, Wie-funktioniert's-Sektion, CTA zur App | `default` |
| `/app/` | **App** | Vollständige DivRebound-Anwendung (eigenständig, eigenes Design-Shell) | keine Jekyll-Layout — eigenständiges HTML |
| `/ueber-mich/` | **Über mich** | Person/Motivation hinter DivRebound, Vertrauensaufbau | `page` |
| `/impressum/` | **Impressum** | Pflichtangaben nach § 5 DDG | `page` |
| `/datenschutz/` | **Datenschutz** *(empfohlene Ergänzung)* | Datenschutzerklärung | `page` |

**Später denkbar (Struktur trägt das bereits, ohne Umbau):**
- `/korridore/ch/`, `/korridore/dk/`, `/korridore/fr/` — je eigene Erklärseite pro Land, falls die Anker-Sektion zu voll wird
- `/faq/`
- `/blog/` bzw. `/updates/` — via Jekyll-Collection `_posts/`, native Unterstützung vorhanden
- `/kontakt/`

### Startseite im Detail (Referenz: Prototyp)

1. **Header** (Navy): Logo links, mittig Startseite · Über mich · CTA „Zur DivRebound App". Nach einem App-Besuch steht im CTA „Zurück zur App".
2. **Hero** (Navy-Karte): Eyebrow „Quellensteuer-Erstattung · automatisiert", Headline „Fair play for your *dividends*.", Subline zur Dividendenabrechnung, CTAs „Abrechnung hochladen" (primär) und „Wie es funktioniert →" (sekundär), drei Kennzahlen:
   - „bis zu 30 %" Quellensteuer rückforderbar, abhängig vom Land
   - „3 Schritte" Rückerstattung in wenigen Klicks, intuitive Anleitung, kein Vorwissen nötig
   - „bis zu 4 J." rückwirkende Erstattung möglich, abhängig vom Land
3. **Wie es funktioniert** (Anker): drei Schritte
   - Schritt 1: Dividendenabrechnung hochladen, DivRebound wertet sie aus und erkennt die rückforderbare Quellensteuer
   - Schritt 2: Antrag erstellen, je nach Land werden die nötigen Formulare erzeugt, ein Cheat Sheet hilft beim Ausfüllen der Online-Formulare
   - Schritt 3: Einreichen und zurückbekommen, benötigte Dokumente und Formulare je nach Land einreichen, warten, Erstattung erhalten
4. **Ein Blick in die App:** Desktop-Ansicht nach dem echten App-Screenshot (Seitenleiste und Positionsübersicht), Namen und Beträge verallgemeinert („Muster A/S"), keine Smartphone-Ansicht
5. **In diesen Ländern zurückholen:** Länder-Tabelle (Abschnitt 5a)
6. **Von diesen Unternehmen ist Erstattung möglich:** Europakarte mit Länderkarten (Abschnitt 5a)
7. **Abschluss-CTA:** „Bereit, dir zurückzuholen, was dir zusteht?" mit Button „Abrechnung hochladen"
8. **Footer:** Impressum · Datenschutz · Über mich

### 5a. Länder-Tabelle und Europakarte

**Datenquelle:** Stiftung Warentest Finanztest 10/2026, S. 83 („Quellensteuersätze von 37 Ländern"), Datenbasis Bundeszentralamt für Steuern, Stand 10. Mai 2026. Nur Dividenden, nur Regelsatz, Angaben in Prozentpunkten. Länder ohne Erstattungsanspruch sind nicht aufgeführt. Zusätzlich entfernt: China, USA, Südafrika, Lettland.

**Daten gehören in `_data/countries.yml`**, nicht in die HTML-Datei. Neue Länder oder geänderte Status sind dann eine Zeile. Felder: `name`, `rate` (Quellensteuersatz), `creditable` (in Deutschland anrechenbar), `potential` (Erstattungspotenzial), `status` (`live` | `planned` | `no`), optional `companies` und `code`.

```yaml
- {name: Belgien,    rate: 30,   creditable: 0,    potential: 30,   status: planned}
- {name: Irland,     rate: 25,   creditable: 0,    potential: 25,   status: planned}
- {name: Finnland,   rate: 35,   creditable: 15,   potential: 20,   status: planned}
- {name: Schweiz,    rate: 35,   creditable: 15,   potential: 20,   status: planned, code: CH, companies: [Nestlé, Roche, Zurich Insurance, Swiss Re]}
- {name: Israel,     rate: 25,   creditable: 10,   potential: 15,   status: planned}
- {name: Schweden,   rate: 30,   creditable: 15,   potential: 15,   status: planned, code: SE, companies: [Volvo, Svenska Handelsbanken, Investor AB]}
- {name: Portugal,   rate: 28,   creditable: 15,   potential: 13,   status: planned}
- {name: Österreich, rate: 27.5, creditable: 15,   potential: 12.5, status: no}
- {name: Frankreich, rate: 25,   creditable: 12.8, potential: 12.2, status: no}
- {name: Dänemark,   rate: 27,   creditable: 15,   potential: 12,   status: live,    code: DK, companies: [Novo Nordisk, Maersk, Carlsberg]}
- {name: Italien,    rate: 26,   creditable: 15,   potential: 11,   status: planned, code: IT, companies: [Enel, Generali, Eni, UniCredit]}
- {name: Kanada,     rate: 25,   creditable: 15,   potential: 10,   status: planned}
- {name: Norwegen,   rate: 25,   creditable: 15,   potential: 10,   status: planned}
- {name: Südkorea,   rate: 20,   creditable: 15,   potential: 5,    status: planned}
- {name: Polen,      rate: 19,   creditable: 15,   potential: 4,    status: planned}
- {name: Spanien,    rate: 19,   creditable: 15,   potential: 4,    status: planned, code: ES, companies: [Iberdrola, Banco Santander, BBVA, Telefónica]}
```

**Tabelle:** Spalten Land · Quellensteuersatz · In DE anrechenbar · Erstattungspotenzial („bis zu x %") · DivRebound (Badge „verfügbar" grün, „in Planung" blau, „nicht geplant" grau). Sortierung nach Potenzial absteigend. Quellenzeile unter der Tabelle mit Hinweis „Richtwerte" und Begründung, warum Österreich und Frankreich nicht unterstützt werden. Auf dem Handy bleiben Land, Potenzial und Status.

**Europakarte:**
- Eingebettetes SVG im Prototyp (generiert aus Natural-Earth-Daten über das npm-Paket `world-atlas`, vereinfacht). Für die Umsetzung als Datei `assets/img/europa-karte.svg` ablegen.
- Länder mit `companies` in Cyan, übrige Länder mit Erstattung in mittlerem Blau, alles andere dunkel. Labels mit Land und Potenzial nur bei Ländern mit Beispielunternehmen.
- Rechts neben der Karte pro Land eine Karte mit Potenzial und Unternehmensnamen als Text-Chips, Dänemark mit Badge „verfügbar". Hover verknüpft Karte und Länderkarte. Die Länderkarten stehen erst unter 640 px Breite unter der Karte; dort werden auch die Kartenlabels ausgeblendet.
- Bewusst schlank: keine Einleitung zum Hover, keine Legende, kein Hinweistext unter dem Bereich. Der Hinweis „Beispiele ohne Empfehlung und ohne Verbindung zu den Unternehmen" gehört bei Bedarf ins Impressum oder in den Haftungshinweis.
- **Keine Logos.** Nur Namen.

### 5b. Über-mich-Seite

Aufbau nach Prototyp: Kopfbereich mit Foto (Hochformat 4:5, abgerundet) links, rechts Überschrift, Einstiegssatz und drei Kurzfakten (München · „20 Jahre am Kapitalmarkt“ · Core-Satellite-Strategie). Darunter Fließtext in einer Spalte (max. 700 px, linksbündig) unter einem Kopfbereich in voller Inhaltsbreite wie die Startseite (`main`, max. 1040 px inkl. 32 px Rand; Foto 230 px links, Überschrift und Einstiegssatz rechts daneben) mit diesen Zwischenüberschriften:

1. Mein Weg an den Kapitalmarkt
2. Warum auch Einzelaktien
3. Die Überraschung bei der Quellensteuer
4. 2025: mein erster Versuch (mit Faktenkarte zur Dauer bis zur Gutschrift: Schweiz 2 Wochen, Schweden 7 Monate, Italien 9 Monate, Dänemark 12 Monate)
5. Warum DivRebound
6. Button „Zur DivRebound App", danach Kontakt

Der Text steht im Prototyp und soll von dort 1:1 übernommen werden. Er liegt als Markdown in `ueber-mich.md`, das Foto als `assets/img/matthias.jpg` (640 × 800 px, ca. 75 KB). Auf dem Handy steht das Foto über dem Text.

**Stand:** Text mit Matthias abgestimmt (10.10.2026). Die Aussage zur Doppelbelastung nennt ausdrücklich, dass ein Teil der Quellensteuer in Deutschland angerechnet wird und der Rest aktiv zurückgefordert werden muss.

---

## 6. Rechtlicher Hinweis (kein Rechtsrat, nur Hinweis auf Lücke)

Du hast in den Vorgaben nur „Impressum" genannt. Da die Seite (a) an Privatpersonen gerichtet ist und (b) die App perspektivisch personenbezogene Finanzdaten verarbeitet, würde eine **Datenschutzerklärung** typischerweise ebenfalls erwartet — unabhängig davon, ob aktuell schon Formulare/Tracking eingesetzt werden. Ich habe sie oben als eigene Seite vorgesehen, aber final entscheidest natürlich du bzw. wer die Seite rechtlich prüft; ich bin kein Anwalt.

---

## 7. Offene Punkte vor der Übergabe an Claude Code

1. **Repo-/Pfadname** final festlegen (Empfehlung: `divrebound`) — bestimmt `baseurl` und alle relativen Links.
2. **Über-mich-Kontakt:** E-Mail-Adresse oder Kontaktformular fehlt noch. Der restliche Text steht (Abschnitt 5b).
3. **Impressum-Pflichtangaben:** Name, Anschrift, Kontakt. Bis dahin Platzhalter. Rechtlich prüfen lassen.
4. **Datenschutzerklärung:** Inhalt rechtlich prüfen lassen, inklusive der Aussage, dass Daten nur lokal im Browser verarbeitet werden.
5. **Google Fonts:** per CDN einbinden (einfach, aber externer Request) oder selbst hosten (datenschutzfreundlicher, ein Schritt mehr). Empfehlung: selbst hosten.
6. **Hero-Kennzahl:** Entschieden: „bis zu 30 %“, passend zu Belgien (Regelsatz 30 %, Erstattungspotenzial laut Tabelle bis zu 30 %). Hinweis: Belgien ist (wie Irland) noch nicht von DivRebound unterstützt; die Aussage bezieht sich auf das Marktpotenzial, nicht auf den aktuellen App-Umfang (nur Dänemark).
7. **Status „in Planung":** Gilt aktuell für alle Länder außer Dänemark, Österreich und Frankreich. Bei einzelnen Ländern prüfen, ob man das versprechen will, sonst „offen" oder „nicht geplant".
8. **Aktualität der Tabelle:** Quelle hat Stand 10. Mai 2026. Stand auf der Seite anzeigen und regelmäßig prüfen.
9. **Hash-Routing in der App:** Prüfen, ob die App es schon nutzt.

---

## 8. Handoff-Aufgabenliste für Claude Code

1. Jekyll-Grundgerüst aufsetzen (`_config.yml` mit `baseurl`, `_layouts/default.html`, `_includes/header.html` + `footer.html`, `_data/nav.yml`)
2. `assets/css/tokens.css` mit der Farbpalette aus Abschnitt 3 anlegen und in Website und App einbinden
3. Header (Navy, Menüpunkte und CTA mittig, CTA-Zustand „Zurück zur App" über `localStorage`) und Footer nach Prototyp bauen
4. Startseite (`index.md`) nach Blueprint aus Abschnitt 5 bauen, Texte und Layout aus dem Prototyp übernehmen
5. `_data/countries.yml` aus Abschnitt 5a anlegen, daraus Länder-Tabelle, Europakarte und Länderkarten rendern (Liquid). Karte als `assets/img/europa-karte.svg`
6. `ueber-mich.md` nach Abschnitt 5b (Text und Foto aus dem Prototyp), `impressum.md` und `datenschutz.md` als einfache Content-Seiten anlegen (Platzhaltertexte, wo Inhalt noch fehlt)
7. `/app/`-Verzeichnis anlegen bzw. bestehenden App-Stand hineinkopieren; sicherstellen, dass Jekyll diesen Ordner unverändert durchreicht
8. App-Navigation Variante A umsetzen (Abschnitt 4a): Button „← Zur Website" in der Kopfzeile rechts, Links Über mich · Impressum · Datenschutz im Fuß der Seitenleiste, `localStorage`-Marker beim Start, Hash-Routing
9. Logo-SVG (Refresh v3) als eigenständige Asset-Datei in `assets/img/` ablegen, in Header, Footer, App-Seitenleiste und Favicon einbinden
10. Screenshot der Positionsübersicht mit verallgemeinerten Daten für „Ein Blick in die App" erstellen
11. GitHub Pages Repo-Einstellungen prüfen: Quelle = `main`-Branch, `/(root)`, Jekyll-Build aktiv (kein Custom-Workflow nötig)
12. Responsiv prüfen (Handy-Breite) und mit dem Prototyp abgleichen
