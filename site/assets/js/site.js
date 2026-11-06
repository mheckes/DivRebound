// Website-Logik, bewusst minimal (keine Abhängigkeiten).

(function () {
  // Alte App-Links (vor dem Umzug nach /app/) lauteten .../DivRebound/#/dk/...
  // Solche Aufrufe landen jetzt auf der Startseite und werden in die App
  // weitergeleitet. Gleiche Origin, die IndexedDB-Daten bleiben erhalten.
  var cta = document.querySelector("[data-app-cta]");
  if (cta && /^#\//.test(location.hash)) {
    location.replace(cta.getAttribute("href") + location.hash);
    return;
  }

  // Europakarte: Hover verknüpft Land in der Karte, Beschriftung und Länderkarte.
  document.querySelectorAll("[data-c]").forEach(function (el) {
    var c = el.getAttribute("data-c");
    function set(on) {
      document.querySelectorAll('[data-c="' + c + '"]').forEach(function (x) {
        x.classList.toggle("hl", on);
      });
    }
    el.addEventListener("mouseenter", function () { set(true); });
    el.addEventListener("mouseleave", function () { set(false); });
  });

  // App-Vorschau: die Desktop-Ansicht wird als Ganzes auf die Breite des
  // Laptop-Rahmens skaliert (Breite der Ansicht steht in site.css).
  var screen = document.querySelector(".mock-screen");
  var mock = screen && screen.querySelector(".app-mock");
  if (mock) {
    function fitMock() {
      var scale = screen.clientWidth / mock.offsetWidth;
      mock.style.transform = "scale(" + scale + ")";
      screen.style.height = mock.offsetHeight * scale + screen.offsetHeight - screen.clientHeight + "px"; // + Rahmen
    }
    window.addEventListener("resize", fitMock);
    fitMock();
  }

  // Lange Listen: auf dem Handy nur die ersten Einträge, Rest per Schalter.
  // Das Kürzen selbst macht site.css (nur unter 720px), ohne JS bleibt alles sichtbar.
  document.querySelectorAll("[data-collapse-mobile]").forEach(function (list) {
    var limit = Number(list.getAttribute("data-collapse-mobile"));
    var rows = list.querySelectorAll(".country-row:not(.head)");
    var total = rows.length;
    if (total <= limit) return;
    // Zeilen ab dem Limit ausblenden, Gruppenüberschriften ohne sichtbare Zeile ebenso
    for (var i = limit; i < total; i++) rows[i].classList.add("is-extra");
    list.querySelectorAll(".country-group-head").forEach(function (head) {
      var first = head.nextElementSibling;
      if (first && first.classList.contains("is-extra")) head.classList.add("is-extra");
    });
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collapse-toggle";
    btn.setAttribute("aria-expanded", "false");
    function render(collapsed) {
      list.classList.toggle("is-collapsed", collapsed);
      btn.setAttribute("aria-expanded", String(!collapsed));
      btn.textContent = collapsed ? "Alle " + total + " Länder anzeigen ↓" : "Weniger anzeigen ↑";
    }
    btn.addEventListener("click", function () {
      var collapse = !list.classList.contains("is-collapsed");
      render(collapse);
      if (collapse) list.scrollIntoView({ block: "start" });
    });
    render(true);
    list.after(btn);
  });
})();

// „Will ich haben“ bei geplanten Ländern: anonyme Stimme über Formspree.
// Der Browser merkt sich lokal, wofür schon abgestimmt wurde (nur Komfort,
// ohne Speicher funktioniert der Knopf trotzdem). Ohne JS bleibt er versteckt.
(function () {
  var table = document.querySelector("[data-wish-endpoint]");
  var endpoint = table && table.getAttribute("data-wish-endpoint");
  if (!endpoint || !window.fetch) return;
  var KEY = "divrebound-country-wishes";
  var done = [];
  try { done = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { done = []; }

  function markDone(btn) {
    btn.disabled = true;
    btn.classList.add("is-done");
    btn.textContent = "✓ Vorgemerkt";
  }

  table.querySelectorAll("[data-wish]").forEach(function (btn) {
    var country = btn.getAttribute("data-wish");
    btn.hidden = false;
    if (done.indexOf(country) !== -1) { markDone(btn); return; }
    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Wird gesendet …";
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: "Länderwunsch: " + country, art: "Länderwunsch", land: country, quelle: "Website" }),
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        markDone(btn);
        done.push(country);
        try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {}
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = "Nicht gesendet – nochmal versuchen";
      });
    });
  });
})();
